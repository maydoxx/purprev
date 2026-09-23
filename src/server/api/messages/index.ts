import { Elysia, t } from "elysia";
import { stub } from "../stub";

export const messages = new Elysia({ prefix: "/api/messages" })
    .get("/", stub, {
        query: t.Object({
            tab: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    // navbar badge
    .get("/unread", stub)

    // marks it read
    .get("/:id", stub, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    // to is a username
    .post("/", stub, {
        body: t.Object({
            to: t.String(),
            subject: t.String(),
            body: t.String()
        })
    })

    .post("/bulk", stub, {
        body: t.Object({
            action: t.Union([
                t.Literal("archive"),
                t.Literal("restore"),
                t.Literal("read"),
                t.Literal("unread")
            ]),
            message_ids: t.Array(t.Numeric())
        })
    })
