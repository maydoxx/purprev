import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { SITE_URL } from "../../site";
import { isOnline, presenceOf, type Presence } from "../../friends";
import { isInternal } from "./internal";

const FRIENDS_PER_PAGE = 50;
const BLOCKS_PER_PAGE = 50;
const ALLIES_PER_PAGE = 20;

const WEBSITE = 2;
const STUDIO = 3;
const IN_GAME = 4;

// game.ts has /users/:userId/canmanage, the router wants the same param name
const userId = t.Object({
    userId: t.Numeric()
});

const groupId = t.Object({
    groupId: t.Numeric()
});

const paged = t.Object({
    page: t.Optional(t.Numeric())
});

const pageOf = (page: number | undefined) => Math.max(1, Math.floor(page ?? 1));

const player = (row: any) => ({
    Id: Number(row.id),
    Username: row.username,
    AvatarUri: null,
    AvatarFinal: false,
    IsOnline: isOnline(row.lastOnlineSite)
});

const noUser = {
    success: false,
    errorMessage: "User not found"
};

const friendRows = (id: number) => sql`
    SELECT users.id, users.username, users."lastOnlineSite" FROM friendships
    JOIN users ON users.id = CASE WHEN friendships.requester_id = ${id} THEN friendships.target_id ELSE friendships.requester_id END
    WHERE friendships.status = 'accepted'
    AND (friendships.requester_id = ${id} OR friendships.target_id = ${id})
`;

const emblem = (icon: string) => (icon.startsWith("/") ? SITE_URL + icon : icon);

const groupCols = () => sql`g.id, g.name, g.owner_id, g.description, g.icon, u.username AS owner_name`;

const groupInfo = async (group: any) => {
    const roles = await sql`SELECT name, rank FROM group_roles WHERE group_id = ${group.id} ORDER BY rank`;
    return {
        Name: group.name,
        Id: Number(group.id),
        Owner: {
            Name: group.owner_name,
            Id: Number(group.owner_id)
        },
        EmblemUrl: emblem(group.icon),
        Description: group.description,
        Roles: [
            {
                Name: "Guest",
                Rank: 0
            },
            ...roles.map((r: any) => ({
                Name: r.name,
                Rank: Number(r.rank)
            }))
        ]
    };
};

const location = (presence: Presence) => {
    if (presence.type === "game") {
        return {
            LastLocation: presence.place_name ?? "",
            PlaceId: presence.place_id,
            GameId: presence.job_id,
            LocationType: IN_GAME
        };
    }
    if (presence.type === "website") {
        return {
            LastLocation: "Website",
            PlaceId: null,
            GameId: null,
            LocationType: WEBSITE
        };
    }
    if (presence.type === "studio") {
        return {
            LastLocation: "Studio",
            PlaceId: presence.place_id,
            GameId: null,
            LocationType: STUDIO
        };
    }
    return null;
};


const users = new Elysia({ prefix: "/users" })

    .get("/get-by-username", async ({ query }) => {
        const [row] = await sql`SELECT id, username, "lastOnlineSite" FROM users WHERE username = ${query.username}`;
        return row ? player(row) : noUser;
    }, {
        query: t.Object({
            username: t.String()
        })
    })

    .get("/:userId", async ({ params }) => {
        const [row] = await sql`SELECT id, username, "lastOnlineSite" FROM users WHERE id = ${params.userId}`;
        return row ? player(row) : noUser;
    }, {
        params: userId
    })

    .get("/:userId/friends", async ({ params, query }) => {
        const rows = await sql`
            ${friendRows(params.userId)}
            ORDER BY users.id
            LIMIT ${FRIENDS_PER_PAGE} OFFSET ${(pageOf(query.page) - 1) * FRIENDS_PER_PAGE}
        `;
        return rows.map(player);
    }, {
        params: userId,
        query: paged
    })

    .get("/:userId/groups", async ({ params }) => {
        const rows = await sql`
            SELECT g.id, g.name, g.icon, m.rank, m.role FROM group_members m
            JOIN site_groups g ON g.id = m.group_id
            WHERE m.user_id = ${params.userId}
            ORDER BY m.joined_at, g.id
        `;
        return rows.map((r: any) => ({
            Name: r.name,
            Id: Number(r.id),
            EmblemUrl: emblem(r.icon),
            EmblemId: 0,
            Rank: Number(r.rank),
            Role: r.role,
            IsPrimary: false,
            IsInClan: false
        }));
    }, {
        params: userId
    })


