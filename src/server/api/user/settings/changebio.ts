import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

export const changebio = new Elysia()
    .use(session)
    .post("/changebio", async ({ body, user }) => {
        await sql`UPDATE users SET about = ${body.newBio.trim()} WHERE id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            newBio: t.String({ maxLength: 1000 })
        })
    })
