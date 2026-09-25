import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { friendStatus, friendCount } from "../../friends";
import { PENDING } from "../../paths";
import { mediaStream } from "../../media";
import { isInternal } from "./internal";
import { white, black } from "./chatfilter";
import { text } from "./sign";

const pair = t.Object({
    firstUserId: t.Numeric(),
    secondUserId: t.Numeric()
});

const request = (from: number, to: number) =>
    sql`INSERT IGNORE INTO friendships (requester_id, target_id, status, created_at) VALUES (${from}, ${to}, 'pending', ${now()})`;

const accept = (from: number, to: number) =>
    sql`UPDATE friendships SET status = 'accepted', accepted_at = ${now()} WHERE requester_id = ${from} AND target_id = ${to} AND status = 'pending'`;

const remove = (a: number, b: number) =>
    sql`DELETE FROM friendships WHERE (requester_id = ${a} AND target_id = ${b}) OR (requester_id = ${b} AND target_id = ${a})`;

// ingame player menu, only game servers may call the posts
const friend = new Elysia({ prefix: "/Friend" })
    // ?userId=1&otherUserIds=2&otherUserIds=3 -> ",2,"
    // engine skips the first char and reads "id," so the commas stay
    .get("/AreFriends", async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const userId = Number(params.get("userId")) || 0;
        const others = [...new Set(params.getAll("otherUserIds").map(Number))].filter(n => n > 0);

        let out = ",";
        for (const other of others) {
            if (userId > 0 && await friendStatus(userId, other) === "friends") {
                out += other + ",";
            }
        }
        return text(out);
    })

    .guard({
        query: pair,
        beforeHandle({ request, server, status }) {
            if (!isInternal(request, server)) {
                return status(403, "game servers only");
            }
        }
    }, app => app
        .post("/CreateFriendRequest", async ({ query }) => {
            if (await friendStatus(query.firstUserId, query.secondUserId) === "none") {
                await request(query.firstUserId, query.secondUserId);
            }
            return text("ok");
        })

        .post("/DeleteFriendRequest", async ({ query }) => {
            await sql`DELETE FROM friendships WHERE status = 'pending' AND ((requester_id = ${query.firstUserId} AND target_id = ${query.secondUserId}) OR (requester_id = ${query.secondUserId} AND target_id = ${query.firstUserId}))`;
            return text("ok");
        })

        // request might of been made on the site or in another server, make sure it exists then accept
        .post("/CreateFriend", async ({ query }) => {
            const a = query.firstUserId;
            const b = query.secondUserId;
            let state = await friendStatus(a, b);
            if (state === "none") {
                await request(b, a);
                state = "pending_in";
            }
            if (state === "pending_in") {
                await accept(b, a);
            } else if (state === "pending_out") {
                await accept(a, b);
            }
            return text("ok");
        })

        .post("/BreakFriend", async ({ query }) => {
            await remove(query.firstUserId, query.secondUserId);
            return text("ok");
        })
    )

// the client asks these without /api
const user = new Elysia({ prefix: "/user" })
    .use(session)

    // we dont have following so friends is following
    .get("/following-exists", async ({ query, user }) => {
        const other = query.UserID ?? query.userId ?? 0;
        return {
            success: true,
            message: "Success",
            isFollowing: !!user && other > 0 && await friendStatus(user.id, other) === "friends"
        };
    }, {
        query: t.Object({
            UserID: t.Optional(t.Numeric()),
            userId: t.Optional(t.Numeric())
        })
    })

    // logged in user if no userId
    .get("/get-friendship-count", async ({ query, user }) => {
        const id = query.userId ?? user?.id ?? 0;
        return {
            success: true,
            message: "Success",
            count: id > 0 ? await friendCount(id) : 0
        };
    }, {
        query: t.Object({
            userId: t.Optional(t.Numeric())
        })
    })

export const social = new Elysia()
    .use(friend)
    .use(user)

    // corescripts get friend pics here
    .get("/thumbs/avatar.ashx", async ({ query }) =>
        await mediaStream("headshots", query.userId, "private, max-age=300")
        ?? new Response(Bun.file(PENDING), {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "private, max-age=300"
            }
        }), {
        query: t.Object({
            userId: t.Numeric(),
            x: t.Optional(t.Numeric()),
            y: t.Optional(t.Numeric())
        })
    })

    // game server posts every chat line here, white = under 13, black = 13+
    // broken or empty json makes the message vanish, so always answer
    .post("/moderation/filtertext", ({ body }) => ({
        data: {
            white: white(body.text),
            black: black(body.text)
        }
    }), {
        body: t.Object({
            text: t.String(),
            userId: t.Optional(t.Numeric())
        })
    })
