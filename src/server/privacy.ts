import { sql } from "./db";
import { friendStatus } from "./friends";

export type PrivacyLevel = "everyone" | "friends" | "followers" | "nobody";

export const privacyAllows = async (ownerId: number, viewerId: number, level: string) => {
    if (viewerId === ownerId) return true;
    if (level === "everyone") return true;
    if (level === "friends") return await friendStatus(viewerId, ownerId) === "friends";
    if (level === "followers") {
        const [follow] = await sql`SELECT 1 FROM user_follows WHERE follower_id = ${viewerId} AND followed_id = ${ownerId}`;
        return !!follow;
    }
    return false;
};
