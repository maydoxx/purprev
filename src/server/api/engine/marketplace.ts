import { Elysia, t } from "elysia";
import { bool } from "./respond";

export const marketplace = new Elysia()
    // GetProductInfo, catalog item > place > gamepass, else this fake one
    // AssetTypeId 9 = place, 34 = gamepass
    .get("/marketplace/productinfo", ({ query }) => ({
        AssetId: query.assetId,
        ProductId: query.assetId,
        Name: "",
        Description: "",
        AssetTypeId: 1,
        Creator: {
            Id: 1,
            Name: "NoneRev",
            CreatorType: "User",
            CreatorTargetId: 1
        },
        IconImageAssetId: query.assetId,
        Created: "2016-01-01T00:00:00.000Z",
        Updated: "2016-01-01T00:00:00.000Z",
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
        ContentRatingTypeId: 0
    }), {
        query: t.Object({
            assetId: t.Numeric()
        })
    })

    // LoadPlaceInfo points here
    .get("/marketplace/productDetails", () => ({}), {
        query: t.Object({
            productId: t.Numeric()
        })
    })

    // PlayerOwnsAsset
    .get("/ownership/hasAsset", () => bool(false), {
        query: t.Object({
            userId: t.Numeric(),
            assetId: t.Numeric()
        })
    })

    // TODO: real balance
    .get("/currency/balance", () => ({
        robux: 1
    }))
