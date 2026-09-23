import { Elysia } from "elysia";
import { session } from "../../session";

export const logout = new Elysia()
    .use(session)
    .post("/logout", async ({ logout }) => {
        await logout();
        return {
            ok: true
        };
    })
