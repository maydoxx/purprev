import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";

const link = (kind: string, targetId: number) => {
    if (kind === "message") {
        return `/my/messages?id=${targetId}`;
    }
    if (kind === "friend_request") {
        return "/my/friends?tab=requests";
    }
    if (kind === "group_affiliate") {
        return `/groups?id=${targetId}`;
    }
    if (kind === "group_affiliate_accepted") {
        return `/groups?id=${targetId}`;
    }
    return `/user?id=${targetId}`;
};

export const notifications = new Elysia({ prefix: "/api/notifications" })
    .use(session)

    .get("/count", async ({ user }) => {
        const [row] = await sql`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${user.id} AND is_read = 0`;
        return {
            unread: Number(row.n)
        };
    }, {
        auth: true
    })

    .get("/", async ({ user, query }) => {
        const page = Math.max(1, query.page ?? 1);
        const [total] = await sql`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${user.id}`;
        const rows = await sql`
            SELECT n.id, n.actor_id, n.kind, n.target_id, n.is_read, n.created_at, u.username AS actor_name
            FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
            WHERE n.user_id = ${user.id}
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT 25 OFFSET ${(page - 1) * 25}
        `;
        return {
            page,
            totalPages: Math.max(1, Math.ceil(Number(total.n) / 25)),
            items: rows.map((row: any) => ({
                ...row,
                href: link(row.kind, Number(row.target_id))
            }))
        };
    }, {
        auth: true,
        query: t.Object({
            page: t.Optional(t.Numeric({ minimum: 1 }))
        })
    })

    .post("/read-all", async ({ user }) => {
        await sql`UPDATE notifications SET is_read = 1 WHERE user_id = ${user.id} AND is_read = 0`;
        return {
            ok: true
        };
    }, {
        auth: true
    })

    .post("/:id/read", async ({ user, params }) => {
        await sql`UPDATE notifications SET is_read = 1 WHERE id = ${params.id} AND user_id = ${user.id}`;
        return {
            ok: true
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        })
    });
