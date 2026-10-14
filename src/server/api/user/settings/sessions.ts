import { Elysia, t } from "elysia";
import { platformOf, session } from "../../../session";
import { now, sql } from "../../../db";

export const sessions = new Elysia()
    .use(session)
    .get("/sessions", async ({ user, token, request }) => {
        const activeSessions = await sql`
            SELECT id, expires, platform, token = ${token} AS current
            FROM tokens
            WHERE user_id = ${user.id} AND expires > ${now()}
            ORDER BY (token = ${token}) DESC, expires DESC
        `;
        const currentPlatform = platformOf(request.headers.get("user-agent") ?? "");
        return {
            sessions: activeSessions.map((activeSession: { current: boolean; platform: string }) => ({
                ...activeSession,
                platform: activeSession.platform === "Unknown" && activeSession.current ? currentPlatform : activeSession.platform
            }))
        };
    }, { auth: true })
    .delete("/sessions/:id", async ({ params, user, token, status }) => {
        const [target] = await sql`
            SELECT token FROM tokens WHERE id = ${params.id} AND user_id = ${user.id} AND expires > ${now()}
        `;
        if (!target) return status(404, { error: "Session not found" });
        if (target.token === token) return status(400, { error: "You cannot revoke your current session here" });

        await sql`DELETE FROM tokens WHERE id = ${params.id} AND user_id = ${user.id} AND token != ${token}`;
        return { ok: true };
    }, {
        auth: true,
        params: t.Object({ id: t.Numeric() })
    })
    .post("/signout", async ({ user, token }) => {
        await sql`DELETE FROM tokens WHERE user_id = ${user.id} AND token != ${token}`;
        return { ok: true };
    }, { auth: true });
