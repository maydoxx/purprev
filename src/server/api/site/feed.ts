import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { DELETED_TEXT, deletedIds } from "../../content";


export const feed = new Elysia({ prefix: "/feed" })
    .use(session)
    .get("/", async ({ user }) => {
        const friends = await sql`
            SELECT CASE WHEN requester_id = ${user.id} THEN target_id ELSE requester_id END AS id FROM friendships
            WHERE status = 'accepted' AND (requester_id = ${user.id} OR target_id = ${user.id})
        `;
        const ids = [user.id, ...friends.map((f: any) => f.id)];

        const rows = await sql`
            SELECT status_updates.id, status_updates.user_id, status_updates.body, status_updates.created_at, users.username
            FROM status_updates JOIN users ON users.id = status_updates.user_id
            WHERE status_updates.user_id IN ${sql(ids)}
            ORDER BY status_updates.created_at DESC, status_updates.id DESC
            LIMIT 12
        `;
        const deleted = await deletedIds("status", rows.map((row: any) => Number(row.id)));
        return rows.map((row: any) => ({
            ...row,
            id: Number(row.id),
            user_id: Number(row.user_id),
            created_at: Number(row.created_at),
            body: deleted.has(Number(row.id)) ? DELETED_TEXT : row.body
        }));
    }, {
        auth: true
    })

    .post("/", async ({ body, user, status }) => {
        const text = body.status.trim();
        if (text === "") {
            return status(400, {
                error: "Status cannot be empty."
            });
        }

        await sql`INSERT INTO status_updates (user_id, body, created_at) VALUES (${user.id}, ${text}, ${now()})`;
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            status: t.String({ maxLength: 254 })
        })
    })
