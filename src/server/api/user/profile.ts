import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { isOnline, friendStatus, friendCount, friendsOf } from "../../friends";
import { withThumbnail, mediaUrl } from "../../paths";
import { rcc } from "../../rcc";
import { membershipOf } from "../../membership";
import { siteBadges } from "../../badges";
import { collectionOf } from "./collections";


const TERMINATED = 6;

export const profile = new Elysia({ prefix: "/profile" })
    .use(session)
    .get("/:id", async ({ params, user, status }) => {
        const [row] = await sql`
            SELECT id, username, about, admin, created_at, lastOnlineSite, ongoing_action_id, membership, membership_expires, social_discord, social_twitter, social_youtube
            FROM users WHERE id = ${params.id}
        `;

        if (!row) {
            return status(404, {
                error: "unknown user"
            });
        }

        if (row.ongoing_action_id) {
            const [action] = await sql`SELECT action FROM moderation_actions WHERE id = ${row.ongoing_action_id}`;
            if (action?.action === TERMINATED && !(user && user.admin > 0)) {
                return status(404, {
                    error: "unknown user"
                });
            }
        }

        const [games, badges, counts, wearing, friends, earned, favorites, history, collection, memberships] = await Promise.all([
            sql`SELECT id, title, visits FROM games WHERE creator_id = ${row.id}`,
            sql`
                SELECT b.id, b.name, b.game_id, b.icon FROM user_badges ub
                JOIN game_badges b ON b.id = ub.badge_id
                WHERE ub.user_id = ${row.id}
                ORDER BY ub.awarded_at DESC LIMIT 6
            `,
            sql`
                SELECT
                    (SELECT COUNT(*) FROM user_badges WHERE user_id = ${row.id}) AS badges,
                    (SELECT COUNT(*) FROM forum_posts WHERE author_id = ${row.id}) AS posts
            `,
            sql`
                SELECT catalog_items.id, catalog_items.name, catalog_items.category, catalog_items.thumbnail FROM user_items
                JOIN catalog_items ON catalog_items.id = user_items.item_id
                WHERE user_items.user_id = ${row.id} AND user_items.wearing = 1
                ORDER BY catalog_items.category, catalog_items.id
            `,
            friendsOf(row.id, 9),
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
                    (SELECT COUNT(*) FROM group_members x WHERE x.group_id = g.id) AS member_count
                FROM group_members gm
                JOIN site_groups g ON g.id = gm.group_id
                WHERE gm.user_id = ${row.id}
                ORDER BY gm.rank DESC, gm.joined_at ASC
            `
        ]);

        const playing = await rcc.players(favorites.map((g: any) => Number(g.id)));
        const [followCounts] = await sql`
            SELECT (SELECT COUNT(*) FROM user_follows WHERE followed_id = ${row.id}) AS followers,
                (SELECT COUNT(*) FROM user_follows WHERE follower_id = ${row.id}) AS following
        `;
        const [followed] = user ? await sql`SELECT 1 FROM user_follows WHERE follower_id = ${user.id} AND followed_id = ${row.id}` : [null];

        return {
            id: row.id,
            username: row.username,
            favorites: await Promise.all(favorites.map(async (g: any) => ({
                id: Number(g.id),
                title: g.title,
                creator_id: Number(g.creator_id),
                creator_name: g.creator_name ?? "Unknown",
                icon: await mediaUrl("icons", Number(g.id)),
                playing: playing[Number(g.id)] ?? 0
            }))),
            previousUsernames: history.map((h: any) => h.old_username),
            about: row.about ?? "",
            socials: {
                discord: row.social_discord ?? "",
                twitter: row.social_twitter ?? "",
                youtube: row.social_youtube ?? ""
            },
            admin: row.admin > 0,
            membership: membershipOf(row),
            joined: row.created_at,
            online: isOnline(row.lastOnlineSite),
            friendStatus: user ? await friendStatus(user.id, row.id) : "guest",
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
            games,
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
