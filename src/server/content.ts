import { sql, now } from "./db";
import { mediaRemove } from "./media";

// what moderated content is shown as everywhere it was uploaded
export const DELETED_TEXT = "[ Content Deleted ]";

export const CONTENT_KINDS = ["place", "audio", "status", "bio"] as const;
export type ContentKind = typeof CONTENT_KINDS[number];

export const isContentKind = (value: unknown): value is ContentKind =>
    typeof value === "string" && (CONTENT_KINDS as readonly string[]).includes(value);

// the media bucket backing each kind, if it has a file to remove
const MEDIA: Partial<Record<ContentKind, string>> = {
    place: "places",
    audio: "assets"
};

export const deletedIds = async (kind: ContentKind, ids: number[]) => {
    if (ids.length === 0) {
        return new Set<number>();
    }
    const rows = await sql`SELECT target_id FROM content_deletions WHERE kind = ${kind} AND restored_at = 0 AND target_id IN ${sql(ids)}`;
    return new Set<number>(rows.map((row: any) => Number(row.target_id)));
};

export const isDeleted = async (kind: ContentKind, targetId: number) => {
    const [row] = await sql`SELECT 1 FROM content_deletions WHERE kind = ${kind} AND target_id = ${targetId} AND restored_at = 0 LIMIT 1`;
    return !!row;
};

// a place or audio file that was pulled, checked without knowing the kind up front
export const isFileDeleted = async (targetId: number) => {
    const [row] = await sql`SELECT 1 FROM content_deletions WHERE restored_at = 0 AND kind IN ('place', 'audio') AND target_id = ${targetId} LIMIT 1`;
    return !!row;
};

export const activeDeletion = async (kind: ContentKind, targetId: number) => {
    const [row] = await sql`
        SELECT * FROM content_deletions
        WHERE kind = ${kind} AND target_id = ${targetId} AND restored_at = 0
        ORDER BY id DESC LIMIT 1
    `;
    return row ?? null;
};

export type DeleteOptions = {
    kind: ContentKind;
    targetId: number;
    userId: number;
    moderatorId: number;
    reason: string;
    original: unknown;
};

export const deleteContent = async ({ kind, targetId, userId, moderatorId, reason, original }: DeleteOptions) => {
    // only one deletion is active per target, an older one is superseded
    await sql`UPDATE content_deletions SET restored_at = ${now()} WHERE kind = ${kind} AND target_id = ${targetId} AND restored_at = 0`;
    await sql`
        INSERT INTO content_deletions (kind, target_id, user_id, reason, original, "deletedBy", created_at)
        VALUES (${kind}, ${targetId}, ${userId}, ${reason}, ${JSON.stringify(original ?? {})}, ${moderatorId}, ${now()})
    `;

    const media = MEDIA[kind];
    if (media) {
        // place and audio files are gone for good
        await mediaRemove(media, targetId);
    }
};

export const restoreContent = async (kind: ContentKind, targetId: number) => {
    const row = await activeDeletion(kind, targetId);
    if (!row) {
        return null;
    }
    await sql`UPDATE content_deletions SET restored_at = ${now()} WHERE id = ${row.id}`;
    return row;
};

// the audit copy of the moderated text kept on a deletion
export const originalOf = (row: any): Record<string, any> => {
    try {
        const parsed = JSON.parse(row?.original ?? "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};
