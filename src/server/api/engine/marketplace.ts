import { Elysia, t } from "elysia";
import { session, type User } from "../../session";
import { sql, now } from "../../db";
import { bool } from "./respond";
import { isInternal } from "./internal";
import { PurchaseError, buyItem, buyPass, buyProduct } from "../../purchase";

const iso = (t: any) => (Number(t) > 0 ? new Date(Number(t) * 1000).toISOString() : "2016-01-01T00:00:00.000Z");

// a pass is sold as product 1000000000 + its id, catalog items keep their own id
const PASS_PRODUCTS = 1000000000;
const TIX = 2;

const ASSET_TYPES: Record<string, number> = {
    "T-Shirt": 2,
    Hat: 8,
    Shirt: 11,
    Pants: 12,
    Face: 18,
    Gear: 19,
    Package: 32
};

const NONEREV = {
    Id: 1,
    Name: "NoneRev",
    CreatorType: "User",
    CreatorTargetId: 1
};

type Kind = "item" | "pass" | "place";

const placeOf = async (userId: number) => {
    const [visit] = await sql`SELECT game_id FROM game_visit_sessions WHERE user_id = ${userId} ORDER BY started_at DESC LIMIT 1`;
    return visit ? Number(visit.game_id) : 0;
};

// catalog items, places and passes all count from 1, so the game asking gets its own passes and place first
const findAsset = async (id: number, placeId: number, places = true) => {
    const [found] = await sql`
        SELECT kind, id FROM (
            SELECT 'pass' AS kind, id, 0 AS rank FROM game_passes WHERE id = ${id} AND game_id = ${placeId}
            UNION ALL SELECT 'place', id, 1 FROM games WHERE id = ${id} AND id = ${placeId} AND ${places}
            UNION ALL SELECT 'item', id, 2 FROM catalog_items WHERE id = ${id}
            UNION ALL SELECT 'pass', id, 3 FROM game_passes WHERE id = ${id}
            UNION ALL SELECT 'place', id, 4 FROM games WHERE id = ${id} AND ${places}
            UNION ALL SELECT 'item', id, 5 FROM catalog_items WHERE asset_id = ${id}
        ) found
        ORDER BY rank, id LIMIT 1
    `;
    return found as { kind: Kind; id: number } | undefined;
};

const creatorOf = async (userId: number) => {
    const [u] = await sql`SELECT id, username FROM users WHERE id = ${userId}`;
    if (!u) {
        return NONEREV;
    }
    return {
        Id: u.id,
        Name: u.username,
        CreatorType: "User",
        CreatorTargetId: u.id
    };
};

const info = (assetId: number, fields: Record<string, unknown>) => ({
    AssetId: assetId,
    ProductId: 0,
    Name: "",
    Description: "",
    AssetTypeId: 1,
    Creator: NONEREV,
    IconImageAssetId: assetId,
    Created: iso(0),
    Updated: iso(0),
    PriceInRobux: null,
    PriceInTickets: null,
    Sales: 0,
    IsNew: false,
    IsForSale: false,
    IsPublicDomain: false,
    IsLimited: false,
    IsLimitedUnique: false,
    Remaining: null,
    MinimumMembershipLevel: 0,
    ContentRatingTypeId: 0,
    ...fields
});

const price = (value: unknown) => (value === null ? null : Number(value));

