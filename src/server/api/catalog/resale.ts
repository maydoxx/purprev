import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { rcc } from "../../rcc";

export const MARKETPLACE_FEE = 0.3;

const DAY = 86400;

class ResaleError extends Error {}

export const isResellable = (item: any) => !!(item.is_limited || item.is_limited_unique);

export const marketplaceFee = (price: number) => price > 0 ? Math.max(1, Math.round(price * MARKETPLACE_FEE)) : 0;

const listingsOf = (itemId: number) => sql`
    SELECT resale_listings.id, resale_listings.user_id, resale_listings.price, resale_listings.listed_at,
        users.username, users.membership, user_items.serial_number
    FROM resale_listings
    JOIN user_items ON user_items.user_id = resale_listings.user_id AND user_items.item_id = resale_listings.item_id
    JOIN users ON users.id = resale_listings.user_id
    WHERE resale_listings.item_id = ${itemId}
    ORDER BY resale_listings.price ASC, resale_listings.listed_at ASC
`;

const periodStats = (sales: any[], days: number, since: number) => {
    const cutoff = since - days * DAY;
    const inPeriod = sales.filter(s => Number(s.sold_at) >= cutoff);
    const before = sales.filter(s => Number(s.sold_at) < cutoff && Number(s.sold_at) >= cutoff - days * DAY);
    const avg = (rows: any[]) => rows.length ? Math.round(rows.reduce((a, s) => a + Number(s.price), 0) / rows.length) : null;
    const current = avg(inPeriod);
    const previous = avg(before);
    return {
        days,
        average: current,
        volume: inPeriod.length,
        change: current !== null && previous !== null && previous > 0 ? Math.round((current - previous) / previous * 1000) / 10 : null
    };
};

