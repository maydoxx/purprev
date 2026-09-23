import { Elysia, t } from "elysia";
import { stub } from "../stub";

// return rendered avatar png or pending placeholder if not rendered yet
// TODO: make rcc manager render
export const getProfilePicture = new Elysia()
    .get("/getProfilePicture", stub, {
        query: t.Object({
            userId: t.Numeric(),
            type: t.Optional(t.Union([
                t.Literal("headshot"),
                t.Literal("full")
            ]))
        })
    })
