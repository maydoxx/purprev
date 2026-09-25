import { Elysia, t } from "elysia";
import { join } from "path";
import { STORAGE, UPLOADS, CDN_URL } from "../storage";

// /uploads/thumbnails/12.png etc, on r2 the cdn has it
export const uploads = new Elysia({ prefix: "/uploads" })
    .get("/:kind/:file", async ({ params, status, redirect }) => {
        if (STORAGE === "cloudflare") {
            return redirect(`${CDN_URL}/${params.kind}/${params.file}`, 302);
        }
        const file = Bun.file(join(UPLOADS, params.kind, params.file));
        if (!(await file.exists())) {
            return status(404, "not found");
        }
        return new Response(file, {
            headers: {
                "Cache-Control": "public, max-age=3600"
            }
        });
    }, {
        params: t.Object({
            kind: t.String({ pattern: "^[a-z]+$" }),
            file: t.String({ pattern: "^[A-Za-z0-9_-]+\\.[a-z0-9]+$" })
        })
    })
