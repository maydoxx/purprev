import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { rcc } from "../../rcc";
import { CONTENT_KINDS, isContentKind, deleteContent, restoreContent, deletedIds, originalOf, type ContentKind } from "../../content";

const PER_PAGE = 20;

type List = {
    rows: any[];
    totalPages: number;
    page: number;
};

const paginate = async (count: number, page: number) => {
    const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));
    return {
        totalPages,
        page: Math.min(Math.max(1, page), totalPages)
    };
};

const places = async (like: string, page: number): Promise<List> => {
    const where = sql`(games.title ILIKE ${like} OR users.username ILIKE ${like})`;
    const [count] = await sql`SELECT COUNT(*)::int AS n FROM games LEFT JOIN users ON users.id = games.creator_id WHERE ${where}`;
    const meta = await paginate(Number(count.n), page);
    const rows = await sql`
        SELECT games.id, games.creator_id AS user_id, games.title AS text, games.created_at, users.username
        FROM games LEFT JOIN users ON users.id = games.creator_id
        WHERE ${where}
        ORDER BY games.id DESC LIMIT ${PER_PAGE} OFFSET ${(meta.page - 1) * PER_PAGE}
    `;
    return {
        ...meta,
        rows
    };
};

const audio = async (like: string, page: number): Promise<List> => {
    const where = sql`a.type = 'Audio' AND (a.name ILIKE ${like} OR u.username ILIKE ${like})`;
    const [count] = await sql`SELECT COUNT(*)::int AS n FROM assets a LEFT JOIN users u ON u.id = a.creator_id WHERE ${where}`;
    const meta = await paginate(Number(count.n), page);
    const rows = await sql`
        SELECT a.id, a.creator_id AS user_id, a.name AS text, a.created_at, u.username
        FROM assets a LEFT JOIN users u ON u.id = a.creator_id
        WHERE ${where}
        ORDER BY a.id DESC LIMIT ${PER_PAGE} OFFSET ${(meta.page - 1) * PER_PAGE}
    `;
    return {
        ...meta,
        rows
    };
};

const statuses = async (like: string, page: number): Promise<List> => {
    const where = sql`(s.body ILIKE ${like} OR u.username ILIKE ${like})`;
    const [count] = await sql`SELECT COUNT(*)::int AS n FROM status_updates s LEFT JOIN users u ON u.id = s.user_id WHERE ${where}`;
    const meta = await paginate(Number(count.n), page);
    const rows = await sql`
        SELECT s.id, s.user_id, s.body AS text, s.created_at, u.username
        FROM status_updates s LEFT JOIN users u ON u.id = s.user_id
        WHERE ${where}
        ORDER BY s.id DESC LIMIT ${PER_PAGE} OFFSET ${(meta.page - 1) * PER_PAGE}
    `;
    return {
        ...meta,
        rows
    };
};

const bios = async (like: string, page: number): Promise<List> => {
    const where = sql`u.about IS NOT NULL AND u.about <> '' AND (u.username ILIKE ${like} OR u.about ILIKE ${like})`;
    const [count] = await sql`SELECT COUNT(*)::int AS n FROM users u WHERE ${where}`;
    const meta = await paginate(Number(count.n), page);
    const rows = await sql`
        SELECT u.id, u.id AS user_id, u.about AS text, u.created_at, u.username
        FROM users u
        WHERE ${where}
        ORDER BY u.id DESC LIMIT ${PER_PAGE} OFFSET ${(meta.page - 1) * PER_PAGE}
    `;
    return {
        ...meta,
        rows
    };
};

const LISTS: Record<ContentKind, (like: string, page: number) => Promise<List>> = {
    place: places,
    audio,
    status: statuses,
    bio: bios
};

