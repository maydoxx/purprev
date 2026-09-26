import { Elysia, t } from "elysia";


const CDN = (process.env.SETUP_URL || process.env.CDN_URL || "").replace(/\/+$/, "");

const routes = (prefix: string) => new Elysia({ prefix })

    .get("/version", async ({ status }) => {
        if (!CDN) {
            return status(503, "CDN_URL is not set");
        }
        let res: Response;
        try {
            res = await fetch(`${CDN}/version.txt`, {
                signal: AbortSignal.timeout(10000)
            });
        } catch {
            return status(502, "cdn unreachable");
        }
        if (!res.ok) {
            return status(503, "no client has been packaged yet ;w;");
        }
        return new Response((await res.text()).trim(), {
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "no-cache"
            }
        });
    })


    .get("/download", ({ query, redirect, status }) => {
        if (!CDN) {
            return status(503, "CDN_URL is not set");
        }
        return redirect(`${CDN}/${query.os === "linux" ? "nonerev" : "NoneRevLauncher.exe"}`, 302);
    }, {
        query: t.Object({
            os: t.Optional(t.String())
        })
    })


    .get("/:file", ({ params, redirect, status }) => {
        if (!CDN) {
            return status(503, "CDN_URL is not set");
        }
        return redirect(`${CDN}/${params.file}`, 302);
    }, {
        params: t.Object({
            file: t.String({ pattern: "^[A-Za-z0-9._-]+$" })
        })
    })

export const setup = new Elysia()
    .use(routes("/api/setup"))
    .use(routes("/setup"))
