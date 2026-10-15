import { Elysia, t } from "elysia";
import { platformOf, session } from "../../../session";
import { now, sql } from "../../../db";
import { digestToken } from "../../../crypto";

export const sessions = new Elysia()
    .use(session)
    .get("/sessions", async ({ user, token, request }) => {
        const current = token ? await digestToken(token) : "";
        const activeSessions = await sql`
            SELECT id, expires, platform, token = ${current} AS current
            FROM tokens
            WHERE user_id = ${user.id} AND expires > ${now()}
            ORDER BY (token = ${current}) DESC, expires DESC
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
        if (!token) return status(400, { error: "No active session" });
        const current = await digestToken(token);
        const [target] = await sql`
            SELECT token FROM tokens WHERE id = ${params.id} AND user_id = ${user.id} AND expires > ${now()}
        `;
        if (!target) return status(404, { error: "Session not found" });
        if (target.token === current) return status(400, { error: "You cannot revoke your current session here" });

        await sql`DELETE FROM tokens WHERE id = ${params.id} AND user_id = ${user.id} AND token != ${current}`;
        return { ok: true };
    }, {
        auth: true,
        params: t.Object({ id: t.Numeric() })
    })
    .post("/signout", async ({ user, token, status }) => {
        if (!token) return status(400, { error: "No active session" });
        await sql`DELETE FROM tokens WHERE user_id = ${user.id} AND token != ${await digestToken(token)}`;
        return { ok: true };
    }, { auth: true });
