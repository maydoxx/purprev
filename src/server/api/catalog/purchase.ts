import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";

class PurchaseError extends Error {}

export const purchase = new Elysia()
    .use(session)
    .post("/purchase", async ({ body, user, status }) => {
        try {
            const balance = await sql.begin(async tx => {
                const [item] = await tx`SELECT * FROM catalog_items WHERE id = ${body.itemId} FOR UPDATE`;
                if (!item) {
                    throw new PurchaseError("This item does not exist");
                }

                const [owned] = await tx`SELECT 1 FROM user_items WHERE user_id = ${user.id} AND item_id = ${body.itemId} FOR UPDATE`;
                if (owned) {
                    throw new PurchaseError("You already own this item");
                }
                const method = body.currency ?? "nonebux";
                const priceValue = method === "tix" ? item.tix_price : item.price;
                if (priceValue === null) {
                    throw new PurchaseError("This item is off sale");
                }
                if (item.bc_only && user.membership === "None") {
                    throw new PurchaseError("This item is for Builders Club members only");
                }

                const price = Number(priceValue);
                let serial: number | null = null;

                if (item.is_limited_unique) {
                    const stock = Number(item.limited_stock ?? 0);
                    const sold = Number(item.limited_sold);
                    if (stock <= 0 || sold >= stock) {
                        throw new PurchaseError("This Limited U item is sold out");
                    }
                    serial = sold + 1;
                }

                const [me] = await tx`SELECT currency, tix FROM users WHERE id = ${user.id} FOR UPDATE`;
                if (Number(method === "tix" ? me.tix : me.currency) < price) {
                    throw new PurchaseError(`You do not have enough ${method === "tix" ? "Tix" : "Nonebux"} for this item`);
                }

                if (price > 0) {
                    const debit = method === "tix"
                        ? await tx`UPDATE users SET tix = tix - ${price} WHERE id = ${user.id} AND tix >= ${price}`
                        : await tx`UPDATE users SET currency = currency - ${price} WHERE id = ${user.id} AND currency >= ${price}`;
                    if (!debit.affectedRows) {
                        throw new PurchaseError("Your balance changed. Please try again.");
                    }
                    if (item.creator_id && item.creator_id !== user.id) {
                        if (method === "tix") {
                            await tx`UPDATE users SET tix = LEAST(tix + ${price}, 2147483647) WHERE id = ${item.creator_id}`;
                        } else {
                            await tx`UPDATE users SET currency = currency + ${price} WHERE id = ${item.creator_id}`;
                        }
                    }
                }
                if (serial !== null) {
                    await tx`UPDATE catalog_items SET limited_sold = limited_sold + 1 WHERE id = ${body.itemId}`;
                }

                await tx`INSERT INTO user_items (user_id, item_id, wearing, purchased_at, serial_number) VALUES (${user.id}, ${body.itemId}, 0, ${now()}, ${serial})`;

                return {
                    balance: Number(me.currency) - (method === "nonebux" ? price : 0),
                    tixBalance: Number(me.tix) - (method === "tix" ? price : 0)
                };
            });

            return {
                ok: true,
                ...balance
            };
        } catch (err) {
            if (err instanceof PurchaseError) {
                return status(400, {
                    error: err.message
                });
            }
            throw err;
        }
    }, {
        auth: true,
        body: t.Object({
            itemId: t.Numeric(),
            currency: t.Optional(t.Union([
                t.Literal("nonebux"),
                t.Literal("tix")
            ]))
        })
    })
