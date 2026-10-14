import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";

const PER_PAGE = 20;
const MAX_ITEMS_PER_SIDE = 8;
const EXPIRES_AFTER = 5 * 24 * 60 * 60;

const id = t.Object({
    id: t.Numeric()
});

class TradeError extends Error {}

const handle = (err: unknown, status: any) => {
    if (err instanceof TradeError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

const expirePending = () => sql`UPDATE trades SET status = 'expired' WHERE status = 'pending' AND expires_at <= ${now()}`;


const normalize = (items: number[]) => [...new Set(items.filter(i => i > 0))].slice(0, MAX_ITEMS_PER_SIDE);

const assertOwnsLimiteds = async (tx: any, userId: number, items: number[]) => {
    for (const itemId of items) {
        const [row] = await tx`
            SELECT 1 FROM user_items JOIN catalog_items ON catalog_items.id = user_items.item_id
            WHERE user_items.user_id = ${userId} AND user_items.item_id = ${itemId}
            AND (catalog_items.is_limited = 1 OR catalog_items.is_limited_unique = 1)
        `;
        if (!row) {
            throw new TradeError("Only Limited or Limited U items can be traded.");
        }
    }
};

const assertDoesNotOwn = async (tx: any, userId: number, items: number[]) => {
    for (const itemId of items) {
        const [row] = await tx`SELECT 1 FROM user_items WHERE user_id = ${userId} AND item_id = ${itemId}`;
        if (row) {
            const [item] = await tx`SELECT name FROM catalog_items WHERE id = ${itemId}`;
            throw new TradeError(`The receiving user already owns ${item?.name ?? "that item"}.`);
        }
    }
};

const tradeRows = (where: any) => sql`
    SELECT trades.*, s.username AS sender_name, r.username AS receiver_name FROM trades
    JOIN users s ON s.id = trades.sender_id
    JOIN users r ON r.id = trades.receiver_id
    ${where}
`;

const tradeItems = async (tradeId: number) => {
    const rows = await sql`
        SELECT trade_items.side, trade_items.original_owner_id, catalog_items.* FROM trade_items
        JOIN catalog_items ON catalog_items.id = trade_items.item_id
        WHERE trade_items.trade_id = ${tradeId}
        ORDER BY trade_items.side, trade_items.item_id
    `;
    return {
        offer: rows.filter((r: any) => r.side === "offer"),
        request: rows.filter((r: any) => r.side === "request")
    };
};

const tradeListRows = async (where: any) => {
    const trades = await tradeRows(where);
    if (trades.length === 0) return trades;
    const ids = trades.map((row: any) => Number(row.id));
    const items = await sql`
        SELECT trade_items.trade_id, trade_items.side, catalog_items.id, catalog_items.name
        FROM trade_items JOIN catalog_items ON catalog_items.id = trade_items.item_id
        WHERE trade_items.trade_id IN ${sql(ids)}
        ORDER BY trade_items.trade_id, trade_items.side, catalog_items.id
    `;
    return trades.map((row: any) => ({
        ...row,
        items: {
            offer: items.filter((item: any) => Number(item.trade_id) === Number(row.id) && item.side === "offer"),
            request: items.filter((item: any) => Number(item.trade_id) === Number(row.id) && item.side === "request")
        }
    }));
};

const limitedsOf = (userId: number) => sql`
    SELECT catalog_items.*, user_items.serial_number FROM user_items
    JOIN catalog_items ON catalog_items.id = user_items.item_id
    WHERE user_items.user_id = ${userId} AND (catalog_items.is_limited = 1 OR catalog_items.is_limited_unique = 1)
    ORDER BY user_items.purchased_at DESC, catalog_items.id DESC
`;

const typeWhere = (type: string, userId: number) => {
    switch (type) {
        case "outbound":
            return sql`trades.sender_id = ${userId} AND trades.status = 'pending'`;
        case "completed":
            return sql`(trades.sender_id = ${userId} OR trades.receiver_id = ${userId}) AND trades.status = 'completed'`;
        case "inactive":
            return sql`(trades.sender_id = ${userId} OR trades.receiver_id = ${userId}) AND trades.status IN ('declined', 'cancelled', 'expired', 'countered')`;
        default:
            return sql`trades.receiver_id = ${userId} AND trades.status = 'pending'`;
    }
};

export const trade = new Elysia({ prefix: "/api/trade" })
    .use(session)

    .get("/", async ({ query, user }) => {
        await expirePending();

        if (query.with) {
            return {
                mine: await limitedsOf(user.id),
                theirs: await limitedsOf(query.with)
            };
        }

        const type = ["inbound", "outbound", "completed", "inactive"].includes(query.type ?? "") ? query.type! : "inbound";
        const where = typeWhere(type, user.id);
        const [count] = await sql`SELECT COUNT(*)::int AS n FROM trades WHERE ${where}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
        const [inbound] = await sql`SELECT COUNT(*)::int AS n FROM trades WHERE ${typeWhere("inbound", user.id)}`;

        return {
            type,
            page,
            totalPages,
            inboundCount: Number(inbound.n),
            trades: await tradeListRows(sql`WHERE ${where} ORDER BY trades.created_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`)
        };
    }, {
        auth: true,
        query: t.Object({
            type: t.Optional(t.String()),
            page: t.Optional(t.Numeric()),
            with: t.Optional(t.Numeric())
        })
    })

    .get("/:id", async ({ params, user, status }) => {
        await expirePending();
        const [trade] = await tradeRows(sql`WHERE trades.id = ${params.id}`);
        if (!trade || (Number(trade.sender_id) !== user.id && Number(trade.receiver_id) !== user.id)) {
            return status(404, {
                error: "That trade does not exist."
            });
        }
        return {
            ...trade,
            ...await tradeItems(params.id)
        };
    }, {
        auth: true,
        params: id
    })

    .post("/", async ({ body, user, status }) => {
        try {
            const receiverId = body.receiver_id;
            const offer = normalize(body.offer_items);
            const request = normalize(body.request_items);
            const counterOf = body.counter_of ?? 0;

            if (receiverId <= 0 || receiverId === user.id) {
                throw new TradeError("You cannot trade with that user.");
            }
            const [receiver] = await sql`SELECT id FROM users WHERE id = ${receiverId}`;
            if (!receiver) {
                throw new TradeError("That user does not exist.");
            }
            if (offer.length === 0 || request.length === 0) {
                throw new TradeError("A trade needs at least one item on each side.");
            }

            const tradeId = await sql.begin(async tx => {
                await assertOwnsLimiteds(tx, user.id, offer);
                await assertOwnsLimiteds(tx, receiverId, request);
                await assertDoesNotOwn(tx, receiverId, offer);
                await assertDoesNotOwn(tx, user.id, request);

                if (counterOf > 0) {
                    const [original] = await tx`SELECT * FROM trades WHERE id = ${counterOf} FOR UPDATE`;
                    if (!original || original.status !== "pending" || Number(original.receiver_id) !== user.id || Number(original.sender_id) !== receiverId) {
                        throw new TradeError("That trade can no longer be countered.");
                    }
                    await tx`UPDATE trades SET status = 'countered' WHERE id = ${counterOf}`;
                }

                const created = await tx`INSERT INTO trades (sender_id, receiver_id, status, counter_of, created_at, expires_at, completed_at) VALUES (${user.id}, ${receiverId}, 'pending', ${counterOf > 0 ? counterOf : null}, ${now()}, ${now() + EXPIRES_AFTER}, 0) RETURNING id`;
                const tradeId = Number(created[0].id);
                for (const itemId of offer) {
                    await tx`INSERT INTO trade_items (trade_id, side, item_id, original_owner_id) VALUES (${tradeId}, 'offer', ${itemId}, ${user.id})`;
                }
                for (const itemId of request) {
                    await tx`INSERT INTO trade_items (trade_id, side, item_id, original_owner_id) VALUES (${tradeId}, 'request', ${itemId}, ${receiverId})`;
                }
                return tradeId;
            });

            return {
                ok: true,
                id: tradeId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            receiver_id: t.Numeric(),
            offer_items: t.Array(t.Numeric()),
            request_items: t.Array(t.Numeric()),
            counter_of: t.Optional(t.Numeric())
        })
    })

    .post("/:id/accept", async ({ params, user, status }) => {
        try {
            await sql.begin(async tx => {
                const [trade] = await tx`SELECT * FROM trades WHERE id = ${params.id} FOR UPDATE`;
                if (!trade || trade.status !== "pending" || Number(trade.receiver_id) !== user.id) {
                    throw new TradeError("That trade can no longer be accepted.");
                }
                if (Number(trade.expires_at) <= now()) {
                    await tx`UPDATE trades SET status = 'expired' WHERE id = ${params.id}`;
                    throw new TradeError("That trade has expired.");
                }

                const senderId = Number(trade.sender_id);
                const items = await tx`SELECT side, item_id FROM trade_items WHERE trade_id = ${params.id}`;
                const offer = items.filter((i: any) => i.side === "offer").map((i: any) => Number(i.item_id));
                const request = items.filter((i: any) => i.side === "request").map((i: any) => Number(i.item_id));

                await assertOwnsLimiteds(tx, senderId, offer);
                await assertOwnsLimiteds(tx, user.id, request);
                await assertDoesNotOwn(tx, user.id, offer);
                await assertDoesNotOwn(tx, senderId, request);

                for (const itemId of offer) {
                    const moved = await tx`UPDATE user_items SET user_id = ${user.id}, wearing = 0, purchased_at = ${now()} WHERE user_id = ${senderId} AND item_id = ${itemId}`;
                    if (moved.count !== 1) {
                        throw new TradeError("An offered item is no longer available.");
                    }
                    await tx`DELETE FROM resale_listings WHERE user_id = ${senderId} AND item_id = ${itemId}`;
                }
                for (const itemId of request) {
                    const moved = await tx`UPDATE user_items SET user_id = ${senderId}, wearing = 0, purchased_at = ${now()} WHERE user_id = ${user.id} AND item_id = ${itemId}`;
                    if (moved.count !== 1) {
                        throw new TradeError("A requested item is no longer available.");
                    }
                    await tx`DELETE FROM resale_listings WHERE user_id = ${user.id} AND item_id = ${itemId}`;
                }
                await tx`UPDATE trades SET status = 'completed', completed_at = ${now()} WHERE id = ${params.id}`;
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })

    .post("/:id/decline", async ({ params, user, status }) => {
        const done = await sql`UPDATE trades SET status = 'declined' WHERE id = ${params.id} AND receiver_id = ${user.id} AND status = 'pending'`;
        if (done.count !== 1) {
            return status(400, {
                error: "That trade can no longer be declined."
            });
        }
        return {
            ok: true
        };
    }, {
        auth: true,
        params: id
    })

    .post("/:id/cancel", async ({ params, user, status }) => {
        const done = await sql`UPDATE trades SET status = 'cancelled' WHERE id = ${params.id} AND sender_id = ${user.id} AND status = 'pending'`;
        if (done.count !== 1) {
            return status(400, {
                error: "That trade can no longer be cancelled."
            });
        }
        return {
            ok: true
        };
    }, {
        auth: true,
        params: id
    })
