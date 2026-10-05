import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { friendStatus, friendCount } from "../../friends";
import { isInternal } from "./internal";
import { white, black } from "./chatfilter";
import { text } from "./sign";
import { notify } from "../../notifications";

const pair = t.Object({
    firstUserId: t.Numeric(),
    secondUserId: t.Numeric()
});

const followBody = t.Object({
    followedUserId: t.Numeric()
});

const request = (from: number, to: number) =>
    sql`INSERT INTO friendships (requester_id, target_id, status, created_at) VALUES (${from}, ${to}, 'pending', ${now()}) ON CONFLICT DO NOTHING`;

const accept = (from: number, to: number) =>
    sql`UPDATE friendships SET status = 'accepted', accepted_at = ${now()} WHERE requester_id = ${from} AND target_id = ${to} AND status = 'pending'`;

const remove = (a: number, b: number) =>
    sql`DELETE FROM friendships WHERE (requester_id = ${a} AND target_id = ${b}) OR (requester_id = ${b} AND target_id = ${a})`;


const friend = new Elysia({ prefix: "/Friend" })


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


const user = new Elysia({ prefix: "/user" })
    .use(session)


    .get("/following-exists", async ({ query, user }) => {
        const followed = query.UserID ?? query.userId ?? 0;
        const follower = query.followerUserId ?? user?.id ?? 0;
        const [row] = await sql`SELECT 1 FROM user_follows WHERE follower_id = ${follower} AND followed_id = ${followed}`;
        return {
            success: true,
            message: "Success",
            isFollowing: !!row
        };
    }, {
        query: t.Object({
            UserID: t.Optional(t.Numeric()),
            userId: t.Optional(t.Numeric()),
            followerUserId: t.Optional(t.Numeric())
        })
    })

    .post("/follow", async ({ body, user }) => {
        const [target] = await sql`SELECT id FROM users WHERE id = ${body.followedUserId}`;
        if (!target || body.followedUserId === user.id) {
            return {
                success: false,
                message: "cannot follow that user"
            };
        }
        const inserted = await sql`INSERT INTO user_follows (follower_id, followed_id, created_at) VALUES (${user.id}, ${body.followedUserId}, ${now()}) ON CONFLICT DO NOTHING`;
        if (inserted.count) {
            await notify(body.followedUserId, user.id, "follow", user.id);
        }
        return {
            success: true
        };
    }, {
        auth: true,
        body: followBody
    })

    .post("/unfollow", async ({ body, user }) => {
        await sql`DELETE FROM user_follows WHERE follower_id = ${user.id} AND followed_id = ${body.followedUserId}`;
        return {
            success: true
        };
    }, {
        auth: true,
        body: followBody
    })


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

const filtered = ({ body }: { body: { text: string } }) => ({
    data: {
        white: white(body.text),
        black: black(body.text)
    }
});

const filterBody = t.Object({
    text: t.String(),
    userId: t.Optional(t.Numeric())
});

export const social = new Elysia()
    .use(friend)
    .use(user)


    .post("/moderation/filtertext", filtered, {
        body: filterBody
    })
