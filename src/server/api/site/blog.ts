import { Elysia, t } from "elysia";
import { stub } from "../stub";

// published only, drafts are in admin
export const blog = new Elysia({ prefix: "/blog" })
    .get("/", stub, {
        query: t.Object({
            category: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/:id", stub, {
        params: t.Object({
            id: t.Numeric()
        })
    })
