import { Elysia, t } from "elysia";


const CDN = (process.env.SETUP_URL || process.env.CDN_URL || "").replace(/\/+$/, "");

// the android build lives in its own folder with its own version.txt
const FILES: Record<string, string> = {
    windows: "NoneRevLauncher.exe",
    linux: "nonerev",
    android: "android/NoneRevPlayer.apk"
};
const VERSIONS: Record<string, string> = {
    windows: "version.txt",
    android: "android/version.txt"
};

const routes = (prefix: string) => new Elysia({ prefix })

    .get("/version", async ({ query, status }) => {
        if (!CDN) {
            return status(503, "CDN_URL is not set");
        }
        let res: Response;
        try {
            res = await fetch(`${CDN}/${VERSIONS[query.os ?? ""] ?? VERSIONS.windows}`, {
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
    }, {
        query: t.Object({
            os: t.Optional(t.String())
        })
    })


    .get("/download", ({ query, redirect, status }) => {
        if (!CDN) {
            return status(503, "CDN_URL is not set");
        }
        return redirect(`${CDN}/${FILES[query.os ?? ""] ?? FILES.windows}`, 302);
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
