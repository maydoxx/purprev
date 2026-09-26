import { Elysia, t } from "elysia";
import { sql, now } from "../../db";

const PER_PAGE = 9;

export const CATEGORIES: Record<string, string> = {
    news: "News",
    community: "Community",
    development: "Development",
    events: "Events"
};

const POST = sql`blog_posts.*, users.username AS author_name`;
const PUBLISHED = () => sql`blog_posts.is_published = 1 AND blog_posts.published_at <= ${now()}`;
const NEWEST = sql`blog_posts.published_at DESC, blog_posts.id DESC`;


export const blog = new Elysia({ prefix: "/blog" })
    .get("/", async ({ query }) => {
        const category = (query.category ?? "").trim().toLowerCase();
        const where = sql`
            ${PUBLISHED()}
            AND ${category in CATEGORIES ? sql`blog_posts.category = ${category}` : sql`1 = 1`}
        `;

        const [count] = await sql`SELECT COUNT(*) AS n FROM blog_posts WHERE ${where}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

        const posts = await sql`
            SELECT ${POST} FROM blog_posts
            LEFT JOIN users ON users.id = blog_posts.author_id
            WHERE ${where}
            ORDER BY ${NEWEST}
            LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;

        return {
            category: category in CATEGORIES ? category : "",
            page,
            totalPages,
            categories: CATEGORIES,
            posts
        };
    }, {
        query: t.Object({
            category: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/:id", async ({ params, status }) => {
        const [post] = await sql`
            SELECT ${POST} FROM blog_posts
            LEFT JOIN users ON users.id = blog_posts.author_id
            WHERE blog_posts.id = ${params.id} AND ${PUBLISHED()}
        `;
        if (!post) {
            return status(404, {
                error: "That post doesn't exist or isn't published."
            });
        }

        const more = await sql`
            SELECT blog_posts.id, blog_posts.title, blog_posts.category, blog_posts.published_at FROM blog_posts
            WHERE blog_posts.id != ${params.id} AND ${PUBLISHED()}
            ORDER BY ${NEWEST}
            LIMIT 3
        `;

        return {
            post,
            more,
            categories: CATEGORIES
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })
