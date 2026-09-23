import { Elysia, t } from "elysia";
import { stub } from "../stub";

const id = t.Object({
    id: t.Numeric()
});
const list = t.Object({
    q: t.Optional(t.String()),
    page: t.Optional(t.Numeric())
});

const banner = t.Object({
    message: t.String(),
    linkText: t.Optional(t.String()),
    linkUrl: t.Optional(t.String()),
    style: t.Optional(t.String()),
    enabled: t.Optional(t.Boolean()),
    dismissible: t.Optional(t.Boolean()),
    startsAt: t.Optional(t.String()),
    endsAt: t.Optional(t.String())
});

const post = t.Object({
    title: t.String(),
    excerpt: t.Optional(t.String()),
    body: t.String(),
    category: t.String(),
    is_published: t.Optional(t.Boolean()),
    image: t.Optional(t.File({ type: "image" }))
});

// creator is a username
// TODO: fill name/desc/category/thumb from roblox if only asset_id is given
const item = t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String()),
    creator: t.String(),
    category: t.Optional(t.String()),
    asset_id: t.Optional(t.Numeric()),
    price: t.Optional(t.Numeric({ minimum: 0 })),
    thumbnail: t.Optional(t.String()),
    is_featured: t.Optional(t.Boolean()),
    is_limited: t.Optional(t.Boolean()),
    is_limited_unique: t.Optional(t.Boolean()),
    limited_stock: t.Optional(t.Numeric({ minimum: 0 }))
});

// TODO: admin check on everything here
export const admin = new Elysia({ prefix: "/api/admin" })
    // banners
    .get("/banners", stub)

    .post("/banners", stub, {
        body: banner
    })

    .patch("/banners/:id", stub, {
        params: id,
        body: banner
    })

    .post("/banners/:id/toggle", stub, {
        params: id
    })

    .delete("/banners/:id", stub, {
        params: id
    })

    // blog, drafts too
    .get("/blog", stub)

    .post("/blog", stub, {
        body: post
    })

    .patch("/blog/:id", stub, {
        params: id,
        body: post
    })

    .delete("/blog/:id/image", stub, {
        params: id
    })

    .delete("/blog/:id", stub, {
        params: id
    })

    // catalog
    .get("/catalog", stub, {
        query: list
    })

    .post("/catalog", stub, {
        body: item
    })

    .patch("/catalog/:id", stub, {
        params: id,
        body: item
    })

    .delete("/catalog/:id", stub, {
        params: id
    })

    // invite keys, no cooldown for admins
    .get("/invitekeys", stub, {
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/invitekeys", stub)

    .delete("/invitekeys/:id", stub, {
        params: id
    })

    // moderation
    .get("/moderation", stub, {
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })

    .post("/moderation", stub, {
        body: t.Object({
            username: t.String(),
            type: t.Union([
                t.Literal("warning"),
                t.Literal("ban1d"),
                t.Literal("ban3d"),
                t.Literal("ban7d"),
                t.Literal("ban14d"),
                t.Literal("account_deletion")
            ]),
            reason: t.String()
        })
    })

    // undo, id is the user
    .delete("/moderation/:id", stub, {
        params: id
    })

    // users
    .get("/users", stub, {
        query: list
    })

    .patch("/users/:id", stub, {
        params: id,
        body: t.Object({
            admin_level: t.Optional(t.Numeric({ minimum: 0 })),
            currency: t.Optional(t.Numeric({ minimum: 0 }))
        })
    })
