import { Elysia, t } from "elysia";

export const setup = new Elysia({ prefix: "/api/setup" })
    .get("/version", () => ({
        message: "stub"
    }))

    // TODO: make this grab the setup from cloudflare CDN
    // ?os=linux/mac
    .get("/download", () => ({
        message: "stub"
    }), {
        query: t.Object({
            os: t.Optional(t.String())
        })
    })

    // TODO: make it download the client from cloudflare CDN
    .get("/:file", () => ({
        message: "This should return cloudflare cdn link or a file."
    }))