import { Elysia, t } from "elysia";
import { stub } from "../stub";

// home page status feed
export const feed = new Elysia({ prefix: "/feed" })
    .get("/", stub)

    .post("/", stub, {
        body: t.Object({
            status: t.String()
        })
    })
