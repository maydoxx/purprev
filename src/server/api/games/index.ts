import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { mediaUrl } from "../../paths";
import { rcc } from "../../rcc";
import { SITE_URL } from "../../site";

const PER_PAGE = 20;

const id = t.Object({
    id: t.Numeric()
});

class PurchaseError extends Error {}


const withMedia = async (game: any, playing = 0) => ({
    ...game,
    description: game.description ?? "",
    thumbnail: await mediaUrl("thumbnails", game.id),
    icon: await mediaUrl("icons", game.id),
    playing,
    visits: 0,
    favorites: 0,
    up_votes: 0,
    down_votes: 0,
    like_ratio: 0,
    max_players: 50,
    genre: "All"
});

export const games = new Elysia({ prefix: "/api/games" })
    .use(session)

    .get("/", async ({ query }) => {
        const like = "%" + (query.q ?? "").trim() + "%";
        const [count] = await sql`SELECT COUNT(*) AS n FROM games WHERE title LIKE ${like}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

        const rows = await sql`
            SELECT games.*, users.username AS creator_name FROM games
            LEFT JOIN users ON users.id = games.creator_id
            WHERE title LIKE ${like}
            ORDER BY games.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
        `;

        const playing = await rcc.players(rows.map((g: any) => Number(g.id)));
        return {
            page,
            totalPages,
            games: await Promise.all(rows.map((g: any) => withMedia(g, playing[Number(g.id)])))
        };
    }, {
        query: t.Object({
            q: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .get("/:id", async ({ params, status }) => {
        const [game] = await sql`
            SELECT games.*, users.username AS creator_name FROM games
            LEFT JOIN users ON users.id = games.creator_id
            WHERE games.id = ${params.id}
        `;
        if (!game) {
            return status(404, {
                error: "This game does not exist"
            });
        }
        const playing = await rcc.players([params.id]);
        return await withMedia(game, playing[params.id]);
    }, {
        params: id
    })


    .get("/:id/launch", ({ params, token }) => {
        const launcher = `${SITE_URL}/Game/PlaceLauncher.ashx?request=RequestGame&placeId=${params.id}`;
        return {
            url: `nonerev-launcher:1+launchmode:play+gameinfo:${encodeURIComponent(token!)}+launchtime:${Date.now()}+placelauncherurl:${encodeURIComponent(launcher)}+browsertrackerid:false+robloxLocale:en_us+gameLocale:en_us`
        };
    }, {
        auth: true,
        params: id
    })

    .get("/:id/badges", async ({ params }) => {
        const rows = await sql`
            SELECT b.*, (SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id) AS awarded_count
            FROM game_badges b WHERE b.game_id = ${params.id} ORDER BY b.id ASC
        `;
        return await Promise.all(rows.map(async (b: any) => ({
            ...b,
            awarded_count: Number(b.awarded_count),
            icon: await mediaUrl("badges", b.id)
        })));
    }, {
        params: id
    })

    .get("/:id/passes", async ({ params, user }) => {
        const rows = await sql`
            SELECT p.*, users.username AS creator_name FROM game_passes p
            LEFT JOIN users ON users.id = p.creator_id
            WHERE p.game_id = ${params.id} ORDER BY p.id DESC
        `;
        const owned = user
            ? new Set((await sql`SELECT pass_id FROM user_game_passes WHERE user_id = ${user.id}`).map((r: any) => Number(r.pass_id)))
            : new Set<number>();

        return await Promise.all(rows.map(async (p: any) => ({
            ...p,
            icon: await mediaUrl("gamepasses", p.id),
            owned: owned.has(Number(p.id))
        })));
    }, {
        params: id
    })

    .post("/passes/:id/purchase", async ({ params, user, status }) => {
        try {
            const balance = await sql.begin(async tx => {
                const [pass] = await tx`SELECT * FROM game_passes WHERE id = ${params.id} FOR UPDATE`;
                if (!pass) {
                    throw new PurchaseError("This game pass does not exist.");
                }
                if (pass.price === null) {
                    throw new PurchaseError("This game pass is off sale.");
                }

                const [owned] = await tx`SELECT 1 FROM user_game_passes WHERE user_id = ${user.id} AND pass_id = ${params.id} FOR UPDATE`;
                if (owned) {
                    throw new PurchaseError("You already own this game pass.");
                }

                const [me] = await tx`SELECT currency FROM users WHERE id = ${user.id} FOR UPDATE`;
                const price = Number(pass.price);
                if (Number(me.currency) < price) {
                    throw new PurchaseError("You do not have enough Nonebux.");
                }

                if (price > 0) {
                    await tx`UPDATE users SET currency = currency - ${price} WHERE id = ${user.id}`;
                    if (pass.creator_id && Number(pass.creator_id) !== user.id) {
                        await tx`UPDATE users SET currency = currency + ${price} WHERE id = ${pass.creator_id}`;
                    }
                }
                await tx`INSERT INTO user_game_passes (user_id, pass_id, purchased_at) VALUES (${user.id}, ${params.id}, ${now()})`;

                return Number(me.currency) - price;
            });

            return {
                ok: true,
                balance
            };
        } catch (err) {
            if (err instanceof PurchaseError) {
                return status(400, {
                    error: err.message
                });
            }
            throw err;
        }
    }, {
        auth: true,
        params: id
    })
