import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { isOnline, friendStatus, friendCount, friendsOf, presenceOf } from "../../friends";
import { withThumbnail, mediaUrl } from "../../paths";
import { rcc } from "../../rcc";
import { membershipOf } from "../../membership";
import { siteBadges } from "../../badges";
import { collectionOf } from "./collections";
import { DELETED_TEXT, isDeleted, deletedIds } from "../../content";
import type { User } from "../../session";
import { privacyAllows } from "../../privacy";


const TERMINATED = 6;
const CREATIONS_PER_PAGE = 6;

const CREATIONS: [string, string, string][] = [
    ["t-shirts", "T-Shirts", "T-Shirt"],
    ["hats", "Hats", "Hat"],
    ["shirts", "Shirts", "Shirt"],
    ["pants", "Pants", "Pants"],
    ["faces", "Faces", "Face"],
    ["gear", "Gear", "Gear"],
    ["packages", "Packages", "Package"],
    ["decals", "Decals", "Decal"],
    ["models", "Models", "Model"],
    ["audio", "Audio", "Audio"]
];

const ASSET_TYPES = ["Decal", "Model", "Audio"];

const hidden = async (row: any, user: User | null) => {
    if (!row.ongoing_action_id) {
        return false;
    }
    const [action] = await sql`SELECT action FROM moderation_actions WHERE id = ${row.ongoing_action_id}`;
    return action?.action === TERMINATED && !(user && user.admin > 0);
};

const creationCounts = async (userId: number) => {
    const rows = await sql`
        SELECT category AS type, COUNT(*)::int AS n FROM catalog_items WHERE creator_id = ${userId} GROUP BY category
        UNION ALL
        SELECT type, COUNT(*)::int AS n FROM assets WHERE creator_id = ${userId} AND parent_id IS NULL AND type IN ${sql(ASSET_TYPES)} GROUP BY type
    `;
    return new Map<string, number>(rows.map((r: any) => [r.type, Number(r.n)]));
};

const assetCard = async (asset: any) => {
    const deleted = asset.type === "Audio" && await isDeleted("audio", Number(asset.id));
    return {
        id: Number(asset.id),
        name: deleted ? DELETED_TEXT : asset.name,
        type: asset.type,
        thumbnail: asset.type === "Decal" ? await mediaUrl("assets", Number(asset.id)) : "",
        created_at: Number(asset.created_at),
        content_deleted: deleted
    };
};

const creations = async (userId: number, [key, title, type]: [string, string, string], total: number, page: number) => {
    const offset = (page - 1) * CREATIONS_PER_PAGE;
    const items = ASSET_TYPES.includes(type)
        ? await Promise.all((await sql`
            SELECT id, name, type, created_at FROM assets
            WHERE creator_id = ${userId} AND parent_id IS NULL AND type = ${type}
            ORDER BY id DESC LIMIT ${CREATIONS_PER_PAGE} OFFSET ${offset}
        `).map(assetCard))
        : await Promise.all((await sql`
            SELECT id, name, category, thumbnail, asset_id, price, tix_price, is_limited, is_limited_unique, bc_only, genre, created_at FROM catalog_items
            WHERE creator_id = ${userId} AND category = ${type}
            ORDER BY id DESC LIMIT ${CREATIONS_PER_PAGE} OFFSET ${offset}
        `).map(withThumbnail));
    return {
        type: key,
        title,
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / CREATIONS_PER_PAGE)),
        items
    };
};

