import { sql, now } from "./db";

// who made the key, who used it, from where. the invites row goes away on use, this stays
export type Invite = {
    id: number;
    createdBy: number;
    createdAt: number;
    inviteKey: string;
};

// cloudflare and caddy put the real client first, direct lan callers have no header at all
export const clientIp = (request: Request, server: any) => {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]!.trim().slice(0, 45);
    }
    return String(server?.requestIP?.(request)?.address ?? "").slice(0, 45);
};

// takes the key off the table, null when it was never there or someone else got it first
export const claimInvite = async (key: string): Promise<Invite | null> => {
    const [row] = await sql`SELECT id, createdBy, createdAt, inviteKey FROM invites WHERE inviteKey = ${key}`;
    if (!row) {
        return null;
    }
    const deleted = await sql`DELETE FROM invites WHERE id = ${row.id}`;
    return deleted.affectedRows ? {
        id: Number(row.id),
        createdBy: Number(row.createdBy),
        createdAt: Number(row.createdAt),
        inviteKey: row.inviteKey
    } : null;
};

export const logInvite = (invite: Invite, userId: number, request: Request, server: any) =>
    sql`
        INSERT INTO invite_log (inviteKey, created_by, created_at, used_by, used_at, ip, user_agent)
        VALUES (${invite.inviteKey}, ${invite.createdBy}, ${invite.createdAt}, ${userId}, ${now()}, ${clientIp(request, server)}, ${(request.headers.get("user-agent") ?? "").slice(0, 255)})
    `;
