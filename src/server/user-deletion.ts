import { sql, now } from "./db";
import { rcc } from "./rcc";
import { storage } from "./storage";
import { mediaEntry, mediaKey, mediaHas, mediaRemove } from "./media";
import { sql as _sql } from "bun";

interface DeletionResult {
    success: boolean;
    deletedCounts: Record<string, number>;
    errors: string[];
}

const USER_OWNED_TABLES = [
    { table: "tokens", column: "user_id" },
    { table: "user_items", column: "user_id" },
    { table: "user_avatar", column: "user_id" },
    { table: "avatar_outfits", column: "user_id" },
    { table: "notifications", column: "user_id" },
    { table: "user_game_passes", column: "user_id" },
    { table: "product_receipts", column: "user_id" },
    { table: "user_badges", column: "user_id" },
    { table: "game_favorites", column: "user_id" },
    { table: "game_votes", column: "user_id" },
    { table: "game_plays", column: "user_id" },
    { table: "game_visit_sessions", column: "user_id" },
    { table: "forum_subscriptions", column: "user_id" },
    { table: "group_members", column: "user_id" },
    { table: "group_join_requests", column: "user_id" },
    { table: "group_wall_posts", column: "user_id" },
    { table: "vip_server_members", column: "user_id" },
    { table: "reserved_server_access", column: "user_id" },
    { table: "promo_redemptions", column: "user_id" },
    { table: "user_collections", column: "user_id" },
    { table: "catalog_favorites", column: "user_id" },
    { table: "comments", column: "user_id" },
    { table: "content_deletions", column: "user_id" },
    { table: "resale_listings", column: "user_id" },
    { table: "applications", column: "user_id" },
    { table: "username_history", column: "user_id" },
    { table: "status_updates", column: "user_id" },
    { table: "chat_messages", column: "sender_id" },
    { table: "chat_messages", column: "recipient_id" },
    { table: "messages", column: "sender_id" },
    { table: "messages", column: "recipient_id" },
    { table: "friendships", column: "requester_id" },
    { table: "friendships", column: "target_id" },
    { table: "user_follows", column: "follower_id" },
    { table: "user_follows", column: "followed_id" },
    { table: "user_blocks", column: "blocker_id" },
    { table: "user_blocks", column: "blocked_id" },
];

const USER_CREATED_TABLES = [
    // site_groups and vip_servers are dealt with separately so owned groups can
    // be transferred instead of silently deleted
    { table: "games", column: "creator_id", cascade: true }, // cascade to place_versions, media
    { table: "catalog_items", column: "creator_id", cascade: true }, // cascade to user_items, media
    { table: "assets", column: "creator_id", cascade: true }, // cascade to child assets, media
    { table: "game_passes", column: "creator_id" },
    { table: "game_badges", column: "creator_id" },
    { table: "developer_products", column: "creator_id" },
    { table: "blog_posts", column: "author_id" },
    { table: "forum_threads", column: "author_id" },
    { table: "forum_posts", column: "author_id" },
    { table: "invite_log", column: "created_by" },
    { table: "promo_codes", column: "created_by" },
    { table: "user_ads", column: "creator_id" },
    { table: "sets", column: "user_id" },
    { table: "place_versions", column: "uploaded_by" },
];

const MODERATION_TABLES = [
    { table: "moderation_actions", column: "user_id" },
    { table: "moderation_actions", column: "moderatedBy" },
    { table: "moderation_offenses", column: "action_id" }, // via moderation_actions
];

const MEDIA_KINDS = [
    "avatars", "headshots", "avatars3d",
    "thumbnails", "icons",
    "catalog", "catalog3d",
    "badges", "gamepasses",
    "blog", "groups",
    "places", "assets",
    "ads", "outfits"
];

