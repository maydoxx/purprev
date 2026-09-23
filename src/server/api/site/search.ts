import { Elysia, t } from "elysia";
import { stub } from "../stub";

export const search = new Elysia({ prefix: "/search" })
    .get("/", stub, {
        query: t.Object({
            q: t.String(),
            type: t.Optional(t.Union([
                t.Literal("games"),
                t.Literal("user"),
                t.Literal("library"),
                t.Literal("groups"),
                t.Literal("catalog")
            ])),
            page: t.Optional(t.Numeric())
        })
    })

    // navbar dropdown. old site gave html <li> give json for now
    .get("/suggestions", stub, {
        query: t.Object({
            q: t.String()
        })
    })
