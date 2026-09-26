import { SITE_INTERNAL_URL } from "./site";


const env = process.env;
const BASE = `http://${env.RCCMANAGER_HOST ?? "localhost"}:${env.RCCMANAGER_PORT ?? 25500}`;
const TIMEOUT = 5000;

export class RccError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export type GameServer = {
    jobId: string;
    placeId: number;
    port: number;
    address: string;
    ready: boolean;
    players: number;
    startedAt: string;
};

const call = async <T>(method: string, path: string, body?: unknown, timeout = TIMEOUT): Promise<T> => {
    let res: Response;
    try {
        res = await fetch(BASE + path, {
            method,
            headers: {
                Authorization: `Bearer ${env.RCCMANAGER_PASSWORD ?? ""}`,
                "Content-Type": "application/json"
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(timeout)
        });
    } catch (err) {
        throw new RccError(0, `rccmanager unreachable: ${err instanceof Error ? err.message : err}`);
    }

    if (res.status === 204) {
        return undefined as T;
    }
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new RccError(res.status, data.error ?? res.statusText);
    }
    return data;
};

const quiet = async <T>(fallback: T, fn: () => Promise<T>) => {
    try {
        return await fn();
    } catch (err) {
        console.warn("rccmanager:", err instanceof Error ? err.message : err);
        return fallback;
    }
};

export const rcc = {

    findOrCreate: (placeId: number) => call<GameServer>("POST", `/servers/${placeId}`, undefined, 40000),

    server: (jobId: string) => quiet<GameServer | null>(null, () => call("GET", `/servers/${jobId}`)),

    servers: () => quiet<GameServer[]>([], () => call("GET", "/servers")),

    close: (jobId: string) => call<void>("DELETE", `/servers/${jobId}`),

    players: async (placeIds: number[]) => {
        const counts: Record<number, number> = {};
        for (const id of placeIds) {
            counts[id] = 0;
        }
        if (placeIds.length === 0) {
            return counts;
        }
        const got = await quiet<Record<string, number>>({}, () => call("GET", `/players?placeIds=${placeIds.join(",")}`));
        for (const [id, n] of Object.entries(got)) {
            counts[Number(id)] = n;
        }
        return counts;
    },

    health: () => quiet<any>(null, () => call("GET", "/health")),


    render: {
        avatar: (userId: number) => quiet(false, async () => {
            await call("POST", `/render/avatar/${userId}`, {
                appearanceUrl: `${SITE_INTERNAL_URL}/Asset/CharacterFetch.ashx?userId=${userId}`
            });
            return true;
        }),

        place: (placeId: number) => quiet(false, async () => {
            await call("POST", `/render/place/${placeId}`, {
                placeUrl: `${SITE_INTERNAL_URL}/asset/?id=${placeId}`
            });
            return true;
        }),

        item: (itemId: number, assetId: number) => quiet(false, async () => {
            await call("POST", `/render/item/${itemId}`, {
                appearanceUrl: `${SITE_INTERNAL_URL}/Asset/CharacterFetch.ashx?assetId=${assetId}`
            });
            return true;
        }),

        status: (kind: "avatar" | "place" | "item", id: number) => quiet<any>(null, () => call("GET", `/render/${kind}/${id}`))
    }
};
