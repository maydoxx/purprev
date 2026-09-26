import { Elysia } from "elysia";
import { session } from "../../../session";
import { sql, now } from "../../../db";



export const register = new Elysia()
    .use(session)
    .post("/register", async ({ user }) => {
        await sql`UPDATE users SET lastOnlineSite = ${now()} WHERE id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true
    })
