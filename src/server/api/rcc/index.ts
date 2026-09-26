import { Elysia, t } from "elysia";
import { timingSafeEqual } from "crypto";
import { mediaRecord, parseKey } from "../../media";

const PASSWORD = process.env.RCCMANAGER_PASSWORD ?? "";

const authed = (header: string | null) => {
    const got = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
    const want = Buffer.from(PASSWORD);
    return PASSWORD !== "" && got.length === want.length && timingSafeEqual(got, want);
};


export const rcc = new Elysia({ prefix: "/api/rcc" })
    .post("/rendered", async ({ body, request, status }) => {
        if (!authed(request.headers.get("authorization"))) {
            return status(401, {
                error: "bad bearer"
            });
        }
        for (const f of body.files) {
            const parsed = parseKey(f.key);
            if (parsed) {
                await mediaRecord(parsed.kind, parsed.id, parsed.ext, f.size);
            }
        }
        return {
            ok: true
        };
    }, {
        body: t.Object({
            kind: t.String(),
            id: t.Numeric(),
            files: t.Array(t.Object({
                key: t.String(),
                size: t.Numeric()
            }))
        })
    })