export const resale = new Elysia()
    .use(session)

    .get("/:id/resale", async ({ params, user, status }) => {
        const [item] = await sql`SELECT id, is_limited, is_limited_unique, limited_stock FROM catalog_items WHERE id = ${params.id}`;
        if (!item) {
            return status(404, {
                error: "This item does not exist"
            });
        }

        await sql`
            DELETE FROM resale_listings
            WHERE item_id = ${params.id}
            AND NOT EXISTS (SELECT 1 FROM user_items WHERE user_items.user_id = resale_listings.user_id AND user_items.item_id = resale_listings.item_id)
        `;
        const listings = isResellable(item) ? await listingsOf(params.id) : [];
        const sales = await sql`
            SELECT price, sold_at FROM resale_sales
            WHERE item_id = ${params.id} AND sold_at >= ${now() - 180 * DAY}
            ORDER BY sold_at ASC
        `;
        const recent = sales.slice(-10);
        const mine = user ? listings.find((l: any) => l.user_id === user.id) ?? null : null;

        return {
            resellable: isResellable(item),
            listings: listings.map((l: any) => ({
                id: l.id,
                user_id: l.user_id,
                username: l.username,
                membership: l.membership,
                serial_number: l.serial_number,
                price: Number(l.price),
                mine: user ? l.user_id === user.id : false
            })),
            listing: mine ? {
                id: mine.id,
                price: Number(mine.price)
            } : null,
            best_price: listings.length ? Number(listings[0].price) : null,
            sales: sales.map((s: any) => ({
                price: Number(s.price),
                sold_at: Number(s.sold_at)
            })),
            rap: recent.length ? Math.round(recent.reduce((a: number, s: any) => a + Number(s.price), 0) / recent.length) : null,
            periods: [30, 90, 180].map(days => periodStats(sales, days, now())),
            fee: MARKETPLACE_FEE
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .post("/:id/sell", async ({ params, body, user, status }) => {
        const price = Math.floor(body.price);
        if (!Number.isFinite(price) || price < 1 || price > 2147483647) {
            return status(400, {
                error: "Price must be a positive integer."
            });
        }
        if (user.membership === "None") {
            return status(403, {
                error: "Only Builders Club members may re-sell collectible items"
            });
        }
        const [item] = await sql`SELECT id, is_limited, is_limited_unique FROM catalog_items WHERE id = ${params.id}`;
        if (!item) {
            return status(404, {
                error: "This item does not exist"
            });
        }
        if (!isResellable(item)) {
            return status(400, {
                error: "This item cannot be re-sold"
            });
        }
        const [copy] = await sql`SELECT 1 FROM user_items WHERE user_id = ${user.id} AND item_id = ${params.id}`;
        if (!copy) {
            return status(400, {
                error: "You do not own this item"
            });
        }
        const [listed] = await sql`SELECT id FROM resale_listings WHERE user_id = ${user.id} AND item_id = ${params.id}`;
        if (listed) {
            return status(400, {
                error: "This item is already for sale"
            });
        }
        await sql`INSERT INTO resale_listings (user_id, item_id, price, listed_at) VALUES (${user.id}, ${params.id}, ${price}, ${now()})`;
        return {
            ok: true,
            price,
            fee: marketplaceFee(price)
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        }),
        body: t.Object({
            price: t.Numeric()
        })
    })

    .post("/:id/unsell", async ({ params, user, status }) => {
        const removed = await sql`DELETE FROM resale_listings WHERE user_id = ${user.id} AND item_id = ${params.id}`;
        if (!removed.affectedRows) {
            return status(400, {
                error: "This item is not for sale"
            });
        }
        return {
            ok: true
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        })
    })

    .post("/:id/buy-resale", async ({ params, body, user, status }) => {
        try {
            const result = await sql.begin(async tx => {
                const [listing] = await tx`SELECT * FROM resale_listings WHERE id = ${body.listingId} FOR UPDATE`;
                if (!listing || listing.item_id !== params.id) {
                    throw new ResaleError("This item is no longer for sale");
                }
                if (listing.user_id === user.id) {
                    throw new ResaleError("You cannot buy your own item");
                }
                const price = Number(listing.price);
                if (body.expectedPrice !== undefined && body.expectedPrice !== price) {
                    throw new ResaleError("The price of this item has changed. Please try again.");
                }

                const [item] = await tx`SELECT * FROM catalog_items WHERE id = ${params.id} FOR UPDATE`;
                if (!item || !isResellable(item)) {
                    throw new ResaleError("This item cannot be re-sold");
                }
                const [owned] = await tx`SELECT 1 FROM user_items WHERE user_id = ${user.id} AND item_id = ${params.id} FOR UPDATE`;
                if (owned) {
                    throw new ResaleError("You already own this item");
                }
                const [copy] = await tx`SELECT wearing FROM user_items WHERE user_id = ${listing.user_id} AND item_id = ${params.id} FOR UPDATE`;
                if (!copy) {
                    await tx`DELETE FROM resale_listings WHERE id = ${listing.id}`;
                    throw new ResaleError("This item is no longer for sale");
                }

                const [me] = await tx`SELECT currency FROM users WHERE id = ${user.id} FOR UPDATE`;
                if (Number(me.currency) < price) {
                    throw new ResaleError("You do not have enough Nonebux for this item");
                }
                const debit = await tx`UPDATE users SET currency = currency - ${price} WHERE id = ${user.id} AND currency >= ${price}`;
                if (!debit.affectedRows) {
                    throw new ResaleError("Your balance changed. Please try again.");
                }
                const fee = marketplaceFee(price);
                await tx`UPDATE users SET currency = LEAST(currency + ${price - fee}, 2147483647) WHERE id = ${listing.user_id}`;

                await tx`
                    UPDATE user_items SET user_id = ${user.id}, wearing = 0, purchased_at = ${now()}
                    WHERE user_id = ${listing.user_id} AND item_id = ${params.id}
                `;
                await tx`DELETE FROM resale_listings WHERE id = ${listing.id}`;
                await tx`
                    INSERT INTO resale_sales (item_id, seller_id, buyer_id, price, sold_at)
                    VALUES (${params.id}, ${listing.user_id}, ${user.id}, ${price}, ${now()})
                `;

                return {
                    sellerId: listing.user_id as number,
                    wasWorn: !!copy.wearing,
                    price,
                    fee,
                    balance: Number(me.currency) - price
                };
            });

            if (result.wasWorn) {
                rcc.render.avatar(result.sellerId);
            }
            return {
                ok: true,
                price: result.price,
                balance: result.balance
            };
        } catch (err) {
            if (err instanceof ResaleError) {
                return status(400, {
                    error: err.message
                });
            }
            throw err;
        }
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric()
        }),
        body: t.Object({
            listingId: t.Numeric(),
            expectedPrice: t.Optional(t.Numeric())
        })
    })
