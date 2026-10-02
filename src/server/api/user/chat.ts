import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { friendStatus, friendsOf } from "../../friends";
import { white } from "../engine/chatfilter";

const PAGE = 50;
const BODY_MAX = 500;

const id = t.Object({
    id: t.Numeric()
});

type Person = {
    id: number;
    username: string;
    online: boolean;
};

const row = (m: any, me: number) => ({
    id: Number(m.id),
    from: Number(m.sender_id),
    mine: Number(m.sender_id) === me,
    body: m.body,
    at: Number(m.created_at)
});

// friends only, like the 2016 chat bar
export const chat = new Elysia({ prefix: "/chat" })
    .use(session)

    .get("/", async ({ user }) => {
        const latest = await sql`
            SELECT m.*, IF(m.sender_id = ${user.id}, m.recipient_id, m.sender_id) AS other
            FROM chat_messages m
            JOIN (
                SELECT MAX(id) AS id FROM chat_messages
                WHERE sender_id = ${user.id} OR recipient_id = ${user.id}
                GROUP BY LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)
            ) last ON last.id = m.id
            ORDER BY m.id DESC LIMIT 30
        `;
        const unread = await sql`
            SELECT sender_id, COUNT(*) AS n FROM chat_messages
            WHERE recipient_id = ${user.id} AND is_read = 0
            GROUP BY sender_id
        `;
        const unreadBy = new Map<number, number>(unread.map((u: any) => [Number(u.sender_id), Number(u.n)]));
        const friends: Person[] = (await friendsOf(user.id, 200)).map((f: any) => ({
            id: Number(f.id),
            username: f.username,
            online: !!f.online
        }));
        const names = new Map<number, Person>(friends.map(f => [f.id, f]));
        for (const m of latest) {
            if (!names.has(Number(m.other))) {
                const [u] = await sql`SELECT id, username, lastOnlineSite FROM users WHERE id = ${m.other}`;
                if (u) {
                    names.set(Number(u.id), {
                        id: Number(u.id),
                        username: u.username,
                        online: false
                    });
                }
            }
        }
        return {
            unread: [...unreadBy.values()].reduce((a, b) => a + b, 0),
            conversations: latest.filter((m: any) => names.has(Number(m.other))).map((m: any) => ({
                id: Number(m.other),
                username: names.get(Number(m.other))!.username,
                online: !!names.get(Number(m.other))!.online,
                unread: unreadBy.get(Number(m.other)) ?? 0,
                last: row(m, user.id)
            })),
            friends
        };
    }, {
        auth: true
    })

    .get("/:id", async ({ params, query, user }) => {
        const after = query.after ?? 0;
        const rows = await sql`
            SELECT * FROM chat_messages
            WHERE ((sender_id = ${user.id} AND recipient_id = ${params.id}) OR (sender_id = ${params.id} AND recipient_id = ${user.id}))
            AND id > ${after}
            ORDER BY id DESC LIMIT ${PAGE}
        `;
        await sql`UPDATE chat_messages SET is_read = 1 WHERE recipient_id = ${user.id} AND sender_id = ${params.id} AND is_read = 0`;
        return rows.reverse().map((m: any) => row(m, user.id));
    }, {
        auth: true,
        params: id,
        query: t.Object({
            after: t.Optional(t.Numeric())
        })
    })

    .post("/:id", async ({ params, body, user, status }) => {
        const text = body.body.trim().slice(0, BODY_MAX);
        if (text === "") {
            return status(400, {
                error: "Say something"
            });
        }
        if (await friendStatus(user.id, params.id) !== "friends") {
            return status(403, {
                error: "You can only chat with friends"
            });
        }
        const filtered = white(text);
        const created = await sql`
            INSERT INTO chat_messages (sender_id, recipient_id, body, is_read, created_at)
            VALUES (${user.id}, ${params.id}, ${filtered}, 0, ${now()})
        `;
        return {
            id: Number(created.lastInsertRowid),
            from: user.id,
            mine: true,
            body: filtered,
            at: now()
        };
    }, {
        auth: true,
        params: id,
        body: t.Object({
            body: t.String({ maxLength: 2000 })
        })
    })