export const content = new Elysia({ prefix: "/api/admin/content" })
    .use(session)

    .get("/", async ({ query, status }) => {
        const kind = query.kind ?? "place";
        if (!isContentKind(kind)) {
            return status(400, {
                error: "Unknown content type."
            });
        }
        const like = `%${(query.q ?? "").trim()}%`;
        const { rows, totalPages, page } = await LISTS[kind](like, query.page ?? 1);
        const deleted = await deletedIds(kind, rows.map((row: any) => Number(row.id)));
        return {
            kind,
            kinds: CONTENT_KINDS,
            page,
            totalPages,
            items: rows.map((row: any) => ({
                id: Number(row.id),
                user_id: Number(row.user_id),
                username: row.username ?? "Unknown",
                text: row.text ?? "",
                created_at: Number(row.created_at ?? 0),
                deleted: deleted.has(Number(row.id))
            }))
        };
    }, {
        admin: true,
        query: t.Object({
            kind: t.Optional(t.String()),
            q: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .post("/delete", async ({ body, user, status }) => {
        const kind = body.kind;
        if (!isContentKind(kind)) {
            return status(400, {
                error: "Unknown content type."
            });
        }
        const reason = body.reason.trim();
        if (reason === "") {
            return status(400, {
                error: "Give a reason for the deletion."
            });
        }

        if (kind === "place") {
            const [game] = await sql`SELECT id, creator_id, title, description FROM games WHERE id = ${body.id}`;
            if (!game) {
                return status(404, {
                    error: "Place not found."
                });
            }
            await deleteContent({
                kind,
                targetId: body.id,
                userId: Number(game.creator_id),
                moderatorId: user.id,
                reason,
                original: {
                    title: game.title,
                    description: game.description
                }
            });
            await rcc.closePlace(body.id);
        } else if (kind === "audio") {
            const [asset] = await sql`SELECT id, name, creator_id FROM assets WHERE id = ${body.id} AND type = 'Audio'`;
            if (!asset) {
                return status(404, {
                    error: "Audio asset not found."
                });
            }
            await deleteContent({
                kind,
                targetId: body.id,
                userId: Number(asset.creator_id),
                moderatorId: user.id,
                reason,
                original: {
                    name: asset.name
                }
            });
        } else if (kind === "status") {
            const [row] = await sql`SELECT id, user_id, body FROM status_updates WHERE id = ${body.id}`;
            if (!row) {
                return status(404, {
                    error: "Status not found."
                });
            }
            await deleteContent({
                kind,
                targetId: body.id,
                userId: Number(row.user_id),
                moderatorId: user.id,
                reason,
                original: {
                    body: row.body
                }
            });
        } else {
            const [row] = await sql`SELECT id, about FROM users WHERE id = ${body.id}`;
            if (!row) {
                return status(404, {
                    error: "User not found."
                });
            }
            await deleteContent({
                kind,
                targetId: body.id,
                userId: Number(row.id),
                moderatorId: user.id,
                reason,
                original: {
                    about: row.about ?? ""
                }
            });
        }

        return {
            ok: true
        };
    }, {
        admin: true,
        body: t.Object({
            kind: t.String(),
            id: t.Numeric(),
            reason: t.String({
                maxLength: 500
            })
        })
    })

    .post("/restore", async ({ body, status }) => {
        if (!isContentKind(body.kind)) {
            return status(400, {
                error: "Unknown content type."
            });
        }
        const row = await restoreContent(body.kind, body.id);
        if (!row) {
            return status(404, {
                error: "That content isn't moderated."
            });
        }
        const original = originalOf(row);
        if (body.kind === "place") {
            const title = String(original.title ?? "").slice(0, 100);
            const description = String(original.description ?? "");
            await sql`UPDATE games SET title = ${title}, description = ${description} WHERE id = ${body.id}`;
        } else if (body.kind === "audio") {
            await sql`UPDATE assets SET name = ${String(original.name ?? "").slice(0, 100)} WHERE id = ${body.id}`;
        } else if (body.kind === "status") {
            await sql`UPDATE status_updates SET body = ${String(original.body ?? "").slice(0, 254)} WHERE id = ${body.id}`;
        } else {
            await sql`UPDATE users SET about = ${String(original.about ?? "")} WHERE id = ${body.id}`;
        }
        return {
            ok: true,
            original
        };
    }, {
        admin: true,
        body: t.Object({
            kind: t.String(),
            id: t.Numeric()
        })
    })
