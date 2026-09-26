import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { isOnline, friendStatus, friendCount, friendsOf } from "../../friends";

const pendingCount = async (userId: number) => {
    const [row] = await sql`SELECT COUNT(*) AS n FROM friendships WHERE status = 'pending' AND target_id = ${userId}`;
    return Number(row.n);
};


const pending = async (userId: number, direction: "requests" | "sent") => {
    const rows = direction === "requests"
        ? await sql`
            SELECT users.id, users.username, users.lastOnlineSite, friendships.created_at
            FROM friendships JOIN users ON users.id = friendships.requester_id
            WHERE friendships.status = 'pending' AND friendships.target_id = ${userId}
            ORDER BY friendships.created_at DESC
        `
        : await sql`
            SELECT users.id, users.username, users.lastOnlineSite, friendships.created_at
            FROM friendships JOIN users ON users.id = friendships.target_id
            WHERE friendships.status = 'pending' AND friendships.requester_id = ${userId}
            ORDER BY friendships.created_at DESC
        `;

    return rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        online: isOnline(r.lastOnlineSite),
        requestedAt: r.created_at
    }));
};

export const friends = new Elysia({ prefix: "/friends" })
    .use(session)
    .get("/", async ({ query, user }) => {
        const tab = query.tab ?? "friends";

        return {
            tab,
            list: tab === "friends" ? await friendsOf(user.id, 200) : await pending(user.id, tab),
            friendCount: await friendCount(user.id),
            pendingCount: await pendingCount(user.id)
        };
    }, {
        auth: true,
        query: t.Object({
            tab: t.Optional(t.Union([
                t.Literal("friends"),
                t.Literal("requests"),
                t.Literal("sent")
            ]))
        })
    })


    .post("/", async ({ body, user, status }) => {
        const me = user.id;
        const other = body.userId;

        if (me === other) {
            return status(400, {
                error: "You cannot friend yourself"
            });
        }

        const current = await friendStatus(me, other);
        let next = current;

        switch (body.action) {
            case "request": {
                const [exists] = await sql`SELECT id FROM users WHERE id = ${other}`;
                if (!exists) {
                    return status(404, {
                        error: "That user does not exist"
                    });
                }
                if (current === "friends") {
                    return status(400, {
                        error: "You are already friends"
                    });
                }
                if (current === "pending_out") {
                    return status(400, {
                        error: "Friend request already sent"
                    });
                }

                if (current === "pending_in") {
                    await sql`UPDATE friendships SET status = 'accepted', accepted_at = ${now()} WHERE requester_id = ${other} AND target_id = ${me}`;
                    next = "friends";
                    break;
                }
                await sql`INSERT INTO friendships (requester_id, target_id, status, created_at) VALUES (${me}, ${other}, 'pending', ${now()})`;
                next = "pending_out";
                break;
            }

            case "accept": {
                if (current !== "pending_in") {
                    return status(400, {
                        error: "There is no friend request from that user"
                    });
                }
                await sql`UPDATE friendships SET status = 'accepted', accepted_at = ${now()} WHERE requester_id = ${other} AND target_id = ${me}`;
                next = "friends";
                break;
            }

            case "decline": {
                await sql`
                    DELETE FROM friendships WHERE status = 'pending'
                    AND ((requester_id = ${me} AND target_id = ${other}) OR (requester_id = ${other} AND target_id = ${me}))
                `;
                next = "none";
                break;
            }

            case "remove": {
                await sql`
                    DELETE FROM friendships WHERE status = 'accepted'
                    AND ((requester_id = ${me} AND target_id = ${other}) OR (requester_id = ${other} AND target_id = ${me}))
                `;
                next = "none";
                break;
            }
        }

        return {
            ok: true,
            status: next,
            friendCount: await friendCount(me),
            pendingCount: await pendingCount(me)
        };
    }, {
        auth: true,
        body: t.Object({
            action: t.Union([
                t.Literal("request"),
                t.Literal("accept"),
                t.Literal("decline"),
                t.Literal("remove")
            ]),
            userId: t.Numeric()
        })
    })
