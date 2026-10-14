import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

export const privacy = new Elysia()
    .use(session)
    .get("/privacy", async ({ user }) => {
        const [row] = await sql`SELECT message_privacy, follow_privacy, friend_request_privacy FROM users WHERE id = ${user.id}`;
        return {
            messages: row.message_privacy,
            follows: row.follow_privacy,
            friendRequests: row.friend_request_privacy
        };
    }, { auth: true })
    .post("/privacy", async ({ body, user }) => {
        await sql`
            UPDATE users SET message_privacy = ${body.messages}, follow_privacy = ${body.follows}, friend_request_privacy = ${body.friendRequests}
            WHERE id = ${user.id}
        `;
        return { ok: true };
    }, {
        auth: true,
        body: t.Object({
            messages: t.Union([t.Literal("everyone"), t.Literal("friends"), t.Literal("followers"), t.Literal("nobody")]),
            follows: t.Union([t.Literal("everyone"), t.Literal("friends"), t.Literal("nobody")]),
            friendRequests: t.Union([t.Literal("everyone"), t.Literal("followers"), t.Literal("nobody")])
        })
    });