const describe: Record<Kind, (assetId: number, id: number) => Promise<object>> = {
    item: async (assetId, id) => {
        const [item] = await sql`SELECT * FROM catalog_items WHERE id = ${id}`;
        const limitedU = !!item.is_limited_unique;
        const remaining = limitedU && item.limited_stock !== null ? Math.max(0, Number(item.limited_stock) - Number(item.limited_sold)) : null;
        const robux = price(item.price);
        const tix = price(item.tix_price);
        return info(assetId, {
            ProductId: Number(item.id),
            Name: item.name,
            Description: item.description,
            AssetTypeId: ASSET_TYPES[item.category] ?? 1,
            Creator: await creatorOf(Number(item.creator_id)),
            Created: iso(item.created_at),
            Updated: iso(item.updated_at),
            PriceInRobux: robux,
            PriceInTickets: tix,
            Sales: Number(item.limited_sold),
            IsForSale: (robux !== null || tix !== null) && (!limitedU || (remaining ?? 0) > 0),
            IsLimited: !!(item.is_limited || item.is_limited_unique),
            IsLimitedUnique: limitedU,
            Remaining: remaining,
            MinimumMembershipLevel: item.bc_only ? 1 : 0
        });
    },

    pass: async (assetId, id) => {
        const [pass] = await sql`SELECT * FROM game_passes WHERE id = ${id}`;
        const [sales] = await sql`SELECT COUNT(*)::int AS n FROM user_game_passes WHERE pass_id = ${id}`;
        const robux = price(pass.price);
        return info(assetId, {
            ProductId: PASS_PRODUCTS + Number(pass.id),
            Name: pass.name,
            Description: pass.description,
            AssetTypeId: 34,
            Creator: await creatorOf(Number(pass.creator_id)),
            Created: iso(pass.created_at),
            Updated: iso(pass.updated_at),
            PriceInRobux: robux,
            Sales: Number(sales.n),
            IsForSale: robux !== null
        });
    },

    place: async (assetId, id) => {
        const [game] = await sql`SELECT * FROM games WHERE id = ${id}`;
        return info(assetId, {
            Name: game.title,
            Description: game.description,
            AssetTypeId: 9,
            Creator: await creatorOf(Number(game.creator_id)),
            Created: iso(game.created_at),
            Updated: iso(game.updated_at)
        });
    }
};

const ownsAsset = async (query: { userId: number; assetId: number; placeId?: number }) => {
    const found = await findAsset(query.assetId, query.placeId ?? await placeOf(query.userId), false);
    if (!found) {
        return bool(false);
    }
    const [row] = found.kind === "pass"
        ? await sql`SELECT 1 FROM user_game_passes WHERE user_id = ${query.userId} AND pass_id = ${found.id}`
        : await sql`SELECT 1 FROM user_items WHERE user_id = ${query.userId} AND item_id = ${found.id}`;
    return bool(!!row);
};

const buy = (user: User, productId: number, currencyTypeId?: number, expected?: number) => {
    if (productId <= PASS_PRODUCTS) {
        return buyItem(user, productId, currencyTypeId === TIX ? "tix" : "nonebux", expected);
    }
    if (currencyTypeId === TIX) {
        throw new PurchaseError("NotForSale", "Game passes are sold for Nonebux only.");
    }
    return buyPass(user.id, productId - PASS_PRODUCTS, expected);
};

const failed = (err: unknown) => {
    if (err instanceof PurchaseError) {
        return {
            success: false,
            status: err.status
        };
    }
    throw err;
};

const owns = t.Object({
    userId: t.Numeric(),
    assetId: t.Numeric(),
    placeId: t.Optional(t.Numeric())
});

const purchaseForm = t.Object({
    productId: t.Optional(t.Numeric()),
    currencyTypeId: t.Optional(t.Numeric()),
    purchasePrice: t.Optional(t.Numeric()),
    locationType: t.Optional(t.String()),
    locationId: t.Optional(t.Numeric())
});

const productForm = t.Object({
    productId: t.Optional(t.Numeric()),
    currencyTypeId: t.Optional(t.Numeric()),
    expectedUnitPrice: t.Optional(t.Numeric()),
    placeId: t.Optional(t.Numeric()),
    requestId: t.Optional(t.String())
});

const receiptForm = t.Object({
    receipt: t.Optional(t.String())
});

