import { Elysia, t } from "elysia";
import { stub } from "../stub";
import { sql } from "../../db";
import { FORUM_GROUPS } from "../../forum";

const id = t.Object({
    id: t.Numeric()
});
const page = t.Optional(t.Numeric());

export const forum = new Elysia({ prefix: "/api/forum" })
    // the categories with their thread/post counts and last post
    .get("/", async () => {
        const groups = [];
        for (const [section, forums] of Object.entries(FORUM_GROUPS)) {
            const out = [];
            for (const forum of forums) {
                const [stats] = await sql`
                    SELECT
                        (SELECT COUNT(*) FROM forum_threads WHERE forum_id = ${forum.id}) AS threads,
                        (SELECT COUNT(*) FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id WHERE t.forum_id = ${forum.id}) AS posts
                `;
                const [last] = await sql`
                    SELECT p.created_at, u.username FROM forum_posts p
                    JOIN forum_threads t ON t.id = p.thread_id
                    LEFT JOIN users u ON u.id = p.author_id
                    WHERE t.forum_id = ${forum.id}
                    ORDER BY p.created_at DESC, p.id DESC LIMIT 1
                `;
                out.push({
                    ...forum,
                    threads: Number(stats.threads),
                    posts: Number(stats.posts),
                    last: last ?? null
                });
            }
            groups.push({
                section,
                forums: out
            });
        }
        return {
            groups
        };
    })

    .get("/search", stub, {
        query: t.Object({
            q: t.String(),
            page
        })
    })

    // my threads + tracked threads
    .get("/my", stub)

    .get("/:id/threads", stub, {
        params: id,
        query: t.Object({
            q: t.Optional(t.String()),
            page
        })
    })

    // locked only works for forum mods
    .post("/:id/threads", stub, {
        params: id,
        body: t.Object({
            subject: t.String(),
            body: t.String(),
            locked: t.Optional(t.Boolean())
        })
    })

    // also counts a view
    .get("/threads/:id", stub, {
        params: id,
        query: t.Object({
            sort: t.Optional(t.Union([
                t.Literal("oldest"),
                t.Literal("newest")
            ])),
            page
        })
    })

    .post("/threads/:id/reply", stub, {
        params: id,
        body: t.Object({
            body: t.String(),
            locked: t.Optional(t.Boolean())
        })
    })

    .post("/threads/:id/track", stub, {
        params: id,
        body: t.Object({
            tracked: t.Boolean()
        })
    })

    // moderator only
    // pin and lock are toggles
    .post("/threads/:id/moderate", stub, {
        params: id,
        body: t.Object({
            action: t.Union([
                t.Literal("pin"),
                t.Literal("lock"),
                t.Literal("delete")
            ])
        })
    })

    .post("/threads/:id/move", stub, {
        params: id,
        body: t.Object({
            forum_id: t.Numeric()
        })
    })

    // subject only matters on the first post of a thread
    .patch("/posts/:id", stub, {
        params: id,
        body: t.Object({
            subject: t.Optional(t.String()),
            body: t.String()
        })
    })

    // deleting the first post deletes the thread
    .delete("/posts/:id", stub, {
        params: id
    })
