import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { white } from "../engine/chatfilter";

const PER_PAGE = 10;
const BODY_MAX = 200;
const NEWLINES_MAX = 10;
const FLOOD_SECONDS = 10;

const LINK = /(([a-zA-Z0-9-]+\.[a-zA-Z]{2,4}[:#/?]+)|([a-zA-Z0-9]\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,4}))/;

const kind = t.Union([
    t.Literal("game"),
    t.Literal("item")
]);

const exists = async (which: "game" | "item", id: number) => {
    const [row] = which === "game"
        ? await sql`SELECT id FROM games WHERE id = ${id}`
        : await sql`SELECT id FROM catalog_items WHERE id = ${id}`;
    return !!row;
};

const row = (c: any, me: number, admin: boolean) => ({
    id: Number(c.id),
    user_id: Number(c.user_id),
    username: c.username ?? "",
    body: c.body,
    created_at: Number(c.created_at),
    owns: !!c.owns,
    mine: Number(c.user_id) === me,
    deletable: admin || Number(c.user_id) === me
});

export const comments = new Elysia({ prefix: "/api/comments" })
    .use(session)

    // start is how many are already shown, so a fresh post on top does not shift the next page
    .get("/", async ({ query, user }) => {
        const start = Math.max(0, query.start ?? 0);
        const [count] = await sql`
            SELECT COUNT(*)::int AS n FROM comments
            WHERE kind = ${query.kind} AND target_id = ${query.id}
        `;
        const total = Number(count.n);
        const rows = await sql`
            SELECT c.*, users.username,
                ${query.kind === "item" ? sql`(SELECT 1 FROM user_items ui WHERE ui.user_id = c.user_id AND ui.item_id = c.target_id LIMIT 1)` : sql`0`} AS owns
            FROM comments c
            LEFT JOIN users ON users.id = c.user_id
            WHERE c.kind = ${query.kind} AND c.target_id = ${query.id}
            ORDER BY c.id DESC
            LIMIT ${PER_PAGE} OFFSET ${start}
        `;
        return {
            start,
            perPage: PER_PAGE,
            total,
            hasMore: start + rows.length < total,
            canModerate: !!user && user.admin > 0,
            comments: rows.map((c: any) => row(c, user?.id ?? 0, !!user && user.admin > 0))
        };
    }, {
        query: t.Object({
            kind,
            id: t.Numeric(),
            start: t.Optional(t.Numeric())
        })
    })

    .post("/", async ({ body, user, status }) => {
        const text = body.body.replace(/\r\n?/g, "\n").trim();
        if (text === "") {
            return status(400, {
                error: "Write a comment!"
            });
        }
        if (text.length > BODY_MAX) {
            return status(400, {
                error: "Too many characters!"
            });
        }
        if (text.split("\n").length - 1 > NEWLINES_MAX) {
            return status(400, {
                error: "Too many newlines!"
            });
        }
        if (LINK.test(text.replace(/\n/g, ""))) {
            return status(400, {
                error: "Comments should be about the item or place on which you are commenting. Links are not permitted."
            });
        }
        if (!await exists(body.kind, body.id)) {
            return status(404, {
                error: "Nothing to comment on"
            });
        }
        const [last] = await sql`
            SELECT created_at FROM comments
            WHERE user_id = ${user.id}
            ORDER BY id DESC LIMIT 1
        `;
        if (last && now() - Number(last.created_at) < FLOOD_SECONDS) {
            return status(429, {
                error: `Please wait ${FLOOD_SECONDS} seconds between comments.`
            });
        }
        const filtered = white(text);
        const created = await sql`
            INSERT INTO comments (kind, target_id, user_id, body, created_at)
            VALUES (${body.kind}, ${body.id}, ${user.id}, ${filtered}, ${now()}) RETURNING id`;
        const [owned] = body.kind === "item"
            ? await sql`SELECT 1 FROM user_items WHERE user_id = ${user.id} AND item_id = ${body.id} LIMIT 1`
            : [null];
        return row({
            id: created[0].id,
            user_id: user.id,
            username: user.username,
            body: filtered,
            created_at: now(),
            owns: !!owned
        }, user.id, user.admin > 0);
    }, {
        auth: true,
        body: t.Object({
            kind,
            id: t.Numeric(),
            body: t.String({ maxLength: 2000 })
        })
    })

    .delete("/:id", async ({ params, user, status }) => {
        const [comment] = await sql`SELECT id, user_id FROM comments WHERE id = ${params.id}`;
        if (!comment) {
            return status(404, {
                error: "Comment not found"
            });
        }
        if (Number(comment.user_id) !== user.id && user.admin < 1) {
            return status(403, {
                error: "not allowed"
            });
        }
        await sql`DELETE FROM comments WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        })
    });
