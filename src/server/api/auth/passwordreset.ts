import { Elysia, t } from "elysia";
import { sql, now } from "../../db";
import { digestToken } from "../../crypto";

export const passwordReset = new Elysia()
    .get("/password-reset", async ({ query, status }) => {
        if (!query.token) return status(400, { error: "Reset link is missing." });
        const [reset] = await sql`SELECT user_id FROM password_reset_tokens WHERE token_hash = ${await digestToken(query.token)} AND expires_at > ${now()}`;
        if (!reset) return status(400, { error: "This reset link is invalid or has expired." });
        return { ok: true };
    }, {
        query: t.Object({ token: t.Optional(t.String({ minLength: 64, maxLength: 64 })) })
    })
    .post("/password-reset", async ({ body, status }) => {
        if (body.password !== body.confirmPassword) {
            return status(400, { error: "Passwords do not match." });
        }
        const tokenHash = await digestToken(body.token);
        const [candidate] = await sql`SELECT user_id FROM password_reset_tokens WHERE token_hash = ${tokenHash} AND expires_at > ${now()}`;
        if (!candidate) return status(400, { error: "This reset link is invalid or has expired." });
        const hash = await Bun.password.hash(body.password, "bcrypt");
        const changed = await sql.begin(async tx => {
            const [reset] = await tx`SELECT user_id FROM password_reset_tokens WHERE token_hash = ${tokenHash} AND expires_at > ${now()} FOR UPDATE`;
            if (!reset) return false;
            await tx`UPDATE users SET password = ${hash} WHERE id = ${reset.user_id}`;
            await tx`DELETE FROM tokens WHERE user_id = ${reset.user_id}`;
            await tx`DELETE FROM password_reset_tokens WHERE user_id = ${reset.user_id}`;
            return true;
        });
        if (!changed) return status(400, { error: "This reset link is invalid or has expired." });
        return { ok: true };
    }, {
        body: t.Object({
            token: t.String({ minLength: 64, maxLength: 64 }),
            password: t.String({ minLength: 8, maxLength: 200 }),
            confirmPassword: t.String({ minLength: 8, maxLength: 200 })
        })
    });
