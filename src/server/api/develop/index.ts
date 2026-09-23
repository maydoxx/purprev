import { Elysia, t } from "elysia";
import { stub } from "../stub";

const id = t.Object({
    id: t.Numeric()
});
const clothing = t.Union([
    t.Literal("shirts"),
    t.Literal("pants"),
    t.Literal("t-shirts")
]);
// no price = not for sale
const price = t.Optional(t.Numeric({ minimum: 0 }));

// everything in here is for logged in user
export const develop = new Elysia({ prefix: "/api/develop" })
    // places
    .get("/places", stub)

    .post("/places", stub, {
        body: t.Object({
            title: t.String(),
            place_file: t.Optional(t.File())
        })
    })

    .patch("/places/:id", stub, {
        params: id,
        body: t.Object({
            title: t.String()
        })
    })

    .delete("/places/:id", stub, {
        params: id
    })

    // chunked .rbxl upload, 768KB chunks, 50MB max
    .post("/places/:id/upload", stub, {
        params: id,
        body: t.Object({
            chunkIndex: t.Numeric(),
            chunkCount: t.Numeric(),
            originalName: t.String(),
            chunk: t.File()
        })
    })

    // upload your own thumbnail, creator or admin only
    // TODO: no image = re-render on rcc, thats for the rcc manager
    .post("/places/:id/thumbnail", stub, {
        params: id,
        body: t.Object({
            image: t.File({ type: "image" })
        })
    })

    // shirts, pants, t-shirts
    .get("/clothing/:category", stub, {
        params: t.Object({
            category: clothing
        })
    })

    .post("/clothing/:category", stub, {
        params: t.Object({
            category: clothing
        }),
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            texture_file: t.File({ type: "image" })
        })
    })

    .patch("/clothing/:category/:id", stub, {
        params: t.Object({
            category: clothing,
            id: t.Numeric()
        }),
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            texture_file: t.Optional(t.File({ type: "image" }))
        })
    })

    .delete("/clothing/:category/:id", stub, {
        params: t.Object({
            category: clothing,
            id: t.Numeric()
        })
    })

    // audio
    .get("/audio", stub)

    .post("/audio", stub, {
        body: t.Object({
            name: t.String(),
            audio_file: t.File()
        })
    })

    .delete("/audio/:id", stub, {
        params: id
    })

    // badges
    .get("/badges", stub)

    .post("/badges", stub, {
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .patch("/badges/:id", stub, {
        params: id,
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            enabled: t.Optional(t.Boolean()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .delete("/badges/:id", stub, {
        params: id
    })

    // game passes
    .get("/game-passes", stub)

    .post("/game-passes", stub, {
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .patch("/game-passes/:id", stub, {
        params: id,
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .delete("/game-passes/:id", stub, {
        params: id
    })
