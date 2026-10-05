import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { bool } from "./respond";

const iso = (t: any) => (Number(t) > 0 ? new Date(Number(t) * 1000).toISOString() : "2016-01-01T00:00:00.000Z");


const owns = t.Object({
    userId: t.Numeric(),
    assetId: t.Numeric()
});

const ownsAsset = async (userId: number, assetId: number) => {
    const [row] = await sql`
        SELECT 1 FROM user_items
        JOIN catalog_items ON catalog_items.id = user_items.item_id
        WHERE user_items.user_id = ${userId}
        AND (catalog_items.id = ${assetId} OR catalog_items.asset_id = ${assetId})
        LIMIT 1
    `;
    return bool(!!row);
};

export const marketplace = new Elysia()
    .use(session)



    .get("/marketplace/productinfo", async ({ query }) => {
        const id = query.assetId;
        const [item] = await sql`SELECT * FROM catalog_items WHERE id = ${id}`;
        const [game] = item ? [] : await sql`SELECT * FROM games WHERE id = ${id}`;
        const [pass] = item || game ? [] : await sql`SELECT * FROM game_passes WHERE id = ${id}`;

        let creator = {
            Id: 1,
            Name: "NoneRev",
            CreatorType: "User",
            CreatorTargetId: 1
        };
        const creatorId = Number(item?.creator_id ?? game?.creator_id ?? pass?.creator_id ?? 0);
        if (creatorId > 0) {
            const [u] = await sql`SELECT id, username FROM users WHERE id = ${creatorId}`;
            if (u) {
                creator = {
                    Id: u.id,
                    Name: u.username,
                    CreatorType: "User",
                    CreatorTargetId: u.id
                };
            }
        }

        let sales = 0;
        if (item) {
            sales = Number(item.limited_sold);
        } else if (pass) {
            const [n] = await sql`SELECT COUNT(*)::int AS n FROM user_game_passes WHERE pass_id = ${id}`;
            sales = Number(n.n);
        }

        const source = item ?? pass;
        const limitedU = !!item?.is_limited_unique;
        const remaining = item && limitedU && item.limited_stock !== null ? Math.max(0, Number(item.limited_stock) - Number(item.limited_sold)) : null;
        const price = source && source.price !== null ? Number(source.price) : null;

        return {
            AssetId: id,
            ProductId: id,
            Name: item?.name ?? game?.title ?? pass?.name ?? "",
            Description: item?.description ?? pass?.description ?? "",

            AssetTypeId: game ? 9 : pass ? 34 : 1,
            Creator: creator,
            IconImageAssetId: id,
            Created: iso(source?.created_at),
            Updated: iso(source?.updated_at ?? source?.created_at),
            PriceInRobux: price,
            PriceInTickets: null,
            Sales: sales,
            IsNew: false,
            IsForSale: item ? price !== null && (!limitedU || (remaining ?? 0) > 0) : pass ? price !== null : false,
            IsPublicDomain: false,
            IsLimited: !!(item?.is_limited || item?.is_limited_unique),
            IsLimitedUnique: limitedU,
            Remaining: remaining,
            MinimumMembershipLevel: 0,
            ContentRatingTypeId: 0
        };
    }, {
        query: t.Object({
            assetId: t.Numeric()
        })
    })


    .get("/marketplace/productDetails", () => ({}), {
        query: t.Object({
            productId: t.Numeric()
        })
    })

    .get("/gametransactions/getpendingtransactions/", () => [])


    .get("/ownership/hasAsset", ({ query }) => ownsAsset(query.userId, query.assetId), { query: owns })
    .get("/ownership/hasasset", ({ query }) => ownsAsset(query.userId, query.assetId), { query: owns })

    .get("/currency/balance", ({ user }) => ({
        robux: user ? user.currency : 0
    }))
