import { Elysia } from "elysia";
import { sql, now } from "../../db";
import { SITE_URL } from "../../site";
import { storage } from "../../storage";
import { mediaEntry, mediaKey, mediaUrl } from "../../media";
import { imageSize } from "../../image";

type Image = {
    url: string;
    width?: number;
    height?: number;
};

type Card = {
    title: string;
    description?: string;
    image?: Image | null;
    type?: string;
    large?: boolean;
};

const LOGO: Image = {
    url: "/img/nonelogo.png",
    width: 2739,
    height: 793
};

const FALLBACK: Card = {
    title: "NoneRev",
    description: "NoneRev is a revival that brings back the games and the site you remember."
};

const esc = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const absolute = (url: string) => /^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;

const clip = (text: string | null, max = 200) => {
    const flat = (text ?? "").replace(/\s+/g, " ").trim();
    if (flat.length <= max) {
        return flat;
    }
    const cut = flat.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return `${space > max / 2 ? cut.slice(0, space) : cut}...`;
};

const sizes = new Map<string, { width: number, height: number } | null>();

const picture = async (kind: string, id: number): Promise<Image | null> => {
    const entry = await mediaEntry(kind, id);
    if (!entry) {
        return null;
    }
    const key = mediaKey(kind, id, entry.ext);
    const version = `${key}?v=${entry.updated_at}`;
    if (!sizes.has(version)) {
        const file = await storage.open(key).catch(() => null);
        const head = file ? await file.slice(0, 65536).bytes().catch(() => null) : null;
        const size = head ? imageSize(head) : null;
        sizes.set(version, size && {
            width: size.width,
            height: size.height
        });
    }
    return {
        url: await mediaUrl(kind, id),
        ...sizes.get(version)
    };
};

const price = (row: any) => {
    if (row.price !== null) {
        return Number(row.price) === 0 ? "Price: Free" : `Price: ${Number(row.price).toLocaleString("en-US")} Nonebux`;
    }
    return row.tix_price !== null ? `Price: ${Number(row.tix_price).toLocaleString("en-US")} Tix` : "";
};

const game = async (id: number): Promise<Card | null> => {
    const [row] = await sql`SELECT title, description, access FROM games WHERE id = ${id}`;
    if (!row || row.access !== "everyone") {
        return null;
    }
    const thumbnail = await picture("thumbnails", id);
    return {
        title: row.title,
        description: clip(row.description),
        image: thumbnail ?? await picture("icons", id),
        large: thumbnail !== null
    };
};

const user = async (id: number): Promise<Card | null> => {
    const [row] = await sql`SELECT username, about, ongoing_action_id FROM users WHERE id = ${id}`;
    if (!row || row.ongoing_action_id !== null) {
        return null;
    }
    return {
        title: `${row.username}'s Profile`,
        description: clip(row.about),
        image: await picture("avatars", id),
        type: "profile"
    };
};

const item = async (id: number): Promise<Card | null> => {
    const [row] = await sql`
        SELECT name, description, price, tix_price, thumbnail, is_limited_unique, limited_stock, limited_sold FROM catalog_items
        WHERE id = ${id}
    `;
    if (!row) {
        return null;
    }
    const soldOut = !!row.is_limited_unique && row.limited_stock !== null && Number(row.limited_sold) >= Number(row.limited_stock);
    return {
        title: row.name,
        description: [soldOut ? "" : price(row), clip(row.description)].filter(Boolean).join("\n"),
        image: row.thumbnail ? {
            url: row.thumbnail
        } : await picture("catalog", id)
    };
};

const group = async (id: number): Promise<Card | null> => {
    const [row] = await sql`SELECT name, description, icon FROM site_groups WHERE id = ${id}`;
    if (!row) {
        return null;
    }
    return {
        title: row.name,
        description: clip(row.description),
        image: row.icon ? await picture("groups", id) ?? {
            url: row.icon
        } : null
    };
};

const thread = async (id: number): Promise<Card | null> => {
    const [row] = await sql`
        SELECT t.subject, (SELECT p.body FROM forum_posts p WHERE p.thread_id = t.id ORDER BY p.created_at ASC, p.id ASC LIMIT 1) AS body
        FROM forum_threads t WHERE t.id = ${id}
    `;
    if (!row) {
        return null;
    }
    return {
        title: row.subject,
        description: clip(row.body),
        type: "article"
    };
};

const blog = async (id: number): Promise<Card | null> => {
    const [row] = await sql`
        SELECT title, excerpt, body, image FROM blog_posts
        WHERE id = ${id} AND is_published = 1 AND published_at <= ${now()}
    `;
    if (!row) {
        return null;
    }
    return {
        title: row.title,
        description: clip(row.excerpt) || clip(row.body),
        image: row.image ? await picture("blog", id) ?? {
            url: row.image
        } : null,
        type: "article"
    };
};

const PAGES: Record<string, [string, (id: number) => Promise<Card | null>]> = {
    "/game": ["id", game],
    "/user": ["id", user],
    "/catalog/item": ["id", item],
    "/groups": ["id", group],
    "/forum/thread": ["PostID", thread],
    "/blog": ["id", blog]
};

const render = (card: Card, url: string) => {
    const image = card.image ?? LOGO;
    const meta: [string, string, unknown][] = [
        ["name", "description", card.description],
        ["name", "theme-color", "#7B2CBF"],
        ["property", "og:site_name", "NoneRev"],
        ["property", "og:type", card.type ?? "website"],
        ["property", "og:title", card.title],
        ["property", "og:description", card.description],
        ["property", "og:url", url],
        ["property", "og:image", absolute(image.url)],
        ["property", "og:image:width", image.width],
        ["property", "og:image:height", image.height],
        ["name", "twitter:card", card.large ? "summary_large_image" : "summary"]
    ];
    return [
        "<!DOCTYPE html>",
        "<html lang=\"en\">",
        "<head>",
        "<meta charset=\"utf-8\">",
        `<title>${esc(card.title)}</title>`,
        ...meta.filter(([, , value]) => value).map(([attr, name, value]) => `<meta ${attr}="${name}" content="${esc(String(value))}">`),
        "</head>",
        "<body>",
        `<a href="${esc(url)}">${esc(card.title)}</a>`,
        "</body>",
        "</html>"
    ].join("\n");
};

export const embed = new Elysia({ prefix: "/api/embed" })
    .get("/*", async ({ request }) => {
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api\/embed/, "") || "/";
        const page = PAGES[path.replace(/\/+$/, "").toLowerCase() || "/"];
        const id = page ? url.searchParams.get(page[0]) ?? "" : "";
        // postgres throws on ids past int4
        const card = page && /^\d{1,9}$/.test(id) ? await page[1](Number(id)) : null;
        return new Response(render(card ?? FALLBACK, `${SITE_URL}${path}${url.search}`), {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                // people get the app on this same url
                "Cache-Control": "private, max-age=300"
            }
        });
    })
