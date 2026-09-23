import { Elysia, t } from "elysia";
import { stub } from "../stub";

export const friends = new Elysia({ prefix: "/friends" })
    .get("/", stub, {
        query: t.Object({
            tab: t.Optional(t.Union([
                t.Literal("friends"),
                t.Literal("requests"),
                t.Literal("sent")
            ]))
        })
    })

    // decline also cancel the request
    // {ok, status, friendCount, pendingCount}
    .post("/", stub, {
        body: t.Object({
            action: t.Union([
                t.Literal("request"),
                t.Literal("accept"),
                t.Literal("decline"),
                t.Literal("remove")
            ]),
            userId: t.Numeric()
        })
    })
