import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { mediaUrl } from "../../paths";
import { rcc } from "../../rcc";
import { SITE_URL } from "../../site";
import { GENRES, gameSettings, isGenre } from "../../games";

const PER_PAGE = 20;
const DAY = 86400;

// won yesterday over who played yesterday
const RARITY: [number, string][] = [
    [1, "Impossible"],
    [5, "Insane"],
    [10, "Extreme"],
    [20, "Hard"],
    [30, "Challenging"],
    [50, "Moderate"],
    [70, "Easy"],
    [90, "Cake Walk"],
    [101, "Freebie"]
];

const rarityLabel = (percent: number) => RARITY.find(([limit]) => percent < limit)?.[1] ?? "Freebie";

const id = t.Object({
    id: t.Numeric()
});

class PurchaseError extends Error {}

const ROW = 10;

type Sort = {
    id: string;
    title: string;
    order: any;
    mine?: boolean;
};

const SORTS: Sort[] = [
    {
        id: "popular",
        title: "Popular",
        order: sql`games.visits DESC, games.id DESC`
    },
    {
        id: "top-earning",
        title: "Top Earning",
        order: sql`earnings DESC, games.visits DESC, games.id DESC`
    },
    {
        id: "top-rated",
        title: "Top Rated",
        order: sql`(up_votes + 1) / (up_votes + down_votes + 2) DESC, games.visits DESC, games.id DESC`
    },
    {
        id: "recommended",
        title: "Recommended",
        order: sql`RAND() * LOG10(games.visits + 10) DESC`
    },
    {
        id: "featured",
        title: "Featured",
        order: sql`games.updated_at DESC, games.id DESC`
    },
    {
        id: "top-favorited",
        title: "Top Favorited",
        order: sql`favorites DESC, games.visits DESC, games.id DESC`
    },
    {
        id: "recently-updated",
        title: "Recently Updated",
        order: sql`games.updated_at DESC, games.id DESC`
    },
    {
        id: "newest",
        title: "Recently Created",
        order: sql`games.created_at DESC, games.id DESC`
    },
    {
        id: "most-visited",
        title: "Most Visited",
        order: sql`games.visits DESC, games.id DESC`
    },
    {
        id: "recently-played",
        title: "Recently Played",
        order: sql`plays.played_at DESC`,
        mine: true
    },
    {
        id: "my-favorites",
        title: "My Favorites",
        order: sql`fav.created_at DESC`,
        mine: true
    }
];

const sortById = (id: string) => SORTS.find(s => s.id === id);

const publicSorts = (loggedIn: boolean) => SORTS.filter(s => loggedIn || !s.mine).map(s => ({
    id: s.id,
    title: s.title
}));

// popular is whoever has players right now, visits break the tie
const byPlaying = (rows: any[], playing: Record<number, number>) =>
    [...rows].sort((a, b) => (playing[Number(b.id)] ?? 0) - (playing[Number(a.id)] ?? 0) || Number(b.visits) - Number(a.visits));

const listGames = async (sort: Sort, userId: number, page: number, limit: number, q = "", genre = "All") => {
    const like = `%${q.trim()}%`;
    const scope = sort.id === "recently-played" ? sql`plays.user_id IS NOT NULL`
        : sort.id === "my-favorites" ? sql`fav.user_id IS NOT NULL`
        : sort.id === "featured" ? sql`games.featured = 1 AND games.title LIKE ${like}`
        : sql`games.title LIKE ${like}`;
    const where = isGenre(genre) && genre !== "All" ? sql`${scope} AND games.genre = ${genre}` : scope;
    const [count] = await sql`
        SELECT COUNT(*) AS n FROM games
        LEFT JOIN game_plays plays ON plays.game_id = games.id AND plays.user_id = ${userId}
        LEFT JOIN game_favorites fav ON fav.game_id = games.id AND fav.user_id = ${userId}
        WHERE ${where}
    `;
    const totalPages = Math.max(1, Math.ceil(Number(count.n) / limit));
    const current = Math.min(Math.max(1, page), totalPages);
    const rows = await sql`
        SELECT games.*, users.username AS creator_name,
            (SELECT COUNT(*) FROM game_favorites f WHERE f.game_id = games.id) AS favorites,
            (SELECT COUNT(*) FROM game_votes v WHERE v.game_id = games.id AND v.vote = 1) AS up_votes,
            (SELECT COUNT(*) FROM game_votes v WHERE v.game_id = games.id AND v.vote = -1) AS down_votes,
            (SELECT COALESCE(SUM(p.price), 0) FROM user_game_passes ugp JOIN game_passes p ON p.id = ugp.pass_id WHERE p.game_id = games.id) AS earnings
        FROM games
        LEFT JOIN users ON users.id = games.creator_id
        LEFT JOIN game_plays plays ON plays.game_id = games.id AND plays.user_id = ${userId}
        LEFT JOIN game_favorites fav ON fav.game_id = games.id AND fav.user_id = ${userId}
        WHERE ${where}
        ORDER BY ${sort.order} LIMIT ${limit} OFFSET ${(current - 1) * limit}
    `;
    const playing = await rcc.players(rows.map((g: any) => Number(g.id)));
    const ordered = sort.id === "popular" ? byPlaying(rows, playing) : rows;
    return {
        page: current,
        totalPages,
        games: await Promise.all(ordered.map((g: any) => withMedia(g, playing[Number(g.id)])))
    };
};


