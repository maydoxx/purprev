import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { isOnline, friendStatus, friendCount, friendsOf } from "../../friends";
import { withThumbnail } from "../../paths";

// account_deletion, only admins can see those
const TERMINATED = 6;

export const profile = new Elysia({ prefix: "/profile" })
    .use(session)
    .get("/:id", async ({ params, user, status }) => {
        const [row] = await sql`
            SELECT id, username, about, admin, created_at, lastOnlineSite, ongoing_action_id
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

        const [games, badges, counts, wearing, friends] = await Promise.all([
            sql`SELECT id, title FROM games WHERE creator_id = ${row.id}`,
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
            friendsOf(row.id, 9)
        ]);

        return {
            id: row.id,
            username: row.username,
            about: row.about ?? "",
            admin: row.admin > 0,
            joined: row.created_at,
            online: isOnline(row.lastOnlineSite),
            friendStatus: user ? await friendStatus(user.id, row.id) : "guest",
            friendCount: await friendCount(row.id),
            friends,
            wearing: await Promise.all(wearing.map(withThumbnail)),
            games,
            badges,
            badgeCount: Number(counts[0].badges),
            postCount: Number(counts[0].posts)
        };
    }, {
        params: t.Object({
            id: t.Numeric()
        })
    })
