import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";
import { strictAuthLimiter } from "../../../ratelimit";
import { recordSecurityAudit } from "../../../audit";
import { hashPassword, verifyPassword } from "../../../password-hash";
import { digestToken } from "../../../crypto";

const PASSWORD_MIN_LENGTH = 12;

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

export const changepassword = new Elysia()
    .use(session)
    .use(strictAuthLimiter)
    .post("/changepassword", async ({ body, user, request, cookie, status, server }) => {
        if (body.newPassword !== body.confirmPassword) {
            return status(400, {
                error: "Passwords do not match"
            });
        }

        const { score, feedback } = checkPasswordStrength(body.newPassword);
        if (score < 3) {
            return status(400, {
                error: "New password too weak",
                details: feedback
            });
        }

        const [row] = await sql`SELECT password FROM users WHERE id = ${user.id}`;
        if (!(await verifyPassword(body.currentPassword, row.password))) {
            return status(401, {
                error: "Current password is wrong"
            });
        }

        const hash = await hashPassword(body.newPassword);
        await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;

        // Revoke all other sessions
        await sql`DELETE FROM tokens WHERE user_id = ${user.id} AND token != ${await digestToken(String(cookie.token!.value))}`;

        await recordSecurityAudit({
            userId: user.id,
            username: user.username,
            event: "password_change",
            request,
            server,
            success: true
        });

        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            currentPassword: t.String(),
            newPassword: t.String({ minLength: PASSWORD_MIN_LENGTH, maxLength: 128 }),
            confirmPassword: t.String()
        })
    })