const ratio = (up: number, down: number) => up + down > 0 ? Math.round(up / (up + down) * 100) : 0;

const withMedia = async (game: any, playing = 0) => ({
    ...game,
    ...gameSettings(game),
    thumbnail: await mediaUrl("thumbnails", game.id),
    icon: await mediaUrl("icons", game.id),
    playing,
    visits: Number(game.visits ?? 0),
    favorites: Number(game.favorites ?? 0),
    up_votes: Number(game.up_votes ?? 0),
    down_votes: Number(game.down_votes ?? 0),
    earnings: Number(game.earnings ?? 0),
    like_ratio: ratio(Number(game.up_votes ?? 0), Number(game.down_votes ?? 0))
});

export const games = new Elysia({ prefix: "/api/games" })
    .use(session)

    .get("/", async ({ query, user, status }) => {
        const sort = sortById(query.sort ?? "newest");
        if (!sort) {
            return status(404, {
                error: "No such sort"
            });
        }
        if (sort.mine && !user) {
            return status(401, {
                error: "Log in to see this sort"
            });
        }
        return {
            sort: {
                id: sort.id,
                title: sort.title
            },
            sorts: publicSorts(!!user),
            genres: GENRES,
            genre: isGenre(query.genre) ? query.genre : "All",
            ...await listGames(sort, user?.id ?? 0, query.page ?? 1, PER_PAGE, query.q ?? "", query.genre ?? "All")
        };
    }, {
        query: t.Object({
            q: t.Optional(t.String()),
            sort: t.Optional(t.String()),
            genre: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    // the games page, one row per sort, yours only when you have some
    .get("/sorts", async ({ query, user }) => {
        const rows = [];
        for (const sort of SORTS.filter(s => s.id !== "most-visited")) {
            if (sort.mine && !user) {
                continue;
            }
            const list = await listGames(sort, user?.id ?? 0, 1, ROW, "", query.genre ?? "All");
            if (list.games.length > 0) {
                rows.push({
                    id: sort.id,
                    title: sort.title,
                    games: list.games
                });
            }
        }
        return {
            rows,
            sorts: publicSorts(!!user),
            genres: GENRES,
            genre: isGenre(query.genre) ? query.genre : "All"
        };
    }, {
        query: t.Object({
            genre: t.Optional(t.String())
        })
    })

    .get("/:id", async ({ params, user, status }) => {
        const [game] = await sql`
            SELECT games.*, users.username AS creator_name,
                (SELECT COUNT(*) FROM game_favorites f WHERE f.game_id = games.id) AS favorites,
                (SELECT COUNT(*) FROM game_votes v WHERE v.game_id = games.id AND v.vote = 1) AS up_votes,
                (SELECT COUNT(*) FROM game_votes v WHERE v.game_id = games.id AND v.vote = -1) AS down_votes
            FROM games
            LEFT JOIN users ON users.id = games.creator_id
            WHERE games.id = ${params.id}
        `;
        if (!game) {
            return status(404, {
                error: "This game does not exist"
            });
        }
        const playing = await rcc.players([params.id]);
        const [mine] = user ? await sql`SELECT 1 FROM game_favorites WHERE game_id = ${params.id} AND user_id = ${user.id}` : [null];
        const [vote] = user ? await sql`SELECT vote FROM game_votes WHERE game_id = ${params.id} AND user_id = ${user.id}` : [null];
        return {
            ...await withMedia(game, playing[params.id]),
            favorited: !!mine,
            my_vote: vote ? Number(vote.vote) : 0
        };
    }, {
        params: id
    })

    .get("/:id/leaderboard", async ({ params }) => {
        const rows = await sql`
            SELECT u.id, u.username, COUNT(*) AS plays FROM game_visit_sessions v
            JOIN users u ON u.id = v.user_id
            WHERE v.game_id = ${params.id}
            GROUP BY u.id, u.username
            ORDER BY plays DESC, u.id ASC LIMIT 25
        `;
        return rows.map((r: any) => ({
            id: Number(r.id),
            username: r.username,
            plays: Number(r.plays)
        }));
    }, {
        params: id
    })

    .get("/:id/servers", async ({ params }) => {
        const servers = await rcc.servers();
        return servers.filter(server => Number(server.placeId) === params.id).map(server => ({
            jobId: server.jobId,
            players: server.players,
            ready: server.ready
        }));
    }, {
        params: id
    })

    .get("/:id/vip", async ({ params, user }) => {
        if (!user) {
            return [];
        }
        const rows = await sql`
            SELECT v.id, v.name, v.owner_id, u.username AS owner_name, v.created_at FROM vip_servers v
            JOIN users u ON u.id = v.owner_id
            LEFT JOIN vip_server_members m ON m.vip_id = v.id AND m.user_id = ${user.id}
            WHERE v.game_id = ${params.id} AND (v.owner_id = ${user.id} OR m.user_id = ${user.id})
            ORDER BY v.created_at DESC
        `;
        return await Promise.all(rows.map(async (vip: any) => ({
            ...vip,
            members: Number(vip.owner_id) === user.id
                ? await sql`SELECT u.id, u.username FROM vip_server_members m JOIN users u ON u.id = m.user_id WHERE m.vip_id = ${vip.id} ORDER BY u.username`
                : []
        })));
    }, {
        params: id
    })

    .post("/:id/vip", async ({ params, body, user, status }) => {
        const [game] = await sql`SELECT id FROM games WHERE id = ${params.id}`;
        if (!game) {
            return status(404, {
                error: "Game not found"
            });
        }
        const name = body.name.trim();
        if (!name) {
            return status(400, {
                error: "Name your VIP server"
            });
        }
        const [count] = await sql`SELECT COUNT(*) AS n FROM vip_servers WHERE game_id = ${params.id} AND owner_id = ${user.id}`;
        if (Number(count.n) >= 5) {
            return status(400, {
                error: "You can create up to five VIP servers per game"
            });
        }
        await sql`INSERT INTO vip_servers (game_id, owner_id, name, created_at) VALUES (${params.id}, ${user.id}, ${name}, ${now()})`;
        return {
            ok: true
        };
    }, {
        auth: true,
        params: id,
        body: t.Object({
            name: t.String({ maxLength: 60 })
        })
    })

    .post("/:id/vip/:vipId/invite", async ({ params, body, user, status }) => {
        const [vip] = await sql`SELECT id FROM vip_servers WHERE id = ${params.vipId} AND game_id = ${params.id} AND owner_id = ${user.id}`;
        if (!vip) {
            return status(404, {
                error: "VIP server not found"
            });
        }
        const [invitee] = await sql`SELECT id FROM users WHERE username = ${body.username.trim()}`;
        if (!invitee) {
            return status(404, {
                error: "User not found"
            });
        }
        await sql`INSERT IGNORE INTO vip_server_members (vip_id, user_id) VALUES (${params.vipId}, ${invitee.id})`;
        return {
            ok: true
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            vipId: t.Numeric()
        }),
        body: t.Object({
            username: t.String({ maxLength: 32 })
        })
    })

    .delete("/:id/vip/:vipId/invite/:userId", async ({ params, user, status }) => {
        const [vip] = await sql`SELECT id FROM vip_servers WHERE id = ${params.vipId} AND game_id = ${params.id} AND owner_id = ${user.id}`;
        if (!vip) {
            return status(404, {
                error: "VIP server not found"
            });
        }
        await sql`DELETE FROM vip_server_members WHERE vip_id = ${params.vipId} AND user_id = ${params.userId}`;
        return {
            ok: true
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            vipId: t.Numeric(),
            userId: t.Numeric()
        })
    })

    .delete("/:id/vip/:vipId", async ({ params, user, status }) => {
        const [vip] = await sql`SELECT id FROM vip_servers WHERE id = ${params.vipId} AND game_id = ${params.id} AND owner_id = ${user.id}`;
        if (!vip) {
            return status(404, {
                error: "VIP server not found"
            });
        }
        await sql.begin(async tx => {
            await tx`DELETE FROM vip_server_members WHERE vip_id = ${params.vipId}`;
            await tx`DELETE FROM vip_servers WHERE id = ${params.vipId}`;
        });
        return {
            ok: true
        };
    }, {
        auth: true,
        params: t.Object({
            id: t.Numeric(),
            vipId: t.Numeric()
        })
    })

    .post("/:id/favorite", async ({ params, user, status }) => {
        const [game] = await sql`SELECT id FROM games WHERE id = ${params.id}`;
        if (!game) {
            return status(404, {
                error: "This game does not exist"
            });
        }
        const gone = await sql`DELETE FROM game_favorites WHERE user_id = ${user.id} AND game_id = ${params.id}`;
        if (!gone.affectedRows) {
            await sql`INSERT INTO game_favorites (user_id, game_id, created_at) VALUES (${user.id}, ${params.id}, ${now()})`;
        }
        const [count] = await sql`SELECT COUNT(*) AS n FROM game_favorites WHERE game_id = ${params.id}`;
        return {
            favorited: !gone.affectedRows,
            favorites: Number(count.n)
        };
    }, {
        auth: true,
        params: id
    })


    // thumbs up or down, the same thumb again takes it back
    .post("/:id/vote", async ({ params, body, user, status }) => {
        const [game] = await sql`SELECT id FROM games WHERE id = ${params.id}`;
        if (!game) {
            return status(404, {
                error: "This game does not exist"
            });
        }
        const wanted = body.vote === "up" ? 1 : -1;
        const [current] = await sql`SELECT vote FROM game_votes WHERE user_id = ${user.id} AND game_id = ${params.id}`;
        let mine = wanted;
        if (current && Number(current.vote) === wanted) {
            await sql`DELETE FROM game_votes WHERE user_id = ${user.id} AND game_id = ${params.id}`;
            mine = 0;
        } else {
            await sql`
                INSERT INTO game_votes (user_id, game_id, vote, created_at) VALUES (${user.id}, ${params.id}, ${wanted}, ${now()})
                ON DUPLICATE KEY UPDATE vote = ${wanted}, created_at = ${now()}
            `;
        }
        const [counts] = await sql`
            SELECT SUM(vote = 1) AS up_votes, SUM(vote = -1) AS down_votes FROM game_votes WHERE game_id = ${params.id}
        `;
        return {
            my_vote: mine,
            up_votes: Number(counts.up_votes ?? 0),
            down_votes: Number(counts.down_votes ?? 0)
        };
    }, {
        auth: true,
        params: id,
        body: t.Object({
            vote: t.Union([
                t.Literal("up"),
                t.Literal("down")
            ])
        })
    })

    .get("/:id/launch", ({ params, query, token }) => {
        const launcher = `${SITE_URL}/Game/PlaceLauncher.ashx?request=RequestGame&placeId=${params.id}${query.jobId ? `&jobId=${encodeURIComponent(query.jobId)}` : ""}`;
        return {
            url: `nonerev-launcher:1+launchmode:play+gameinfo:${encodeURIComponent(token!)}+launchtime:${Date.now()}+placelauncherurl:${encodeURIComponent(launcher)}+browsertrackerid:false+robloxLocale:en_us+gameLocale:en_us`
        };
    }, {
        auth: true,
        params: id,
        query: t.Object({
            jobId: t.Optional(t.String({ maxLength: 64 }))
        })
    })

    .get("/:id/badges", async ({ params }) => {
        const since = now() - DAY;
        const [visitors] = await sql`SELECT COUNT(*) AS n FROM game_plays WHERE game_id = ${params.id} AND played_at > ${since}`;
        const rows = await sql`
            SELECT b.*,
                (SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id) AS awarded_count,
                (SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id AND ub.awarded_at > ${since}) AS won_yesterday
            FROM game_badges b
            WHERE b.game_id = ${params.id}
            ORDER BY b.id ASC
        `;
        const played = Number(visitors.n);
        return await Promise.all(rows.map(async (b: any) => {
            const yesterday = Number(b.won_yesterday);
            const percent = played > 0 ? Math.min(100, yesterday / played * 100) : 0;
            return {
                ...b,
                id: Number(b.id),
                awarded_count: Number(b.awarded_count),
                won_yesterday: yesterday,
                rarity: Math.round(percent * 10) / 10,
                rarity_label: rarityLabel(percent),
                icon: b.icon || await mediaUrl("badges", Number(b.id))
            };
        }));
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
