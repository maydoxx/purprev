import { Elysia, t } from "elysia";
import { PENDING } from "../../paths";
import { mediaUrl, mediaStream } from "../../media";


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

    .get("/avatar3d", async ({ query, status }) => {
        const scene = await mediaStream("avatars3d", query.userId, "private, max-age=60");
        if (!scene) {
            return status(404, {
                error: "No 3D avatar yet"
            });
        }
        return scene;
    }, {
        query: t.Object({
            userId: t.Numeric()
        })
    })
