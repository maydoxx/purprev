import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";

const PER_PAGE = 25;

export const REASONS = [
    "Swearing",
    "Inappropriate Username",
    "Bullying",
    "Scamming",
    "Dating",
    "Cheating/Exploiting",
    "Personal Question",
    "Offsite Links",
    "Inappropriate Content",
    "Other"
];

const TYPES = ["game", "user", "item", "comment", "group"];

type Target = {
    name: string;
    url: string;
};

const targetOf = async (type: string, id: number): Promise<Target | null> => {
    if (type === "game") {
        const [row] = await sql`SELECT title FROM games WHERE id = ${id}`;
        return row ? {
            name: row.title,
            url: `/game?id=${id}`
        } : null;
    }
    if (type === "user") {
        const [row] = await sql`SELECT username FROM users WHERE id = ${id}`;
        return row ? {
            name: row.username,
            url: `/user?id=${id}`
        } : null;
    }
    if (type === "item") {
        const [row] = await sql`SELECT name FROM catalog_items WHERE id = ${id}`;
        return row ? {
            name: row.name,
            url: `/catalog/item?id=${id}`
        } : null;
    }
    if (type === "group") {
        const [row] = await sql`SELECT name FROM site_groups WHERE id = ${id}`;
        return row ? {
            name: row.name,
            url: `/groups?id=${id}`
        } : null;
    }
    return {
        name: `Comment #${id}`,
        url: ""
    };
};

const unescapeXml = (text: string) => text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

const attr = (xml: string, name: string) => {
    const m = new RegExp(`\\b${name}="([^"]*)"`).exec(xml);
    return m ? unescapeXml(m[1]!) : "";
};

// <report userID placeID gameJobID><comment>AbuserID:n;reason;text</comment><messages><message userID guid>text</message>...</messages></report>
const parseReport = (xml: string) => {
    const comment = unescapeXml(/<comment>([\s\S]*?)<\/comment>/.exec(xml)?.[1] ?? "");
    const messages = [...xml.matchAll(/<message\b([^>]*)>([\s\S]*?)<\/message>/g)].map(m => ({
        user_id: Number(attr(m[1]!, "userID")) || 0,
        text: unescapeXml(m[2]!)
    }));
    const abuser = /^AbuserID:(\d+);([\s\S]*)$/.exec(comment);
    const rest = abuser ? abuser[2]! : comment;
    const semi = rest.indexOf(";");
    const reason = semi >= 0 ? rest.slice(0, semi).trim() : "";
    return {
        reporter_id: Number(attr(xml, "userID")) || 0,
        place_id: Number(attr(xml, "placeID")) || 0,
        job_id: attr(xml, "gameJobID").slice(0, 64),
        abuser_id: abuser ? Number(abuser[1]) : 0,
        reason: REASONS.includes(reason) ? reason : reason ? reason.slice(0, 80) : "In-game",
        comment: (semi >= 0 ? rest.slice(semi + 1) : rest).trim().slice(0, 2000),
        messages
    };
};

export const abuse = new Elysia()
    .use(session)

    .get("/api/abuse/target", async ({ query, status }) => {
        if (!TYPES.includes(query.type)) {
            return status(404, {
                error: "Nothing to report there."
            });
        }
        const target = await targetOf(query.type, query.id);
        if (!target) {
            return status(404, {
                error: "Nothing to report there."
            });
        }
        return {
            type: query.type,
            id: query.id,
            ...target,
            reasons: REASONS
        };
    }, {
        query: t.Object({
            type: t.String(),
            id: t.Numeric()
        })
    })

    .post("/api/abuse", async ({ body, user, status }) => {
        if (!TYPES.includes(body.type) || !(await targetOf(body.type, body.id))) {
            return status(404, {
                error: "Nothing to report there."
            });
        }
        if (!REASONS.includes(body.reason)) {
            return status(400, {
                error: "Please select a reason."
            });
        }
        const comment = body.comment.trim();
        if (comment === "") {
            return status(400, {
                error: "Please describe what happened."
            });
        }
        const [recent] = await sql`SELECT 1 FROM abuse_reports WHERE reporter_id = ${user.id} AND created_at > ${now() - 60}`;
        if (recent) {
            return status(429, {
                error: "You are reporting too quickly. Try again in a minute."
            });
        }
        await sql`
            INSERT INTO abuse_reports (reporter_id, type, target_id, reason, comment, source, chat_log, created_at)
            VALUES (${user.id}, ${body.type}, ${body.id}, ${body.reason}, ${comment.slice(0, 2000)}, 'site', '', ${now()})
        `;
        return {
            ok: true
        };
    }, {
        auth: true,
        body: t.Object({
            type: t.String(),
            id: t.Integer(),
            reason: t.String(),
            comment: t.String({ maxLength: 4000 })
        })
    })

    .post("/AbuseReport/InGameChatHandler.ashx", async ({ request }) => {
        const report = parseReport(await request.text());
        if (report.reporter_id <= 0) {
            return "";
        }
        await sql`
            INSERT INTO abuse_reports (reporter_id, type, target_id, reason, comment, source, place_id, job_id, chat_log, created_at)
            VALUES (${report.reporter_id}, ${report.abuser_id > 0 ? "user" : "game"}, ${report.abuser_id > 0 ? report.abuser_id : report.place_id},
                ${report.reason}, ${report.comment}, 'game', ${report.place_id}, ${report.job_id}, ${JSON.stringify(report.messages)}, ${now()})
        `;
        return "";
    })

    .get("/api/admin/reports", async ({ query }) => {
        const where = query.status === "closed" ? sql`r.status = 'closed'` : sql`r.status = 'open'`;
        const [count] = await sql`SELECT COUNT(*) AS n FROM abuse_reports r WHERE ${where}`;
        const total = Number(count.n);
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
        const rows = await sql`
            SELECT r.*, u.username AS reporter_name, c.username AS closed_by_name FROM abuse_reports r
            LEFT JOIN users u ON u.id = r.reporter_id
            LEFT JOIN users c ON c.id = r.closed_by
            WHERE ${where}
            ORDER BY r.id DESC
            LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;
        const items = [];
        for (const r of rows) {
            const target = await targetOf(r.type, Number(r.target_id));
            let chat: any[] = [];
            try {
                chat = r.chat_log ? JSON.parse(r.chat_log) : [];
            } catch {
                chat = [];
            }
            items.push({
                ...r,
                id: Number(r.id),
                reporter_id: Number(r.reporter_id),
                target_id: Number(r.target_id),
                place_id: Number(r.place_id),
                created_at: Number(r.created_at),
                target_name: target?.name ?? `#${r.target_id}`,
                target_url: target?.url ?? "",
                chat_log: chat
            });
        }
        return {
            items,
            total,
            page,
            totalPages
        };
    }, {
        admin: true,
        query: t.Object({
            status: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .post("/api/admin/reports/:id/close", async ({ params, user, status }) => {
        const [report] = await sql`SELECT id FROM abuse_reports WHERE id = ${params.id}`;
        if (!report) {
            return status(404, {
                error: "Report not found."
            });
        }
        await sql`UPDATE abuse_reports SET status = 'closed', closed_by = ${user.id} WHERE id = ${params.id}`;
        return {
            ok: true
        };
    }, {
        admin: true,
        params: t.Object({
            id: t.Numeric()
        })
    });
