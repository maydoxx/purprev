console.log("Hello via Bun!");

import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { openapi } from '@elysia/openapi'

const app = new Elysia()
    .use(
        staticPlugin({
            assets: "dist",
            prefix: "/"
        })
    )
    .use(
        openapi()
    )

    .get("/api/meow", () => ({
        message: "nya"
    }))

    .listen(3000);