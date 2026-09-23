import { Elysia, t } from "elysia";
import { stub } from "../stub";

const id = t.Object({
    id: t.Numeric()
});

// limiteds only, pending trades expire on their own
export const trade = new Elysia({ prefix: "/api/trade" })
    .get("/", stub, {
        query: t.Object({
            type: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/:id", stub, {
        params: id
    })

    // counter_of, the trade this one is a counter offer to
    .post("/", stub, {
        body: t.Object({
            receiver_id: t.Numeric(),
            offer_items: t.Array(t.Numeric()),
            request_items: t.Array(t.Numeric()),
            counter_of: t.Optional(t.Numeric())
        })
    })

    .post("/:id/accept", stub, {
        params: id
    })

    .post("/:id/decline", stub, {
        params: id
    })

    .post("/:id/cancel", stub, {
        params: id
    })
