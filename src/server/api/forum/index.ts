import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { FORUM_GROUPS, forumCategory } from "../../forum";

const THREADS_PER_PAGE = 25;
const POSTS_PER_PAGE = 15;
const SEARCH_PER_PAGE = 30;

const id = t.Object({
    id: t.Numeric()
});
const page = t.Optional(t.Numeric());

class ForumError extends Error {}

const checkSubject = (subject: string) => {
    if (subject.length < 2 || subject.length > 120) {
        throw new ForumError("Subject must be between 2 and 120 characters.");
    }
};

const checkBody = (body: string) => {
    if (body === "" || body.length > 10000) {
        throw new ForumError("Message must be between 1 and 10000 characters.");
    }
};

const getThread = async (threadId: number) => {
    const [thread] = await sql`
        SELECT t.*, u.username AS author_username, u.admin AS author_admin
        FROM forum_threads t LEFT JOIN users u ON u.id = t.author_id
        WHERE t.id = ${threadId}
    `;
    return thread ?? null;
};

const getPost = async (postId: number) => {
    const [post] = await sql`
        SELECT p.*, t.subject, t.forum_id, t.is_locked, t.author_id AS thread_author_id, u.username AS author_username
        FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id
        LEFT JOIN users u ON u.id = p.author_id
        WHERE p.id = ${postId}
    `;
    return post ?? null;
};

const firstPostId = async (threadId: number) => {
    const [first] = await sql`SELECT id FROM forum_posts WHERE thread_id = ${threadId} ORDER BY created_at ASC, id ASC LIMIT 1`;
    return first ? Number(first.id) : 0;
};

const threadRows = (extra = sql``) => sql`
    SELECT t.*, u.username AS author_username,
        (SELECT COUNT(*) FROM forum_posts pc WHERE pc.thread_id = t.id) AS post_count,
        lp.created_at AS last_post_at, lpu.username AS last_post_username
    FROM forum_threads t
    LEFT JOIN users u ON u.id = t.author_id
    LEFT JOIN forum_posts lp ON lp.id = t.last_post_id
    LEFT JOIN users lpu ON lpu.id = lp.author_id
    ${extra}
`;

const pages = (total: number, per: number) => Math.max(1, Math.ceil(total / per));

