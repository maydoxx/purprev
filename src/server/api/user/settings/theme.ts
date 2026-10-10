import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

export const theme = new Elysia()
    .use(session)
    .post("/theme", async ({ body, user }) => {
        await sql`UPDATE users SET theme = ${body.theme} WHERE id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            theme: t.Union([
                t.Literal("auto"),
                t.Literal("classic"),
                t.Literal("dark"),
                t.Literal("halloween"),
                t.Literal("sakura")
            ])
        })
    })