const my = new Elysia({ prefix: "/my" })
    .use(session)

    .get("/friendsonline", async ({ user }) => {
        const friends = await sql`
            ${friendRows(user.id)}
            ORDER BY users.username
        `;
        const presence = await presenceOf(friends, user.id);

        const online = [];
        for (const friend of friends) {
            const at = location(presence(friend));
            if (at) {
                online.push({
                    VisitorId: Number(friend.id),
                    UserName: friend.username,
                    ...at
                });
            }
        }
        return online.sort((a, b) => b.LocationType - a.LocationType);
    }, {
        auth: true
    })


const userblock = new Elysia({ prefix: "/userblock" })
    .use(session)

    .get("/getblockedusers", async ({ query, user, request, server, status }) => {
        const id = query.userId ?? user?.id ?? 0;
        if (!isInternal(request, server) && (!user || id !== user.id)) {
            return status(403, {
                success: false,
                message: "not allowed"
            });
        }
        const [rows, [count]] = await Promise.all([
            sql`
                SELECT blocked_id FROM user_blocks WHERE blocker_id = ${id}
                ORDER BY created_at, blocked_id
                LIMIT ${BLOCKS_PER_PAGE} OFFSET ${(pageOf(query.page) - 1) * BLOCKS_PER_PAGE}
            `,
            sql`SELECT COUNT(*)::int AS n FROM user_blocks WHERE blocker_id = ${id}`
        ]);
        return {
            success: true,
            userList: rows.map((r: any) => Number(r.blocked_id)),
            total: Number(count.n)
        };
    }, {
        query: t.Object({
            userId: t.Optional(t.Numeric()),
            page: t.Optional(t.Numeric())
        })
    })

    .guard({
        body: t.Object({
            blockerId: t.Numeric(),
            blockeeId: t.Numeric()
        }),
        beforeHandle({ request, server, status }) {
            if (!isInternal(request, server)) {
                return status(403, {
                    error: "game servers only"
                });
            }
        }
    }, app => app
        .post("/blockuser", async ({ body }) => {
            const [found] = await sql`SELECT COUNT(*)::int AS n FROM users WHERE id = ${body.blockerId} OR id = ${body.blockeeId}`;
            if (body.blockerId === body.blockeeId || Number(found.n) < 2) {
                return {
                    success: false,
                    message: "cannot block that user"
                };
            }
            await sql`INSERT INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (${body.blockerId}, ${body.blockeeId}, ${now()}) ON CONFLICT DO NOTHING`;
            return {
                success: true
            };
        })

        .post("/unblockuser", async ({ body }) => {
            await sql`DELETE FROM user_blocks WHERE blocker_id = ${body.blockerId} AND blocked_id = ${body.blockeeId}`;
            return {
                success: true
            };
        })
    )


const groups = new Elysia({ prefix: "/groups" })

    .get("/:groupId", async ({ params, status }) => {
        const [group] = await sql`
            SELECT ${groupCols()} FROM site_groups g
            LEFT JOIN users u ON u.id = g.owner_id
            WHERE g.id = ${params.groupId}
        `;
        if (!group) {
            return status(404, {
                error: "Group not found"
            });
        }
        return groupInfo(group);
    }, {
        params: groupId
    })

    .get("/:groupId/allies", async ({ params, query, status }) => {
        const [group] = await sql`SELECT id FROM site_groups WHERE id = ${params.groupId}`;
        if (!group) {
            return status(404, {
                error: "Group not found"
            });
        }
        const rows = await sql`
            SELECT ${groupCols()} FROM group_affiliates a
            JOIN site_groups g ON g.id = CASE WHEN a.group_id = ${params.groupId} THEN a.other_group_id ELSE a.group_id END
            LEFT JOIN users u ON u.id = g.owner_id
            WHERE a.status = 'accepted' AND (a.group_id = ${params.groupId} OR a.other_group_id = ${params.groupId})
            ORDER BY g.id
            LIMIT ${ALLIES_PER_PAGE + 1} OFFSET ${(pageOf(query.page) - 1) * ALLIES_PER_PAGE}
        `;
        return {
            Groups: await Promise.all(rows.slice(0, ALLIES_PER_PAGE).map(groupInfo)),
            FinalPage: rows.length <= ALLIES_PER_PAGE
        };
    }, {
        params: groupId,
        query: paged
    })

    .get("/:groupId/enemies", async ({ params, status }) => {
        const [group] = await sql`SELECT id FROM site_groups WHERE id = ${params.groupId}`;
        if (!group) {
            return status(404, {
                error: "Group not found"
            });
        }
        return {
            Groups: [],
            FinalPage: true
        };
    }, {
        params: groupId
    })


export const people = new Elysia()
    .use(users)
    .use(my)
    .use(userblock)
    .use(groups)
