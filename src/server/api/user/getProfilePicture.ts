import { Elysia, t } from "elysia";
import { PENDING } from "../../paths";
import { mediaUrl } from "../../media";


export const getProfilePicture = new Elysia()
    .get("/getProfilePicture", async ({ query, redirect }) => {
        const url = await mediaUrl(query.type === "headshot" ? "headshots" : "avatars", query.userId);
        if (url) {
            return redirect(url, 302);
        }
        return new Response(Bun.file(PENDING), {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=60"
            }
        });
    }, {
        query: t.Object({
            userId: t.Numeric(),
            type: t.Optional(t.Union([
                t.Literal("headshot"),
                t.Literal("full")
            ]))
        })
    })
