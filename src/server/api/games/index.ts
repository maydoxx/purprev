import { Elysia, t } from "elysia";
import { stub } from "../stub";

const id = t.Object({
    id: t.Numeric()
});

export const games = new Elysia({ prefix: "/api/games" })
    .get("/", stub, {
        query: t.Object({
            q: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    // TODO: playing count from rcc manager
    .get("/:id", stub, {
        params: id
    })

    .get("/:id/badges", stub, {
        params: id
    })

    .get("/:id/passes", stub, {
        params: id
    })

    .post("/passes/:id/purchase", stub, {
        params: id
    })
