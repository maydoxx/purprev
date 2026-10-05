import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { mediaPut, mediaUrl } from "../../media";
import { imageSize } from "../../image";
import { REASONS } from "../site/abuse";

const PER_PAGE = 20;
const RUN_LENGTH = 86400;
const IMAGE_MAX = 1024 * 1024;
// same rate as /api/money/exchange
const TIX_RATE = 10;
const STATUSES = ["pending", "approved", "rejected"];

const SIZES: Record<string, [number, number]> = {
    banner: [728, 90],
    skyscraper: [160, 600],
    rectangle: [300, 250]
};

const IMAGE_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif"
};

const TARGET_URLS: Record<string, string> = {
    game: "/game?id=",
    group: "/groups?id=",
    item: "/catalog/item?id="
};

class AdError extends Error {}

const id = t.Object({
    id: t.Numeric()
});

const size = t.Union([
    t.Literal("banner"),
    t.Literal("skyscraper"),
    t.Literal("rectangle")
]);

const handle = (err: unknown, status: any) => {
    if (err instanceof AdError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

const targetUrl = (type: string, targetId: number) => `${TARGET_URLS[type]}${targetId}`;

const ctr = (clicks: number, impressions: number) => impressions > 0 ? Math.round(clicks / impressions * 10000) / 100 : 0;

const weight = (run: any) => run.currency === "tix" ? Number(run.bid) / TIX_RATE : Number(run.bid);

const pick = (runs: any[]) => {
    let roll = Math.random() * runs.reduce((sum, r) => sum + weight(r), 0);
    for (const run of runs) {
        roll -= weight(run);
        if (roll < 0) {
            return run;
        }
    }
    return runs[runs.length - 1];
};


const targetsOf = (type: string, userId: number, only = 0) => {
    const one = only ? sql`AND id = ${only}` : sql``;
    if (type === "game") {
        return sql`SELECT id, title AS name FROM games WHERE creator_id = ${userId} ${one} ORDER BY id DESC`;
    }
    if (type === "item") {
        return sql`SELECT id, name FROM catalog_items WHERE creator_id = ${userId} ${one} ORDER BY id DESC`;
    }
    return sql`
        SELECT id, name FROM site_groups g
        WHERE (owner_id = ${userId} OR EXISTS (
            SELECT 1 FROM group_members m
            JOIN group_roles r ON r.group_id = m.group_id AND r.rank = m.rank
            WHERE m.group_id = g.id AND m.user_id = ${userId} AND r.can_manage_members = 1
        )) ${one}
        ORDER BY id DESC
    `;
};

const AD_COLS = sql`
    a.id, a.creator_id, a.name, a.size, a.target_type, a.target_id, a.status, a.created_at,
    COALESCE(tg.title, tr.name, ti.name, '') AS target_name
`;

const AD_TARGETS = sql`
    LEFT JOIN games tg ON a.target_type = 'game' AND tg.id = a.target_id
    LEFT JOIN site_groups tr ON a.target_type = 'group' AND tr.id = a.target_id
    LEFT JOIN catalog_items ti ON a.target_type = 'item' AND ti.id = a.target_id
`;

const adRow = async (a: any) => {
    const [width, height] = SIZES[a.size]!;
    return {
        id: Number(a.id),
        name: a.name,
        size: a.size,
        width,
        height,
        status: a.status,
        image: await mediaUrl("ads", Number(a.id)),
        target: {
            type: a.target_type,
            id: Number(a.target_id),
            name: a.target_name,
            url: targetUrl(a.target_type, Number(a.target_id))
        },
        created_at: Number(a.created_at)
    };
};


const setStatus = async (adId: number, to: string, adminId: number) => {
    const done = await sql`UPDATE user_ads SET status = ${to}, reviewed_by = ${adminId}, reviewed_at = ${now()} WHERE id = ${adId} AND status <> ${to}`;
    if (done.count) {
        return;
    }
    const [ad] = await sql`SELECT status FROM user_ads WHERE id = ${adId}`;
    if (!ad) {
        throw new AdError("That ad does not exist.");
    }
    throw new AdError(`That ad is already ${to}.`);
};

export const ads = new Elysia()
    .use(session)

    .get("/api/ads/targets", async ({ user }) => {
        const list = async (type: string) => (await targetsOf(type, user.id)).map((r: any) => ({
            id: Number(r.id),
            name: r.name,
            url: targetUrl(type, Number(r.id))
        }));
        return {
            games: await list("game"),
            groups: await list("group"),
            items: await list("item")
        };
    }, {
        auth: true
    })

    .post("/api/ads/create", async ({ body, user, status }) => {
        try {
            const name = body.name.replace(/\s+/g, " ").trim();
            if (name === "" || name.length > 50) {
                throw new AdError("Give your ad a name, up to 50 characters.");
            }
            const [target] = await targetsOf(body.target_type, user.id, body.target_id);
            if (!target) {
                throw new AdError("You can only advertise your own places and items, or groups you manage.");
            }

            const image = body.image;
            if (image.size <= 0) {
                throw new AdError("That image is empty.");
            }
            if (image.size > IMAGE_MAX) {
                throw new AdError("Ad images can be up to 1 MB.");
            }
            const ext = IMAGE_TYPES[image.type];
            if (!ext) {
                throw new AdError("Use a PNG, JPG or GIF.");
            }
            const bytes = await image.bytes();
            const info = imageSize(bytes);
            if (!info || info.type !== ext) {
                throw new AdError("That file is not an image.");
            }
            const [width, height] = SIZES[body.size]!;
            if (info.width !== width || info.height !== height) {
                throw new AdError(`A ${body.size} ad must be exactly ${width}x${height} pixels (this one is ${info.width}x${info.height}).`);
            }

            const [ad] = await sql`
                INSERT INTO user_ads (creator_id, name, size, target_type, target_id, created_at)
                VALUES (${user.id}, ${name}, ${body.size}, ${body.target_type}, ${body.target_id}, ${now()}) RETURNING id
            `;
            const adId = Number(ad.id);
            try {
                await mediaPut("ads", adId, ext, bytes);
            } catch (err) {
                await sql`DELETE FROM user_ads WHERE id = ${adId}`;
                throw err;
            }
            return {
                ok: true,
                id: adId,
                status: "pending"
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            name: t.String(),
            size,
            target_type: t.Union([
                t.Literal("game"),
                t.Literal("group"),
                t.Literal("item")
            ]),
            target_id: t.Numeric(),
            image: t.File({ type: "image" })
        })
    })

    .get("/api/ads/mine", async ({ user }) => {
        const at = now();
        const rows = await sql`
            SELECT ${AD_COLS},
                r.id AS run_id, r.bid, r.currency, r.started_at, r.ends_at, r.impressions, r.clicks,
                COALESCE(s.runs, 0) AS runs, COALESCE(s.impressions, 0) AS total_impressions, COALESCE(s.clicks, 0) AS total_clicks,
                COALESCE(s.nonebux, 0) AS total_nonebux, COALESCE(s.tix, 0) AS total_tix
            FROM user_ads a
            ${AD_TARGETS}
            LEFT JOIN LATERAL (
                SELECT id, bid, currency, started_at, ends_at, impressions, clicks FROM user_ad_runs
                WHERE ad_id = a.id ORDER BY id DESC LIMIT 1
            ) r ON true
            LEFT JOIN (
                SELECT ad_id, COUNT(*) AS runs, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
                    SUM(CASE WHEN currency = 'nonebux' THEN bid ELSE 0 END) AS nonebux,
                    SUM(CASE WHEN currency = 'tix' THEN bid ELSE 0 END) AS tix
                FROM user_ad_runs GROUP BY ad_id
            ) s ON s.ad_id = a.id
            WHERE a.creator_id = ${user.id}
            ORDER BY a.id DESC
        `;
        const list = [];
        for (const a of rows) {
            const run = a.run_id === null ? null : {
                id: Number(a.run_id),
                bid: Number(a.bid),
                currency: a.currency,
                started_at: Number(a.started_at),
                ends_at: Number(a.ends_at),
                impressions: Number(a.impressions),
                clicks: Number(a.clicks),
                ctr: ctr(Number(a.clicks), Number(a.impressions))
            };
            const impressions = Number(a.total_impressions);
            const clicks = Number(a.total_clicks);
            list.push({
                ...await adRow(a),
                running: a.status === "approved" && !!run && run.ends_at > at,
                run,
                totals: {
                    runs: Number(a.runs),
                    impressions,
                    clicks,
                    ctr: ctr(clicks, impressions),
                    nonebux: Number(a.total_nonebux),
                    tix: Number(a.total_tix)
                }
            });
        }
        return {
            list
        };
    }, {
        auth: true
    })

    .post("/api/ads/run/:id", async ({ params, body, user, status }) => {
        try {
            const bid = Number(body.bid);
            if (!Number.isSafeInteger(bid) || bid < 1) {
                throw new AdError("Enter a bid of at least 1.");
            }
            if (bid > 2000000000) {
                throw new AdError("That bid is too high.");
            }
            const tix = body.currency === "tix";

            return await sql.begin(async tx => {
                const [ad] = await tx`SELECT id, status FROM user_ads WHERE id = ${params.id} AND creator_id = ${user.id} FOR UPDATE`;
                if (!ad) {
                    throw new AdError("That ad does not exist.");
                }
                if (ad.status !== "approved") {
                    throw new AdError(ad.status === "pending" ? "This ad is still waiting for approval." : "This ad was rejected and cannot run.");
                }
                const at = now();
                const [active] = await tx`SELECT 1 FROM user_ad_runs WHERE ad_id = ${ad.id} AND ends_at > ${at}`;
                if (active) {
                    throw new AdError("This ad is already running.");
                }

                const [me] = await tx`SELECT currency, tix FROM users WHERE id = ${user.id} FOR UPDATE`;
                if (Number(tix ? me.tix : me.currency) < bid) {
                    throw new AdError(`You do not have enough ${tix ? "Tix" : "Nonebux"} for this bid.`);
                }
                const debit = tix
                    ? await tx`UPDATE users SET tix = tix - ${bid} WHERE id = ${user.id} AND tix >= ${bid}`
                    : await tx`UPDATE users SET currency = currency - ${bid} WHERE id = ${user.id} AND currency >= ${bid}`;
                if (!debit.count) {
                    throw new AdError("Your balance changed. Please try again.");
                }

                const [run] = await tx`
                    INSERT INTO user_ad_runs (ad_id, bid, currency, started_at, ends_at)
                    VALUES (${ad.id}, ${bid}, ${tix ? "tix" : "nonebux"}, ${at}, ${at + RUN_LENGTH}) RETURNING id
                `;
                return {
                    ok: true,
                    run: Number(run.id),
                    ends_at: at + RUN_LENGTH,
                    balance: Number(me.currency) - (tix ? 0 : bid),
                    tixBalance: Number(me.tix) - (tix ? bid : 0)
                };
            });
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            bid: t.Numeric(),
            currency: t.Optional(t.Union([
                t.Literal("nonebux"),
                t.Literal("tix")
            ]))
        })
    })

    .get("/api/ads/serve", async ({ query, set }) => {
        set.headers["cache-control"] = "no-store";
        const at = now();
        const runs = await sql`
            SELECT r.id, r.bid, r.currency, a.id AS ad_id, a.name, a.target_type, a.target_id
            FROM user_ad_runs r
            JOIN user_ads a ON a.id = r.ad_id
            WHERE a.size = ${query.size} AND a.status = 'approved' AND r.started_at <= ${at} AND r.ends_at > ${at}
        `;
        if (runs.length === 0) {
            set.status = 204;
            return;
        }

        const run = pick(runs);
        await sql`UPDATE user_ad_runs SET impressions = impressions + 1 WHERE id = ${run.id}`;

        const [width, height] = SIZES[query.size]!;
        return {
            id: Number(run.ad_id),
            run: Number(run.id),
            name: run.name,
            size: query.size,
            width,
            height,
            image: await mediaUrl("ads", Number(run.ad_id)),
            url: targetUrl(run.target_type, Number(run.target_id)),
            click: `/api/ads/click/${run.id}`,
            report: `/abusereport?type=ad&id=${run.ad_id}`
        };
    }, {
        query: t.Object({
            size
        })
    })

    .get("/api/ads/click/:id", async ({ params, redirect, status }) => {
        const [ad] = await sql`
            UPDATE user_ad_runs r SET clicks = clicks + 1
            FROM user_ads a
            WHERE r.id = ${params.id} AND a.id = r.ad_id
            RETURNING a.target_type, a.target_id
        `;
        if (!ad) {
            return status(404, {
                error: "That ad does not exist."
            });
        }
        return redirect(targetUrl(ad.target_type, Number(ad.target_id)), 302);
    }, {
        params: id
    })

    .post("/api/ads/report/:id", async ({ params, body, user, status }) => {
        const [ad] = await sql`SELECT id FROM user_ads WHERE id = ${params.id}`;
        if (!ad) {
            return status(404, {
                error: "That ad does not exist."
            });
        }
        const reason = body?.reason ?? "Inappropriate Content";
        if (!REASONS.includes(reason)) {
            return status(400, {
                error: "Please select a reason."
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
            VALUES (${user.id}, 'ad', ${params.id}, ${reason}, ${(body?.comment ?? "").trim().slice(0, 2000)}, 'site', '', ${now()})
        `;
        return {
            ok: true
        };
    }, {
        auth: true,
        params: id,
        body: t.Optional(t.Object({
            reason: t.Optional(t.String()),
            comment: t.Optional(t.String({ maxLength: 4000 }))
        }))
    })

    .get("/api/admin/ads", async ({ query }) => {
        const wanted = STATUSES.includes(query.status ?? "") ? query.status! : "pending";
        const [count] = await sql`SELECT COUNT(*)::int AS n FROM user_ads WHERE status = ${wanted}`;
        const total = Number(count.n);
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
        const rows = await sql`
            SELECT ${AD_COLS}, u.username AS creator_name,
                (SELECT COUNT(*)::int FROM abuse_reports WHERE type = 'ad' AND target_id = a.id AND status = 'open') AS reports,
                EXISTS (SELECT 1 FROM user_ad_runs WHERE ad_id = a.id AND ends_at > ${now()}) AS running
            FROM user_ads a
            ${AD_TARGETS}
            LEFT JOIN users u ON u.id = a.creator_id
            WHERE a.status = ${wanted}
            ORDER BY a.id ${wanted === "pending" ? sql`ASC` : sql`DESC`}
            LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;
        const items = [];
        for (const a of rows) {
            items.push({
                ...await adRow(a),
                creator_id: Number(a.creator_id),
                creator_name: a.creator_name ?? "",
                reports: Number(a.reports),
                running: !!a.running
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

    .post("/api/admin/ads/:id/approve", async ({ params, user, status }) => {
        try {
            await setStatus(params.id, "approved", user.id);
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        params: id
    })

    .post("/api/admin/ads/:id/reject", async ({ params, user, status }) => {
        try {
            await setStatus(params.id, "rejected", user.id);
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        admin: true,
        params: id
    });
