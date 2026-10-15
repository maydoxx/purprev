import { Elysia } from "elysia";
import { session } from "../../session";
import { recordSecurityAudit } from "../../audit";

export const logout = new Elysia()
    .use(session)
    .post("/logout", async ({ logout, user, request, server }) => {
        await logout();

        if (user) {
            await recordSecurityAudit({
                userId: user.id,
                username: user.username,
                event: "logout",
                request,
                server,
                success: true
            });
        }

        return {
            ok: true
        };
    })