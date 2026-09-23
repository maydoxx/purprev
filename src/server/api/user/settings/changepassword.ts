import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

export const changepassword = new Elysia()
    .use(session)
    .post("/changepassword", async ({ body, user, cookie, status }) => {
        if (body.newPassword !== body.confirmPassword) {
            return status(400, {
                error: "Passwords do not match"
            });
        }

        const [row] = await sql`SELECT password FROM users WHERE id = ${user.id}`;
        if (!(await Bun.password.verify(body.currentPassword, row.password))) {
            return status(401, {
                error: "Current password is wrong"
            });
        }

        const hash = await Bun.password.hash(body.newPassword, "bcrypt");
        await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;

        // log out everywhere else
        await sql`DELETE FROM tokens WHERE user_id = ${user.id} AND token != ${cookie.token!.value}`;

        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            currentPassword: t.String(),
            newPassword: t.String({ minLength: 8 }),
            confirmPassword: t.String()
        })
    })
