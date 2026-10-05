import { sql } from "./db";
import { rcc } from "./rcc";
import { friendStatus } from "./friends";

export type PrivateServer = {
    kind: "vip" | "reserved";
    id: number;
    gameId: number;
    ownerId: number;
    accessCode: string;
    key: string;
    active: boolean;
    allowFriends: boolean;
};

const vip = (row: any): PrivateServer => ({
    kind: "vip",
    id: Number(row.id),
    gameId: Number(row.game_id),
    ownerId: Number(row.owner_id),
    accessCode: row.access_code,
    key: `vip-${row.id}`,
    active: Number(row.active) === 1,
    allowFriends: Number(row.allow_friends) === 1
});

const reserved = (row: any): PrivateServer => ({
    kind: "reserved",
    id: Number(row.id),
    gameId: Number(row.game_id),
    ownerId: 0,
    accessCode: row.access_code,
    key: `rsv-${row.id}`,
    active: true,
    allowFriends: false
});

export const byVipId = async (id: number) => {
    const [row] = await sql`SELECT * FROM vip_servers WHERE id = ${id}`;
    return row ? vip(row) : null;
};

export const byAccessCode = async (code: string) => {
    const [v] = await sql`SELECT * FROM vip_servers WHERE access_code = ${code}`;
    if (v) {
        return vip(v);
    }
    const [r] = await sql`SELECT * FROM reserved_servers WHERE access_code = ${code}`;
    return r ? reserved(r) : null;
};

export const byKey = async (key: string) => {
    const m = /^(vip|rsv)-(\d+)$/.exec(key);
    if (!m) {
        return null;
    }
    if (m[1] === "vip") {
        return byVipId(Number(m[2]));
    }
    const [row] = await sql`SELECT * FROM reserved_servers WHERE id = ${Number(m[2])}`;
    return row ? reserved(row) : null;
};

export const canJoin = async (ps: PrivateServer, user: { id: number; admin: number }) => {
    if (!ps.active) {
        return false;
    }
    if (user.admin > 0) {
        return true;
    }
    if (ps.kind === "reserved") {
        const [row] = await sql`SELECT 1 FROM reserved_server_access WHERE reserved_id = ${ps.id} AND user_id = ${user.id}`;
        return !!row;
    }
    if (ps.ownerId === user.id) {
        return true;
    }
    const [member] = await sql`SELECT 1 FROM vip_server_members WHERE vip_id = ${ps.id} AND user_id = ${user.id}`;
    if (member) {
        return true;
    }
    return ps.allowFriends && await friendStatus(user.id, ps.ownerId) === "friends";
};

export const start = (ps: PrivateServer) => rcc.findOrCreate(ps.gameId, {
    key: ps.key,
    ownerId: ps.kind === "vip" ? ps.ownerId : 0
});

export const jobOf = async (ps: PrivateServer) => (await rcc.servers()).find(s => s.key === ps.key) ?? null;