async function deleteUserData(userId: number): Promise<DeletionResult> {
    const result: DeletionResult = {
        success: false,
        deletedCounts: {},
        errors: []
    };

    try {
        await sql.begin(async tx => {
            // stop any live servers for the user's places first
            const userGames = await tx`SELECT id FROM games WHERE creator_id = ${userId}`;
            for (const game of userGames) {
                try {
                    await rcc.closePlace(Number(game.id));
                } catch (err) {
                    result.errors.push(`Failed to close place ${game.id}: ${err}`);
                }
            }

            // media the rows below point at, removed before the rows themselves
            for (const game of userGames) {
                for (const kind of ["places", "thumbnails", "icons"]) {
                    try {
                        await mediaRemove(kind, Number(game.id));
                        result.deletedCounts[`media_${kind}_${game.id}`] = 1;
                    } catch {}
                }
            }

            const userCatalogItems = await tx`SELECT id FROM catalog_items WHERE creator_id = ${userId}`;
            for (const item of userCatalogItems) {
                for (const kind of ["catalog", "catalog3d"]) {
                    try {
                        await mediaRemove(kind, Number(item.id));
                    } catch {}
                }
            }

            const userAssets = await tx`SELECT id FROM assets WHERE creator_id = ${userId}`;
            for (const asset of userAssets) {
                try {
                    await mediaRemove("assets", Number(asset.id));
                } catch {}
            }

            for (const kind of ["avatars", "headshots", "avatars3d", "outfits"]) {
                try {
                    await mediaRemove(kind, userId);
                } catch {}
            }

            // direct ownership rows
            for (const { table, column } of USER_OWNED_TABLES) {
                try {
                    const res = await tx`DELETE FROM ${_sql(table)} WHERE ${_sql(column)} = ${userId}`;
                    result.deletedCounts[table] = (result.deletedCounts[table] || 0) + Number(res.count || 0);
                } catch (err) {
                    result.errors.push(`DELETE ${table} WHERE ${column}=${userId}: ${err}`);
                }
            }

            // whole conversations go, not just the user's side of them
            try {
                const conversationIds = await tx`
                    SELECT DISTINCT id FROM messages
                    WHERE sender_id = ${userId} OR recipient_id = ${userId}
                `;
                for (const msg of conversationIds) {
                    await tx`DELETE FROM messages WHERE id = ${msg.id}`;
                }
                result.deletedCounts.messages = conversationIds.length;
            } catch (err) {
                result.errors.push(`messages cleanup: ${err}`);
            }

            try {
                const chatConversationIds = await tx`
                    SELECT DISTINCT sender_id, recipient_id FROM chat_messages
                    WHERE sender_id = ${userId} OR recipient_id = ${userId}
                `;
                for (const conv of chatConversationIds) {
                    const otherId = Number(conv.sender_id) === userId ? Number(conv.recipient_id) : Number(conv.sender_id);
                    await tx`DELETE FROM chat_messages WHERE (sender_id = ${userId} AND recipient_id = ${otherId}) OR (sender_id = ${otherId} AND recipient_id = ${userId})`;
                }
                result.deletedCounts.chat_messages = chatConversationIds.length;
            } catch (err) {
                result.errors.push(`chat_messages cleanup: ${err}`);
            }

            // rows that point at content about to be deleted
            try {
                await tx`DELETE FROM user_ad_runs WHERE ad_id IN (SELECT id FROM user_ads WHERE creator_id = ${userId})`;
            } catch (err) {
                result.errors.push(`user_ad_runs cleanup: ${err}`);
            }
            try {
                await tx`DELETE FROM set_items WHERE set_id IN (SELECT id FROM sets WHERE user_id = ${userId})`;
            } catch (err) {
                result.errors.push(`set_items cleanup: ${err}`);
            }
            try {
                await tx`DELETE FROM place_versions WHERE place_id IN (SELECT id FROM games WHERE creator_id = ${userId})`;
            } catch (err) {
                result.errors.push(`place_versions cleanup: ${err}`);
            }

            // content the user created
            for (const { table, column, cascade } of USER_CREATED_TABLES) {
                try {
                    let ids: number[] = [];
                    if (cascade && (table === "games" || table === "catalog_items" || table === "assets")) {
                        const rows = await tx`SELECT id FROM ${_sql(table)} WHERE ${_sql(column)} = ${userId}`;
                        ids = rows.map((r: any) => Number(r.id));
                    }

                    const res = await tx`DELETE FROM ${_sql(table)} WHERE ${_sql(column)} = ${userId}`;
                    result.deletedCounts[table] = Number(res.count || 0);

                    if (cascade && ids.length > 0) {
                        if (table === "games") {
                            for (const id of ids) {
                                for (const kind of ["places", "thumbnails", "icons"]) {
                                    try { await mediaRemove(kind, id); } catch {}
                                }
                            }
                        } else if (table === "catalog_items") {
                            for (const id of ids) {
                                for (const kind of ["catalog", "catalog3d"]) {
                                    try { await mediaRemove(kind, id); } catch {}
                                }
                            }
                        } else if (table === "assets") {
                            for (const id of ids) {
                                try { await mediaRemove("assets", id); } catch {}
                            }
                        }
                    }
                } catch (err) {
                    result.errors.push(`DELETE ${table} WHERE ${column}=${userId}: ${err}`);
                }
            }

            // hand a group to its highest ranked member, or delete it if the user
            // was the only one in it
            try {
                const ownedGroups = await tx`SELECT id FROM site_groups WHERE owner_id = ${userId}`;
                for (const group of ownedGroups) {
                    const [nextOwner] = await tx`
                        SELECT user_id FROM group_members
                        WHERE group_id = ${group.id} AND user_id != ${userId}
                        ORDER BY rank DESC LIMIT 1
                    `;
                    if (nextOwner) {
                        await tx`UPDATE site_groups SET owner_id = ${nextOwner.user_id} WHERE id = ${group.id}`;
                    } else {
                        await tx`DELETE FROM group_members WHERE group_id = ${group.id}`;
                        await tx`DELETE FROM group_join_requests WHERE group_id = ${group.id}`;
                        await tx`DELETE FROM group_wall_posts WHERE group_id = ${group.id}`;
                        await tx`DELETE FROM group_store_items WHERE group_id = ${group.id}`;
                        await tx`DELETE FROM group_games WHERE group_id = ${group.id}`;
                        await tx`DELETE FROM group_affiliates WHERE group_id = ${group.id} OR other_group_id = ${group.id}`;
                        await tx`DELETE FROM group_roles WHERE group_id = ${group.id}`;
                        await tx`DELETE FROM site_groups WHERE id = ${group.id}`;
                        result.deletedCounts.site_groups = (result.deletedCounts.site_groups || 0) + 1;
                    }
                }
            } catch (err) {
                result.errors.push(`site_groups cleanup: ${err}`);
            }

            try {
                const ownedVips = await tx`SELECT id FROM vip_servers WHERE owner_id = ${userId}`;
                for (const vip of ownedVips) {
                    await tx`DELETE FROM vip_server_members WHERE vip_id = ${vip.id}`;
                    await tx`DELETE FROM vip_servers WHERE id = ${vip.id}`;
                    result.deletedCounts.vip_servers = (result.deletedCounts.vip_servers || 0) + 1;
                }
            } catch (err) {
                result.errors.push(`vip_servers cleanup: ${err}`);
            }

            // moderation, invite, promo and audit rows are kept for their records
            // but unlinked from the account
            try {
                await tx`UPDATE moderation_actions SET user_id = 0 WHERE user_id = ${userId}`;
                await tx`UPDATE moderation_actions SET "moderatedBy" = 0 WHERE "moderatedBy" = ${userId}`;
                result.deletedCounts.moderation_actions_anonymized = 1;
            } catch (err) {
                result.errors.push(`moderation_actions anonymize: ${err}`);
            }

            try {
                await tx`UPDATE invite_log SET created_by = 0 WHERE created_by = ${userId}`;
                await tx`DELETE FROM invite_log WHERE used_by = ${userId}`;
                result.deletedCounts.invite_log_anonymized = 1;
            } catch (err) {
                result.errors.push(`invite_log cleanup: ${err}`);
            }
            try {
                await tx`UPDATE promo_codes SET created_by = 0 WHERE created_by = ${userId}`;
            } catch (err) {
                result.errors.push(`promo_codes cleanup: ${err}`);
            }

            // reserved servers are not tied to a user_id, nothing to do here

            try {
                await tx`UPDATE admin_audit SET admin_id = 0, admin_name = 'deleted_user' WHERE admin_id = ${userId}`;
            } catch (err) {
                result.errors.push(`admin_audit anonymize: ${err}`);
            }

            try {
                await tx`UPDATE security_audit SET user_id = 0, username = 'deleted_user' WHERE user_id = ${userId}`;
            } catch (err) {
                result.errors.push(`security_audit anonymize: ${err}`);
            }

            // financial and moderation records survive but are unlinked
            try {
                await tx`UPDATE resale_sales SET seller_id = 0 WHERE seller_id = ${userId}`;
                await tx`UPDATE resale_sales SET buyer_id = 0 WHERE buyer_id = ${userId}`;
            } catch (err) {
                result.errors.push(`resale_sales anonymize: ${err}`);
            }
            try {
                await tx`UPDATE game_cards SET redeemed_by = 0 WHERE redeemed_by = ${userId}`;
            } catch (err) {
                result.errors.push(`game_cards anonymize: ${err}`);
            }
            try {
                await tx`UPDATE abuse_reports SET reporter_id = 0 WHERE reporter_id = ${userId}`;
            } catch (err) {
                result.errors.push(`abuse_reports anonymize: ${err}`);
            }

            const userRes = await tx`DELETE FROM users WHERE id = ${userId}`;
            result.deletedCounts.users = Number(userRes.count || 0);

            if (!userRes.count) {
                throw new Error("User not found");
            }
        });

        result.success = true;
    } catch (err) {
        result.success = false;
        result.errors.push(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
}

async function adminDeleteUser(userId: number, adminId: number): Promise<DeletionResult> {
    // Log the admin action first
    try {
        await sql`
            INSERT INTO admin_audit (admin_id, admin_name, method, path, target, status, ip, details, created_at)
            VALUES (${adminId}, (SELECT username FROM users WHERE id = ${adminId}), 'DELETE', '/api/admin/users/${userId}', 'user:${userId}', 200, '', 'Admin deleted user account and all associated data', ${now()})
        `;
    } catch {}

    return deleteUserData(userId);
}

async function selfDeleteUser(userId: number): Promise<DeletionResult> {
    return deleteUserData(userId);
}

export { deleteUserData, adminDeleteUser, selfDeleteUser, type DeletionResult };