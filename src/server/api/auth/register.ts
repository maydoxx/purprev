import { Elysia, t } from "elysia";
import { giveStarterItems } from "../../starter";
import { session, getUser, claimDailyLoginRewards } from "../../session";
import { sql, now } from "../../db";
import { rcc } from "../../rcc";
import { siteSetting } from "../../settings";
import { claimInvite, logInvite, rawClientIp } from "../../invites";
import { verifyTurnstile } from "../../turnstile";
import { authLimiter } from "../../ratelimit";
import { hashPassword } from "../../password-hash";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

// Simple zxcvbn-inspired strength check
function checkPasswordStrength(password: string): { score: number; feedback: string[] } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
    else feedback.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("Add lowercase letters");

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("Add uppercase letters");

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push("Add numbers");

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push("Add special characters");

    // Common patterns penalty
    if (/(.)\1{2,}/.test(password)) {
        score -= 1;
        feedback.push("Avoid repeated characters");
    }
    if (/^(?:password|admin|welcome|qwerty|123456|abcdef)/i.test(password)) {
        score = 0;
        feedback.push("Avoid common passwords");
    }

    return { score: Math.max(0, Math.min(4, score)), feedback };
}

export const register = new Elysia()
    .use(session)
    .use(authLimiter)
    .post("/register", async ({ body, login, status, request, server }) => {
        const username = body.username.trim();
        const inviteKey = body.invitekey.trim();

        if (!(await siteSetting("registration_enabled"))) {
            return status(403, {
                error: "Registration is closed right now"
            });
        }

        if (body.password !== body.confirmpassword) {
            return status(400, {
                error: "Passwords do not match"
            });
        }

        // Password strength check
        const { score, feedback } = checkPasswordStrength(body.password);
        if (score < 3) {
            return status(400, {
                error: "Password too weak",
                details: feedback
            });
        }

        if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
            return status(400, {
                error: "Username can only have letters and numbers"
            });
        }

        // Check username availability (constant-time-ish response)
        const [taken] = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (taken) {
            return status(400, {
                error: "Username is already taken"
            });
        }

        // Turnstile is now mandatory in production
        if (!(await verifyTurnstile(body.turnstile, rawClientIp(request, server)))) {
            return status(400, {
                error: "Please complete the captcha"
            });
        }

        const invite = await claimInvite(inviteKey);
        if (!invite) {
            return status(400, {
                error: "Invalid invite key"
            });
        }

        const hash = await hashPassword(body.password);
        const created = await sql`INSERT INTO users (username, password, created_at) VALUES (${username}, ${hash}, ${now()}) RETURNING id`;

        const id = Number(created[0].id);
        await logInvite(invite, id, request, server);
        await giveStarterItems(id);
        rcc.render.avatar(id);
        await login(id);
        await claimDailyLoginRewards(id);
        return {
            ok: true,
            user: await getUser(id)
        };
    }, {
        body: t.Object({
            username: t.String({ maxLength: 32 }),
            password: t.String({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH }),
            confirmpassword: t.String(),
            invitekey: t.String(),
            turnstile: t.String({ maxLength: 4000 }) // Now required
        })
    })