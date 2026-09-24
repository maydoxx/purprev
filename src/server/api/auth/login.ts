import { Elysia, t } from "elysia";
import { session, getUser } from "../../session";
import { sql } from "../../db";

export const login = new Elysia()
    .use(session)
    .post("/login", async ({ body, login, status }) => {
        const [row] = await sql`SELECT id, password FROM users WHERE username = ${body.username.trim()}`;

        // same answer for no user and wrong password
        if (!row || !(await Bun.password.verify(body.password, row.password))) {
            return status(401, {
                error: "Invalid username or password"
            });
        }

        const id = row.id;
        await login(id);
        return {
            ok: true,
            user: await getUser(id)
        };
    }, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
