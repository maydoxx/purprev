import { sql, now } from "./db";

export type NotificationKind = "message" | "friend_request" | "friend_accepted" | "follow" | "group_affiliate" | "group_affiliate_accepted";

export const notify = async (userId: number, actorId: number, kind: NotificationKind, targetId = 0) => {
    if (userId === actorId) {
        return;
    }
    try {
        await sql`
            INSERT INTO notifications (user_id, actor_id, kind, target_id, is_read, created_at)
            VALUES (${userId}, ${actorId}, ${kind}, ${targetId}, 0, ${now()})
        `;
    } catch (err) {
        console.error("Notification delivery failed:", err);
    }
};
