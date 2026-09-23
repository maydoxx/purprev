import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";

// TODO: captcha, cloudflare turnstile
export const register = new Elysia()
    .use(session)
    .post("/register", async ({ body, login, status }) => {
        const username = body.username.trim();
        const inviteKey = body.invitekey.trim();

        if (body.password !== body.confirmpassword) {
            return status(400, {
                error: "Passwords do not match"
            });
        }
        if (body.password.length < 8) {
            return status(400, {
                error: "Password must be at least 8 characters"
            });
        }
        if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
            return status(400, {
                error: "Username can only have letters and numbers"
            });
        }

        const [taken] = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (taken) {
            return status(400, {
                error: "Username is already taken"
            });
        }

        // deleting it is the check, so two people cant use the same key
        const deleted = await sql`DELETE FROM invites WHERE inviteKey = ${inviteKey}`;
        if (!deleted.affectedRows) {
            return status(400, {
                error: "Invalid invite key"
            });
        }

        const hash = await Bun.password.hash(body.password, "bcrypt");
        const created = await sql`INSERT INTO users (username, password, created_at) VALUES (${username}, ${hash}, ${now()})`;

        // TODO: rcc manager renders the avatar here
        await login(Number(created.lastInsertRowid));
        return {
            ok: true
        };
    }, {
        body: t.Object({
            username: t.String({ maxLength: 32 }),
            password: t.String(),
            confirmpassword: t.String(),
            invitekey: t.String()
        })
    })