const handle = (err: unknown, status: any) => {
    if (err instanceof ForumError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

export const forum = new Elysia({ prefix: "/api/forum" })
    .use(session)

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

    .get("/search", async ({ query }) => {
        const q = query.q.trim();
        if (q === "") {
            return {
                results: [],
                pages: 1
            };
        }
        const like = "%" + q + "%";
        const match = sql`t.subject LIKE ${like} OR EXISTS (SELECT 1 FROM forum_posts p2 WHERE p2.thread_id = t.id AND p2.body LIKE ${like})`;

        const [count] = await sql`SELECT COUNT(*) AS n FROM forum_threads t WHERE ${match}`;
        const total = pages(Number(count.n), SEARCH_PER_PAGE);
        const current = Math.min(Math.max(1, query.page ?? 1), total);

        const rows = await threadRows(sql`WHERE ${match} ORDER BY t.updated_at DESC LIMIT ${SEARCH_PER_PAGE} OFFSET ${(current - 1) * SEARCH_PER_PAGE}`);
        return {
            results: rows.map((r: any) => ({
                ...r,
                forum_name: forumCategory(Number(r.forum_id))?.name ?? ""
            })),
            pages: total
        };
    }, {
        query: t.Object({
            q: t.String(),
            page
        })
    })

    .get("/my", async ({ user }) => ({
        mine: await threadRows(sql`WHERE t.author_id = ${user.id} ORDER BY t.updated_at DESC LIMIT 30`),
        tracked: await threadRows(sql`JOIN forum_subscriptions s ON s.thread_id = t.id WHERE s.user_id = ${user.id} ORDER BY t.updated_at DESC LIMIT 30`)
    }), {
        auth: true
    })

    .get("/:id/threads", async ({ params, query, status }) => {
        const forum = forumCategory(params.id);
        if (!forum) {
            return status(404, {
                error: "That forum does not exist."
            });
        }
        const q = (query.q ?? "").trim();
        const where = sql`WHERE t.forum_id = ${params.id} ${q !== "" ? sql`AND t.subject LIKE ${"%" + q + "%"}` : sql``}`;

        const [count] = await sql`SELECT COUNT(*) AS n FROM forum_threads t ${where}`;
        const total = pages(Number(count.n), THREADS_PER_PAGE);
        const current = Math.min(Math.max(1, query.page ?? 1), total);

        return {
            forum,
            threads: await threadRows(sql`${where} ORDER BY t.is_pinned DESC, t.updated_at DESC, t.id DESC LIMIT ${THREADS_PER_PAGE} OFFSET ${(current - 1) * THREADS_PER_PAGE}`),
            page: current,
            pages: total
        };
    }, {
        params: id,
        query: t.Object({
            q: t.Optional(t.String()),
            page
        })
    })

    .post("/:id/threads", async ({ params, body, user, status }) => {
        try {
            if (!forumCategory(params.id)) {
                throw new ForumError("That forum does not exist.");
            }
            const subject = body.subject.trim();
            const text = body.body.trim();
            checkSubject(subject);
            checkBody(text);
            const locked = !!body.locked && user.admin > 0;

            const threadId = await sql.begin(async tx => {
                const thread = await tx`INSERT INTO forum_threads (forum_id, author_id, subject, created_at, updated_at, views, is_locked, is_pinned) VALUES (${params.id}, ${user.id}, ${subject}, ${now()}, ${now()}, 0, ${locked}, 0)`;
                const threadId = Number(thread.lastInsertRowid);
                const post = await tx`INSERT INTO forum_posts (thread_id, author_id, body, created_at, updated_at) VALUES (${threadId}, ${user.id}, ${text}, ${now()}, 0)`;
                await tx`UPDATE forum_threads SET last_post_id = ${Number(post.lastInsertRowid)} WHERE id = ${threadId}`;
                return threadId;
            });

            return {
                id: threadId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            subject: t.String(),
            body: t.String(),
            locked: t.Optional(t.Boolean())
        })
    })

    .get("/threads/:id", async ({ params, query, user, status }) => {
        const thread = await getThread(params.id);
        if (!thread) {
            return status(404, {
                error: "That thread does not exist."
            });
        }
        await sql`UPDATE forum_threads SET views = views + 1 WHERE id = ${params.id}`;

        const [count] = await sql`SELECT COUNT(*) AS n FROM forum_posts WHERE thread_id = ${params.id}`;
        const total = pages(Number(count.n), POSTS_PER_PAGE);
        const current = Math.min(Math.max(1, query.page ?? 1), total);
        const newest = query.sort === "newest";

        const posts = await sql`
            SELECT p.*, u.username, u.admin, u.created_at AS user_created_at,
                (SELECT COUNT(*) FROM forum_posts up WHERE up.author_id = p.author_id) AS total_posts
            FROM forum_posts p LEFT JOIN users u ON u.id = p.author_id
            WHERE p.thread_id = ${params.id}
            ORDER BY ${newest ? sql`p.created_at DESC, p.id DESC` : sql`p.created_at ASC, p.id ASC`}
            LIMIT ${POSTS_PER_PAGE} OFFSET ${(current - 1) * POSTS_PER_PAGE}
        `;
        const first = await firstPostId(params.id);
        const [previous] = await sql`SELECT id, subject FROM forum_threads WHERE forum_id = ${thread.forum_id} AND id < ${params.id} ORDER BY id DESC LIMIT 1`;
        const [next] = await sql`SELECT id, subject FROM forum_threads WHERE forum_id = ${thread.forum_id} AND id > ${params.id} ORDER BY id ASC LIMIT 1`;
        const [tracked] = user ? await sql`SELECT 1 FROM forum_subscriptions WHERE user_id = ${user.id} AND thread_id = ${params.id}` : [null];

        return {
            thread,
            forum: forumCategory(Number(thread.forum_id)),
            posts: posts.map((p: any) => ({
                ...p,
                total_posts: Number(p.total_posts),
                is_first: Number(p.id) === first
            })),
            page: current,
            pages: total,
            previous: previous ?? null,
            next: next ?? null,
            tracked: !!tracked
        };
    }, {
        params: id,
        query: t.Object({
            sort: t.Optional(t.Union([
                t.Literal("oldest"),
                t.Literal("newest")
            ])),
            page
        })
    })

    .post("/threads/:id/reply", async ({ params, body, user, status }) => {
        try {
            const thread = await getThread(params.id);
            if (!thread) {
                throw new ForumError("That thread does not exist.");
            }
            if (thread.is_locked && user.admin < 1) {
                throw new ForumError("This thread is locked.");
            }
            const text = body.body.trim();
            checkBody(text);
            const locked = (!!body.locked && (user.admin > 0 || Number(thread.author_id) === user.id)) || !!thread.is_locked;

            const postId = await sql.begin(async tx => {
                const post = await tx`INSERT INTO forum_posts (thread_id, author_id, body, created_at, updated_at) VALUES (${params.id}, ${user.id}, ${text}, ${now()}, 0)`;
                await tx`UPDATE forum_threads SET updated_at = ${now()}, last_post_id = ${Number(post.lastInsertRowid)}, is_locked = ${locked} WHERE id = ${params.id}`;
                return Number(post.lastInsertRowid);
            });

            return {
                id: postId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            body: t.String(),
            locked: t.Optional(t.Boolean())
        })
    })

    .post("/threads/:id/track", async ({ params, body, user }) => {
        if (body.tracked) {
            await sql`INSERT IGNORE INTO forum_subscriptions (user_id, thread_id, created_at) VALUES (${user.id}, ${params.id}, ${now()})`;
        } else {
            await sql`DELETE FROM forum_subscriptions WHERE user_id = ${user.id} AND thread_id = ${params.id}`;
        }
        return {
            ok: true
        };
    }, {
        auth: true,
        params: id,
        body: t.Object({
            tracked: t.Boolean()
        })
    })

    .post("/threads/:id/moderate", async ({ params, body, status }) => {
        const thread = await getThread(params.id);
        if (!thread) {
            return status(404, {
                error: "That thread does not exist."
            });
        }
        if (body.action === "pin") {
            await sql`UPDATE forum_threads SET is_pinned = ${!thread.is_pinned} WHERE id = ${params.id}`;
        } else if (body.action === "lock") {
            await sql`UPDATE forum_threads SET is_locked = ${!thread.is_locked} WHERE id = ${params.id}`;
        } else {
            await sql.begin(async tx => {
                await tx`DELETE FROM forum_subscriptions WHERE thread_id = ${params.id}`;
                await tx`DELETE FROM forum_posts WHERE thread_id = ${params.id}`;
                await tx`DELETE FROM forum_threads WHERE id = ${params.id}`;
            });
        }
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id,
        body: t.Object({
            action: t.Union([
                t.Literal("pin"),
                t.Literal("lock"),
                t.Literal("delete")
            ])
        })
    })

    .post("/threads/:id/move", async ({ params, body, status }) => {
        if (!forumCategory(body.forum_id)) {
            return status(400, {
                error: "That forum does not exist."
            });
        }
        const moved = await sql`UPDATE forum_threads SET forum_id = ${body.forum_id} WHERE id = ${params.id}`;
        if (!moved.affectedRows && !(await getThread(params.id))) {
            return status(404, {
                error: "That thread does not exist."
            });
        }
        return {
            ok: true
        };
    }, {
        admin: true,
        params: id,
        body: t.Object({
            forum_id: t.Numeric()
        })
    })

    .get("/posts/:id", async ({ params, status }) => {
        const post = await getPost(params.id);
        if (!post) {
            return status(404, {
                error: "That post does not exist."
            });
        }
        return {
            ...post,
            is_first: Number(post.id) === await firstPostId(Number(post.thread_id)),
            forum: forumCategory(Number(post.forum_id))
        };
    }, {
        admin: true,
        params: id
    })

    .patch("/posts/:id", async ({ params, body, status }) => {
        try {
            const post = await getPost(params.id);
            if (!post) {
                throw new ForumError("That post does not exist.");
            }
            const text = body.body.trim();
            checkBody(text);
            const first = Number(post.id) === await firstPostId(Number(post.thread_id));
            const subject = first && body.subject !== undefined ? body.subject.trim() : null;
            if (subject !== null) {
                checkSubject(subject);
            }

            await sql.begin(async tx => {
                await tx`UPDATE forum_posts SET body = ${text}, updated_at = ${now()} WHERE id = ${params.id}`;
                if (subject !== null) {
                    await tx`UPDATE forum_threads SET subject = ${subject} WHERE id = ${post.thread_id}`;
                }
            });
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        params: id,
        body: t.Object({
            subject: t.Optional(t.String()),
            body: t.String()
        })
    })

    .delete("/posts/:id", async ({ params, status }) => {
        const post = await getPost(params.id);
        if (!post) {
            return status(404, {
                error: "That post does not exist."
            });
        }
        const threadId = Number(post.thread_id);
        const first = Number(post.id) === await firstPostId(threadId);

        await sql.begin(async tx => {
            if (first) {
                await tx`DELETE FROM forum_subscriptions WHERE thread_id = ${threadId}`;
                await tx`DELETE FROM forum_posts WHERE thread_id = ${threadId}`;
                await tx`DELETE FROM forum_threads WHERE id = ${threadId}`;
                return;
            }
            await tx`DELETE FROM forum_posts WHERE id = ${params.id}`;
            const [last] = await tx`SELECT id, created_at FROM forum_posts WHERE thread_id = ${threadId} ORDER BY created_at DESC, id DESC LIMIT 1`;
            await tx`UPDATE forum_threads SET last_post_id = ${last.id}, updated_at = ${last.created_at} WHERE id = ${threadId}`;
        });

        return {
            ok: true,
            thread_deleted: first,
            thread_id: threadId,
            forum_id: Number(post.forum_id)
        };
    }, {
        admin: true,
        params: id
    })
