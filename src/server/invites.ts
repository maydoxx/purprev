import { sql, now } from "./db";
import { anonymizeIp } from "./utils/privacy";

export type Invite = {
    id: number;
    createdBy: number;
    createdAt: number;
    inviteKey: string;
};

// full address, only for things that must see it (the signup captcha). it is
// never stored; use clientIp for anything that goes into the database.
export const rawClientIp = (request: Request, server: any) => {
    const forwarded = request.headers.get("x-forwarded-for");
    const address = forwarded
        ? forwarded.split(",")[0]!.trim()
        : String(server?.requestIP?.(request)?.address ?? "");
    return address.slice(0, 45);
};

export const clientIp = (request: Request, server: any) =>
    anonymizeIp(rawClientIp(request, server)).slice(0, 45);

export const claimInvite = async (key: string): Promise<Invite | null> => {
    const [row] = await sql`SELECT id, "createdBy", "createdAt", "inviteKey" FROM invites WHERE "inviteKey" = ${key}`;
    if (!row) {
        return null;
    }
    const deleted = await sql`DELETE FROM invites WHERE id = ${row.id}`;
    return deleted.count ? {
        id: Number(row.id),
        createdBy: Number(row.createdBy),
        createdAt: Number(row.createdAt),
        inviteKey: row.inviteKey
    } : null;
};

export const logInvite = (invite: Invite, userId: number, request: Request, server: any) =>
    sql`
        INSERT INTO invite_log ("inviteKey", created_by, created_at, used_by, used_at, ip, user_agent)
        VALUES (${invite.inviteKey}, ${invite.createdBy}, ${invite.createdAt}, ${userId}, ${now()}, ${clientIp(request, server)}, ${(request.headers.get("user-agent") ?? "").slice(0, 255)})
    `;
