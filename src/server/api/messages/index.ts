import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { notify } from "../../notifications";
import { privacyAllows } from "../../privacy";

const PER_PAGE = 20;

const TABS = {
    inbox: (id: number) => sql`m.recipient_id = ${id} AND m.message_type = 'message' AND m.recipient_archived = 0`,
    sent: (id: number) => sql`m.sender_id = ${id} AND m.message_type = 'message'`,
    news: (id: number) => sql`m.recipient_id = ${id} AND m.message_type = 'news' AND m.recipient_archived = 0`,
    archive: (id: number) => sql`m.recipient_id = ${id} AND m.recipient_archived = 1`
};

const BULK = {
    archive: sql`recipient_archived = 1`,
    restore: sql`recipient_archived = 0`,
    read: sql`is_read = 1`,
    unread: sql`is_read = 0`
};


const senderName = (username: string | null, type: string) => username ?? (type === "news" ? "NoneRev" : "Unknown");

export const messages = new Elysia({ prefix: "/api/messages" })
    .use(session)

    .get("/", async ({ query, user }) => {
        let tab = query.tab ?? "inbox";
        if (!(tab in TABS)) {
            tab = "inbox";
        }
        const where = TABS[tab as keyof typeof TABS](user.id);
        const other = tab === "sent" ? sql`m.recipient_id` : sql`m.sender_id`;

        const [count] = await sql`SELECT COUNT(*)::int AS n FROM messages m WHERE ${where}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

        const rows = await sql`
            SELECT m.*, u.username AS other_username, u.id AS other_id
            FROM messages m LEFT JOIN users u ON u.id = ${other}
            WHERE ${where}
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;

        const [news] = await sql`
            SELECT COUNT(*)::int AS n FROM messages
            WHERE recipient_id = ${user.id} AND message_type = 'news' AND is_read = 0 AND recipient_archived = 0
        `;

        return {
            tab,
            page,
            totalPages,
            total: Number(count.n),
            newsUnread: Number(news.n),
            messages: rows.map((m: any) => ({
                ...m,
                other_id: m.other_id ?? 0,
                other_username: senderName(m.other_username, m.message_type)
            }))
        };
    }, {
        auth: true,
        query: t.Object({
            tab: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })


    .get("/unread", async ({ user }) => {
        const [count] = await sql`
            SELECT COUNT(*)::int AS n FROM messages
            WHERE recipient_id = ${user.id} AND is_read = 0 AND recipient_archived = 0
        `;
        return {
            unread: Number(count.n)
        };
    }, {
        auth: true
    })


    .get("/:id", async ({ params, user, status }) => {
        const [message] = await sql`
            SELECT m.*, sender.username AS sender_username, recipient.username AS recipient_username
            FROM messages m
            LEFT JOIN users sender ON sender.id = m.sender_id
            LEFT JOIN users recipient ON recipient.id = m.recipient_id
            WHERE m.id = ${params.id} AND (m.sender_id = ${user.id} OR m.recipient_id = ${user.id})
        `;
        if (!message) {
            return status(404, {
                error: "This message does not exist"
            });
        }

        if (message.recipient_id === user.id && !message.is_read) {
            await sql`UPDATE messages SET is_read = 1 WHERE id = ${params.id} AND recipient_id = ${user.id}`;
            message.is_read = 1;
        }

        return {
            ...message,
            sender_username: senderName(message.sender_username, message.message_type)
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        })
    })


    .post("/", async ({ body, user, status }) => {
        const subject = body.subject.trim();
        const text = body.body.trim();

        const [recipient] = await sql`SELECT id, message_privacy FROM users WHERE username = ${body.to.trim()}`;
        if (!recipient) {
            return status(400, {
                error: "That user does not exist"
            });
        }
        if (recipient.id === user.id) {
            return status(400, {
                error: "You cannot message yourself"
            });
        }
        if (!await privacyAllows(recipient.id, user.id, recipient.message_privacy)) {
            return status(403, { error: "This user does not allow messages from you." });
        }
        if (subject === "") {
            return status(400, {
                error: "Please enter a subject"
            });
        }
        if (text === "") {
            return status(400, {
                error: "Please enter a message"
            });
        }

        const created = await sql`
            INSERT INTO messages (sender_id, recipient_id, subject, body, message_type, is_read, recipient_archived, created_at)
            VALUES (${user.id}, ${recipient.id}, ${subject}, ${text}, 'message', 0, 0, ${now()}) RETURNING id`;
        await notify(recipient.id, user.id, "message", Number(created[0].id));

        return {
            ok: true,
            id: Number(created[0].id)
        };
    }, {
        auth: true,
        body: t.Object({
            to: t.String({ maxLength: 32 }),
            subject: t.String({ maxLength: 120 }),
            body: t.String({ maxLength: 5000 })
        })
    })

    .post("/bulk", async ({ body, user }) => {
        const ids = [...new Set(body.message_ids.filter(id => id > 0))];
        if (ids.length > 0) {
            await sql`UPDATE messages SET ${BULK[body.action]} WHERE id IN ${sql(ids)} AND recipient_id = ${user.id}`;
        }
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            action: t.Union([
                t.Literal("archive"),
                t.Literal("restore"),
                t.Literal("read"),
                t.Literal("unread")
            ]),
            message_ids: t.Array(t.Numeric())
        })
    })
