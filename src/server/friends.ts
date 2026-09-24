import { sql, now } from "./db";

// seconds since lastOnlineSite to count as online
export const ONLINE_WINDOW = 5 * 60;

export const isOnline = (lastOnlineSite: number | null) =>
    lastOnlineSite !== null && lastOnlineSite > now() - ONLINE_WINDOW;

export type FriendStatus = "self" | "none" | "friends" | "pending_out" | "pending_in";

export const friendStatus = async (me: number, other: number): Promise<FriendStatus> => {
    if (me === other) {
        return "self";
    }

    const [row] = await sql`
        SELECT requester_id, status FROM friendships
        WHERE (requester_id = ${me} AND target_id = ${other})
        OR (requester_id = ${other} AND target_id = ${me})
    `;

    if (!row) {
        return "none";
    }
    if (row.status === "accepted") {
        return "friends";
    }
    return row.requester_id === me ? "pending_out" : "pending_in";
};

export const friendCount = async (userId: number): Promise<number> => {
    const [row] = await sql`
        SELECT COUNT(*) AS n FROM friendships
        WHERE status = 'accepted' AND (requester_id = ${userId} OR target_id = ${userId})
    `;
    return Number(row.n);
};

// online first
export const friendsOf = async (userId: number, limit: number, offset = 0) => {
    const rows = await sql`
        SELECT users.id, users.username, users.lastOnlineSite
        FROM friendships
        JOIN users ON users.id = IF(friendships.requester_id = ${userId}, friendships.target_id, friendships.requester_id)
        WHERE friendships.status = 'accepted'
        AND (friendships.requester_id = ${userId} OR friendships.target_id = ${userId})
        ORDER BY users.lastOnlineSite DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    return rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        online: isOnline(r.lastOnlineSite)
    }));
};