export const marketplace = new Elysia()
    .use(session)

    .get("/marketplace/productinfo", async ({ query, user }) => {
        const found = await findAsset(query.assetId, query.placeId ?? (user ? await placeOf(user.id) : 0));
        return found ? describe[found.kind](query.assetId, Number(found.id)) : info(query.assetId, {});
    }, {
        query: t.Object({
            assetId: t.Numeric(),
            placeId: t.Optional(t.Numeric())
        })
    })

    .get("/marketplace/productDetails", async ({ query, status }) => {
        const [product] = await sql`SELECT * FROM developer_products WHERE id = ${query.productId}`;
        if (!product) {
            return status(404, {
                error: "not found"
            });
        }
        const [sales] = await sql`SELECT COUNT(*)::int AS n FROM product_receipts WHERE product_id = ${product.id}`;
        const robux = price(product.price);
        return info(0, {
            ProductId: Number(product.id),
            Name: product.name,
            Description: product.description,
            AssetTypeId: 0,
            Creator: await creatorOf(Number(product.creator_id)),
            IconImageAssetId: Number(product.icon_asset_id),
            Created: iso(product.created_at),
            Updated: iso(product.updated_at),
            PriceInRobux: robux,
            Sales: Number(sales.n),
            IsForSale: robux !== null
        });
    }, {
        query: t.Object({
            productId: t.Numeric()
        })
    })

    .post("/marketplace/purchase", async ({ query, body, user, status }) => {
        if (!user) {
            return status(401, {
                success: false,
                status: "NotAuthorized"
            });
        }
        const form = {
            ...query,
            ...body
        };
        try {
            await buy(user, form.productId ?? 0, form.currencyTypeId, form.purchasePrice);
        } catch (err) {
            return failed(err);
        }
        return {
            success: true,
            status: "Bought"
        };
    }, {
        query: purchaseForm,
        body: t.Optional(purchaseForm)
    })

    .post("/marketplace/submitpurchase", async ({ query, body, user, status }) => {
        if (!user) {
            return status(401, {
                success: false,
                status: "NotAuthorized"
            });
        }
        const form = {
            ...query,
            ...body
        };
        if (form.currencyTypeId === TIX) {
            return {
                success: false,
                status: "NotForSale"
            };
        }
        try {
            return {
                success: true,
                receipt: await buyProduct(user.id, form.productId ?? 0, form.placeId ?? 0, form.expectedUnitPrice)
            };
        } catch (err) {
            return failed(err);
        }
    }, {
        query: productForm,
        body: t.Optional(productForm)
    })

    .guard({
        beforeHandle({ request, server, status }) {
            if (!isInternal(request, server)) {
                return status(403, {
                    error: "game servers only"
                });
            }
        }
    }, app => app
        .all("/marketplace/validatepurchase", async ({ query }) => {
            const [receipt] = await sql`SELECT * FROM product_receipts WHERE receipt = ${query.receipt} AND status = 'pending'`;
            return {
                playerId: receipt ? Number(receipt.user_id) : 0,
                placeId: receipt ? Number(receipt.game_id) : 0,
                isValid: !!receipt,
                productId: receipt ? Number(receipt.product_id) : 0
            };
        }, {
            query: t.Object({
                receipt: t.String()
            })
        })

        .get("/gametransactions/getpendingtransactions", async ({ query }) => {
            const rows = await sql`
                SELECT * FROM product_receipts
                WHERE game_id = ${query.PlaceId} AND user_id = ${query.PlayerId} AND status = 'pending'
                ORDER BY id
            `;
            return rows.map((r: any) => ({
                playerId: Number(r.user_id),
                placeId: Number(r.game_id),
                receipt: r.receipt,
                actionArgs: [
                    {
                        Key: "productId",
                        Value: String(r.product_id)
                    },
                    {
                        Key: "currencyTypeId",
                        Value: "1"
                    },
                    {
                        Key: "unitPrice",
                        Value: String(r.price)
                    }
                ]
            }));
        }, {
            query: t.Object({
                PlaceId: t.Numeric(),
                PlayerId: t.Numeric()
            })
        })

        .post("/gametransactions/settransactionstatuscomplete", async ({ query, body }) => {
            const done = await sql`
                UPDATE product_receipts SET status = 'complete', completed_at = ${now()}
                WHERE receipt = ${body?.receipt ?? query.receipt ?? ""} AND status = 'pending'
            `;
            return {
                success: done.count > 0
            };
        }, {
            query: receiptForm,
            body: t.Optional(receiptForm)
        })
    )

    .get("/ownership/hasAsset", ({ query }) => ownsAsset(query), { query: owns })
    .get("/ownership/hasasset", ({ query }) => ownsAsset(query), { query: owns })

    .get("/currency/balance", ({ user }) => ({
        robux: user ? user.currency : 0,
        tickets: user ? user.tix : 0
    }))
