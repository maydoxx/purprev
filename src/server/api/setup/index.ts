import { Elysia, t } from "elysia";

// launcher and client zips, package.ps1 puts version.txt next to them. SETUP_URL when they live somewhere other than the uploads bucket
const CDN = (process.env.SETUP_URL || process.env.CDN_URL || "").replace(/\/+$/, "");

const routes = (prefix: string) => new Elysia({ prefix })
    // the launcher asks this to know which client zip to grab
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

    // ?os=linux gives the launcher script instead of the exe
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

    // /setup/<version>-NoneRevPlayer.zip etc
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
