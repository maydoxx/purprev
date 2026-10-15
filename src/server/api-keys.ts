import { sql, now } from "./db";

export type ApiKeyScope = "game-client" | "studio" | "tooling" | "rcc";

export interface ApiKey {
    id: number;
    name: string;
    key: string;
    scopes: ApiKeyScope[];
    created_by: number;
    created_at: number;
    last_used_at: number | null;
    expires_at: number | null;
    revoked: boolean;
}

interface ApiKeyRow {
    id: number;
    name: string;
    key_hash: string;
    scopes: string;
    created_by: number;
    created_at: number;
    last_used_at: number | null;
    expires_at: number | null;
    revoked: number;
}

const KEY_PREFIX = "nrk_"; // NoneRev key

export const generateApiKey = async (
    name: string,
    scopes: ApiKeyScope[],
    createdBy: number,
    expiresInDays?: number
): Promise<{ id: number; key: string }> => {
    const key = KEY_PREFIX + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    const keyHash = await Bun.password.hash(key, "bcrypt");
    const expiresAt = expiresInDays ? now() + expiresInDays * 86400 : 0;

    const [row] = await sql`
        INSERT INTO api_keys (name, key_hash, scopes, created_by, created_at, expires_at)
        VALUES (${name}, ${keyHash}, ${JSON.stringify(scopes)}, ${createdBy}, ${now()}, ${expiresAt})
        RETURNING id
    `;
    return { id: Number(row.id), key };
};

export const verifyApiKey = async (key: string): Promise<ApiKey | null> => {
    if (!key.startsWith(KEY_PREFIX)) {
        return null;
    }

    // keys are salted hashes, so the stored hash cannot be looked up directly.
    // pull the active keys and compare until one matches.
    const rows = await sql`
        SELECT id, name, key_hash, scopes, created_by, created_at, last_used_at, expires_at, revoked
        FROM api_keys
        WHERE revoked = 0 AND (expires_at = 0 OR expires_at > ${now()})
    `;

    let match: ApiKeyRow | null = null;
    for (const candidate of rows as ApiKeyRow[]) {
        if (await Bun.password.verify(key, candidate.key_hash)) {
            match = candidate;
            break;
        }
    }
    if (!match) {
        return null;
    }

    await sql`UPDATE api_keys SET last_used_at = ${now()} WHERE id = ${match.id}`;

    return {
        id: match.id,
        name: match.name,
        key: "",
        scopes: JSON.parse(match.scopes),
        created_by: match.created_by,
        created_at: match.created_at,
        last_used_at: match.last_used_at,
        expires_at: match.expires_at,
        revoked: Boolean(match.revoked)
    };
};

export const hasScope = (apiKey: ApiKey | null, scope: ApiKeyScope): boolean =>
    apiKey !== null && apiKey.scopes.includes(scope);

export const revokeApiKey = async (id: number, revokedBy: number): Promise<boolean> => {
    const result = await sql`UPDATE api_keys SET revoked = 1 WHERE id = ${id}`;
    return result.count > 0;
};

export const listApiKeys = async (userId: number): Promise<Omit<ApiKey, "key">[]> => {
    const rows = await sql`
        SELECT id, name, scopes, created_by, created_at, last_used_at, expires_at, revoked
        FROM api_keys
        WHERE created_by = ${userId}
        ORDER BY created_at DESC
    `;
    return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        scopes: JSON.parse(row.scopes),
        created_by: row.created_by,
        created_at: row.created_at,
        last_used_at: row.last_used_at,
        expires_at: row.expires_at,
        revoked: Boolean(row.revoked)
    }));
};
