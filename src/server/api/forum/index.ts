import { Elysia, t } from "elysia";
import { stub } from "../stub";

const id = t.Object({
    id: t.Numeric()
});
const page = t.Optional(t.Numeric());

export const forum = new Elysia({ prefix: "/api/forum" })
    // forum groups with their categories and the thread/post counts
    .get("/", stub)

    .get("/search", stub, {
        query: t.Object({
            q: t.String(),
            page
        })
    })

    // my threads + tracked threads
    .get("/my", stub)

    .get("/:id/threads", stub, {
        params: id,
        query: t.Object({
            q: t.Optional(t.String()),
            page
        })
    })

    // locked only works for forum mods
    .post("/:id/threads", stub, {
        params: id,
        body: t.Object({
            subject: t.String(),
            body: t.String(),
            locked: t.Optional(t.Boolean())
        })
    })

    // also counts a view
    .get("/threads/:id", stub, {
        params: id,
        query: t.Object({
            sort: t.Optional(t.Union([
                t.Literal("oldest"),
                t.Literal("newest")
            ])),
            page
        })
    })

    .post("/threads/:id/reply", stub, {
        params: id,
        body: t.Object({
            body: t.String(),
            locked: t.Optional(t.Boolean())
        })
    })

    .post("/threads/:id/track", stub, {
        params: id,
        body: t.Object({
            tracked: t.Boolean()
        })
    })

    // moderator only
    // pin and lock are toggles
    .post("/threads/:id/moderate", stub, {
        params: id,
        body: t.Object({
            action: t.Union([
                t.Literal("pin"),
                t.Literal("lock"),
                t.Literal("delete")
            ])
        })
    })

    .post("/threads/:id/move", stub, {
        params: id,
        body: t.Object({
            forum_id: t.Numeric()
        })
    })

    // subject only matters on the first post of a thread
    .patch("/posts/:id", stub, {
        params: id,
        body: t.Object({
            subject: t.Optional(t.String()),
            body: t.String()
        })
    })

    // deleting the first post deletes the thread
    .delete("/posts/:id", stub, {
        params: id
    })
