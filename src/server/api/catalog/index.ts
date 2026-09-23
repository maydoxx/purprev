import { Elysia, t } from "elysia";
import { stub } from "../stub";

import { purchase } from "./purchase";

export const catalog = new Elysia({ prefix: "/api/catalog" })
    .use(purchase)

    .get("/", stub, {
        query: t.Object({
            q: t.Optional(t.String()),
            category: t.Optional(t.String()),
            sort: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    // item page, needs owner count and if you own it
    .get("/:id", stub, {
        params: t.Object({
            id: t.Numeric()
        })
    })
