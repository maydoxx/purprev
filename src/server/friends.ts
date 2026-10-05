import { sql, now } from "./db";
import { rcc } from "./rcc";


export const ONLINE_WINDOW = 5 * 60;

export const isOnline = (lastOnlineSite: number | null) =>
    lastOnlineSite !== null && lastOnlineSite > now() - ONLINE_WINDOW;

export type Presence = {
    type: "offline" | "website" | "game" | "studio";
    place_id: number | null;
    place_name: string | null;
    job_id: string | null;
};

type Seen = {
    id: number;
    lastOnlineSite: number | null;
};

let jobs = {
    at: 0,
    live: new Set<string>()
};

// the chat bar polls friendsOf every 10s per user
const liveJobs = async () => {
    if (Date.now() - jobs.at > 5000) {
        jobs = {
            at: Date.now(),
            live: new Set((await rcc.servers()).filter(s => s.players > 0).map(s => s.jobId))
        };
    }
    return jobs.live;
};


// visits never end, so a visit only counts while its server is up with players in it
export const presenceOf = async (users: Seen[], viewer = 0) => {
    const ids = users.map(u => Number(u.id));
    const visits = ids.length === 0 ? [] : await sql`
        SELECT DISTINCT ON (v.user_id) v.user_id, v.game_id, v.job_id, games.title, games.access, games.creator_id
        FROM game_visit_sessions v
        LEFT JOIN games ON games.id = v.game_id
        WHERE v.user_id IN ${sql(ids)}
        ORDER BY v.user_id, v.started_at DESC
    `;
    const live = visits.length === 0 ? new Set<string>() : await liveJobs();
    const playing = new Map<number, any>(visits.filter((v: any) => live.has(v.job_id)).map((v: any) => [Number(v.user_id), v]));

    // studio pings every minute while a place is open
    const studio = ids.length === 0 ? [] : await sql`
        SELECT users.id, users.studio_place_id AS game_id, games.title, games.access, games.creator_id FROM users
        LEFT JOIN games ON games.id = users.studio_place_id
        WHERE users.id IN ${sql(ids)} AND users.last_studio > ${now() - ONLINE_WINDOW}
    `;
    const editing = new Map<number, any>(studio.map((r: any) => [Number(r.id), r]));

    // friends-only places are only named to the owner's friends, private ones only to the owner
    const owners = [...new Set([...playing.values(), ...editing.values()].filter((v: any) => v.access === "friends" && Number(v.creator_id) !== viewer).map((v: any) => Number(v.creator_id)))];
    const befriended = viewer === 0 || owners.length === 0 ? [] : await sql`
        SELECT CASE WHEN requester_id = ${viewer} THEN target_id ELSE requester_id END AS id FROM friendships
        WHERE status = 'accepted'
        AND ((requester_id = ${viewer} AND target_id IN ${sql(owners)}) OR (target_id = ${viewer} AND requester_id IN ${sql(owners)}))
    `;
    const friendsWith = new Set(befriended.map((r: any) => Number(r.id)));
    const visible = (v: any) => v.access === "everyone"
        || (viewer !== 0 && Number(v.creator_id) === viewer)
        || (v.access === "friends" && friendsWith.has(Number(v.creator_id)));

    return (user: Seen): Presence => {
        const visit = playing.get(Number(user.id));
        if (visit && !visible(visit)) {
            return {
                type: "game",
                place_id: null,
                place_name: null,
                job_id: null
            };
        }
        if (visit) {
            return {
                type: "game",
                place_id: Number(visit.game_id),
                place_name: visit.title ?? "",
                job_id: visit.job_id
            };
        }
        const edit = editing.get(Number(user.id));
        if (edit) {
            const shown = visible(edit);
            return {
                type: "studio",
                place_id: shown ? Number(edit.game_id) : null,
                place_name: shown ? edit.title ?? "" : null,
                job_id: null
            };
        }
        return {
            type: isOnline(user.lastOnlineSite) ? "website" : "offline",
            place_id: null,
            place_name: null,
            job_id: null
        };
    };
};

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
        SELECT COUNT(*)::int AS n FROM friendships
        WHERE status = 'accepted' AND (requester_id = ${userId} OR target_id = ${userId})
    `;
    return Number(row.n);
};


export const friendsOf = async (userId: number, limit: number, offset = 0, viewer = userId) => {
    const rows = await sql`
        SELECT users.id, users.username, users."lastOnlineSite"
        FROM friendships
        JOIN users ON users.id = CASE WHEN friendships.requester_id = ${userId} THEN friendships.target_id ELSE friendships.requester_id END
        WHERE friendships.status = 'accepted'
        AND (friendships.requester_id = ${userId} OR friendships.target_id = ${userId})
        ORDER BY users."lastOnlineSite" DESC
        LIMIT ${limit} OFFSET ${offset}
    `;
    const presence = await presenceOf(rows, viewer);

    return rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        online: isOnline(r.lastOnlineSite),
        presence: presence(r)
    }));
};
