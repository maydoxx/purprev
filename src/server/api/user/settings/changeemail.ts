import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

export const changeemail = new Elysia()
    .use(session)
    .post("/changeemail", async ({ body, user, status }) => {
        const email = body.newEmail.trim().toLowerCase();

        // email is unique
        const [taken] = await sql`SELECT id FROM users WHERE email = ${email} AND id != ${user.id}`;
        if (taken) {
            return status(400, {
                error: "That email is already used"
            });
        }

        await sql`UPDATE users SET email = ${email} WHERE id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            newEmail: t.String({
                format: "email",
                maxLength: 255
            })
        })
    })