export const profile = new Elysia({ prefix: "/profile" })
    .use(session)
    .get("/:id", async ({ params, user, status }) => {
        const [row] = await sql`
            SELECT id, username, about, admin, created_at, "lastOnlineSite", ongoing_action_id, membership, membership_expires, social_discord, social_twitter, social_youtube, profile_accent, profile_sections, message_privacy, follow_privacy, friend_request_privacy
            FROM users WHERE id = ${params.id}
        `;

        if (!row || await hidden(row, user)) {
            return status(404, {
                error: "unknown user"
            });
        }

        const [games, badges, counts, wearing, friends, earned, favorites, history, collection, memberships, [latest], presence] = await Promise.all([
            sql`SELECT id, title, visits, description FROM games WHERE creator_id = ${row.id}`,
            sql`
                SELECT b.id, b.name, b.game_id, b.icon FROM user_badges ub
                JOIN game_badges b ON b.id = ub.badge_id
                WHERE ub.user_id = ${row.id}
                ORDER BY ub.awarded_at DESC LIMIT 6
            `,
            sql`
                SELECT
                    (SELECT COUNT(*)::int FROM user_badges WHERE user_id = ${row.id}) AS badges,
                    (SELECT COUNT(*)::int FROM forum_posts WHERE author_id = ${row.id}) AS posts
            `,
            sql`
                SELECT catalog_items.id, catalog_items.name, catalog_items.category, catalog_items.thumbnail FROM user_items
                JOIN catalog_items ON catalog_items.id = user_items.item_id
                WHERE user_items.user_id = ${row.id} AND user_items.wearing = 1
                ORDER BY catalog_items.category, catalog_items.id
            `,
            friendsOf(row.id, 9, 0, user?.id ?? 0),
            siteBadges(row),
            sql`
                SELECT games.id, games.title, games.creator_id, users.username AS creator_name FROM game_favorites f
                JOIN games ON games.id = f.game_id
                LEFT JOIN users ON users.id = games.creator_id
                WHERE f.user_id = ${row.id}
                ORDER BY f.created_at DESC LIMIT 6
            `,
            sql`SELECT DISTINCT old_username FROM username_history WHERE user_id = ${row.id} AND old_username != ${row.username} ORDER BY old_username`,
            collectionOf(row.id),
            sql`
                SELECT g.id, g.name, g.description, g.icon, gm.role,
                    (SELECT COUNT(*)::int FROM group_members x WHERE x.group_id = g.id) AS member_count
                FROM group_members gm
                JOIN site_groups g ON g.id = gm.group_id
                WHERE gm.user_id = ${row.id}
                ORDER BY gm.rank DESC, gm.joined_at ASC
            `,
            sql`SELECT id, body FROM status_updates WHERE user_id = ${row.id} ORDER BY created_at DESC, id DESC LIMIT 1`,
            presenceOf([row], user?.id ?? 0)
        ]);

        const deletedPlaces = await deletedIds("place", [...games, ...favorites].map((g: any) => Number(g.id)));
        const deletedAbout = await isDeleted("bio", row.id);
        const deletedStatus = latest ? await isDeleted("status", Number(latest.id)) : false;

        const playing = await rcc.players([...favorites, ...games].map((g: any) => Number(g.id)));
        const [followCounts] = await sql`
            SELECT (SELECT COUNT(*)::int FROM user_follows WHERE followed_id = ${row.id}) AS followers,
                (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = ${row.id}) AS following
        `;
        const [followed] = user ? await sql`SELECT 1 FROM user_follows WHERE follower_id = ${user.id} AND followed_id = ${row.id}` : [null];
        const currentFriendStatus = user ? await friendStatus(user.id, row.id) : "guest";

        return {
            id: row.id,
            username: row.username,
            accent: row.profile_accent || "#7b2cbf",
            sectionOrder: String(row.profile_sections || "about,wearing,friends,collections,groups,favorites,siteBadges,playerBadges,statistics").split(","),
            canMessage: !!user && await privacyAllows(row.id, user.id, row.message_privacy),
            canFollow: !!user && (!!followed || await privacyAllows(row.id, user.id, row.follow_privacy)),
            canFriendRequest: !!user && (currentFriendStatus === "pending_in" || await privacyAllows(row.id, user.id, row.friend_request_privacy)),
            favorites: await Promise.all(favorites.map(async (g: any) => ({
                id: Number(g.id),
                title: deletedPlaces.has(Number(g.id)) ? DELETED_TEXT : g.title,
                creator_id: Number(g.creator_id),
                creator_name: g.creator_name ?? "Unknown",
                icon: await mediaUrl("icons", Number(g.id)),
                playing: playing[Number(g.id)] ?? 0
            }))),
            previousUsernames: history.map((h: any) => h.old_username),
            about: deletedAbout ? DELETED_TEXT : row.about ?? "",
            socials: {
                discord: row.social_discord ?? "",
                twitter: row.social_twitter ?? "",
                youtube: row.social_youtube ?? ""
            },
            admin: row.admin > 0,
            membership: membershipOf(row),
            joined: row.created_at,
            online: isOnline(row.lastOnlineSite),
            presence: presence(row),
            status: deletedStatus ? DELETED_TEXT : latest?.body ?? "",
            friendStatus: currentFriendStatus,
            friendCount: await friendCount(row.id),
            followerCount: Number(followCounts.followers),
            followingCount: Number(followCounts.following),
            isFollowing: !!followed,
            friends,
            wearing: await Promise.all(wearing.map(withThumbnail)),
            collection,
            groups: memberships.map((g: any) => ({
                id: Number(g.id),
                name: g.name,
                description: g.description,
                icon: g.icon,
                role: g.role,
                memberCount: Number(g.member_count)
            })),
            games: await Promise.all(games.map(async (g: any) => {
                const deleted = deletedPlaces.has(Number(g.id));
                return {
                    ...g,
                    title: deleted ? DELETED_TEXT : g.title,
                    description: deleted ? DELETED_TEXT : g.description ?? "",
                    content_deleted: deleted,
                    icon: await mediaUrl("icons", Number(g.id)),
                    thumbnail: await mediaUrl("thumbnails", Number(g.id)),
                    playing: playing[Number(g.id)] ?? 0
                };
            })),
            badges,
            siteBadges: earned,
            badgeCount: Number(counts[0].badges),
            placeVisits: games.reduce((sum: number, g: any) => sum + Number(g.visits ?? 0), 0),
            postCount: Number(counts[0].posts)
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .get("/:id/creations", async ({ params, user, status }) => {
        const [row] = await sql`SELECT id, ongoing_action_id FROM users WHERE id = ${params.id}`;
        if (!row || await hidden(row, user)) {
            return status(404, {
                error: "unknown user"
            });
        }
        const counts = await creationCounts(row.id);
        return {
            sections: await Promise.all(CREATIONS.filter(kind => counts.has(kind[2])).map(kind => creations(row.id, kind, counts.get(kind[2])!, 1)))
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .get("/:id/creations/:type", async ({ params, query, user, status }) => {
        const kind = CREATIONS.find(c => c[0] === params.type);
        if (!kind) {
            return status(404, {
                error: "unknown type"
            });
        }
        const [row] = await sql`SELECT id, ongoing_action_id FROM users WHERE id = ${params.id}`;
        if (!row || await hidden(row, user)) {
            return status(404, {
                error: "unknown user"
            });
        }
        const total = (await creationCounts(row.id)).get(kind[2]) ?? 0;
        const page = Math.min(Math.max(1, query.page ?? 1), Math.max(1, Math.ceil(total / CREATIONS_PER_PAGE)));
        return await creations(row.id, kind, total, page);
    }, {
        params: t.Object({
            id: t.Numeric(),
            type: t.String()
        }),
        query: t.Object({
            page: t.Optional(t.Numeric())
        })
    })
