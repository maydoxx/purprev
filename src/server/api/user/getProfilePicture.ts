import { Elysia, t } from "elysia";
import { avatarImage, PENDING } from "../../paths";

// rendered avatar png, or the placeholder until rcc manager renders one
export const getProfilePicture = new Elysia()
    .get("/getProfilePicture", async ({ query }) => {
        const file = Bun.file(avatarImage(query.userId, query.type === "headshot"));

        return new Response(await file.exists() ? file : Bun.file(PENDING), {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=300"
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
