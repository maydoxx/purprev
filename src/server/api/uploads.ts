import { Elysia, t } from "elysia";
import { join } from "path";
import { STORAGE, UPLOADS, CDN_URL } from "../storage";

// public media only
const PUBLIC_KINDS = ["avatars", "thumbnails", "icons", "catalog", "badges", "gamepasses", "blog", "groups", "ads", "outfits", "assets"];
const PUBLIC_FILE = /\.(png|jpe?g|gif|webp|bmp|tga|mp3|ogg|wav)$/i;

export const uploads = new Elysia({ prefix: "/uploads" })
    .get("/:kind/:file", async ({ params, status, redirect }) => {
        if (!PUBLIC_KINDS.includes(params.kind) || !PUBLIC_FILE.test(params.file)) {
            return status(404, "not found");
        }
        if (STORAGE === "cloudflare") {
            return redirect(`${CDN_URL}/${params.kind}/${params.file}`, 302);
        }
        const file = Bun.file(join(UPLOADS, params.kind, params.file));
        if (!(await file.exists())) {
            return status(404, "not found");
        }
        return new Response(file, {
            headers: {
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff"
            }
        });
    }, {
        params: t.Object({
            kind: t.String({ pattern: "^[a-z]+$" }),
            file: t.String({ pattern: "^[A-Za-z0-9_-]+\\.[a-z0-9]+$" })
        })
    })
