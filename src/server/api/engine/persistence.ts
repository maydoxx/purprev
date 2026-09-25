import { Elysia, t } from "elysia";
import { join } from "path";
import { mkdir } from "fs/promises";
import { UPLOADS } from "../../paths";
import { isInternal } from "./internal";

// datastores for the 2016 game server, one json file per (place, type, scope, store)
// values are json strings the engine makes itself, we just keep them and echo them back
const ROOT = join(UPLOADS, "datastore");

const store = {
    placeId: t.Numeric(),
    type: t.Optional(t.String({ default: "standard" })),
    scope: t.Optional(t.String({ default: "global" }))
};

const safe = (s: string) => s.slice(0, 40).replace(/[^A-Za-z0-9_.-]/g, "_") + "_" + new Bun.CryptoHasher("sha1").update(s).digest("hex").slice(0, 10);

const pathOf = (placeId: number, type: string, scope: string, name: string) =>
    join(ROOT, String(placeId), safe(type), safe(scope), safe(name) + ".json");

// one writer per file, bun has no flock
const locks = new Map<string, Promise<unknown>>();

const withStore = async <T>(path: string, fn: (data: Record<string, string>) => T, write: boolean): Promise<T> => {
    const prev = locks.get(path) ?? Promise.resolve();
    const run = prev.catch(() => {}).then(async () => {
        const file = Bun.file(path);
        let data: Record<string, string> = {};
        if (await file.exists()) {
            data = await file.json().catch(() => ({}));
            if (!data || typeof data !== "object") {
                data = {};
            }
        }
        const result = fn(data);
        if (write) {
            await mkdir(join(path, ".."), {
                recursive: true
            });
            await Bun.write(path, JSON.stringify(data));
        }
        return result;
    });
    locks.set(path, run);
    run.finally(() => {
        if (locks.get(path) === run) {
            locks.delete(path);
        }
    });
    return run;
};

// body is qkeys[0].scope= etc, php mangles those names so parse it by hand
const fields = (body: string) =>
    body.split("&").filter(p => p !== "").map(p => {
        const [k, v = ""] = p.split("=", 2) as [string, string?];
        return [decodeURIComponent(k.replace(/\+/g, " ")), decodeURIComponent(v.replace(/\+/g, " "))] as [string, string];
    });

// old GetGlobalDataStore requests have an empty target, then the key is in "key"
const keyOf = (target: string, key: string): [string, string] => (target === "" ? ["", key] : [key, target]);

const numberOf = (v: string | undefined) => {
    if (v === undefined) {
        return 0;
    }
    try {
        const n = JSON.parse(v);
        return typeof n === "number" ? n : 0;
    } catch {
        return 0;
    }
};

export const persistence = new Elysia({ prefix: "/persistence" })
    .guard({
        beforeHandle({ request, server, status }) {
            if (!isInternal(request, server)) {
                return status(403, {
                    error: "game servers only"
                });
            }
        }
    }, app => app
        .post("/getV2", async ({ body, query }) => {
            const requests: Record<number, Record<string, string>> = {};
            for (const [k, v] of fields(body)) {
                const m = /^qkeys\[(\d+)\]\.(scope|target|key)$/.exec(k);
                if (m) {
                    (requests[Number(m[1])] ??= {})[m[2]!] = v;
                }
            }

            const out = [];
            for (const q of Object.values(requests)) {
                const scope = q.scope || query.scope!;
                const [store, key] = keyOf(q.target ?? "", q.key ?? "");
                if (key === "") {
                    continue;
                }
                const value = await withStore(pathOf(query.placeId, query.type!, scope, store), data => data[key] ?? null, false);
                if (value !== null) {
                    out.push({
                        Value: value,
                        Scope: scope,
                        Key: store === "" ? key : store,
                        Target: store === "" ? "" : key
                    });
                }
            }
            return {
                data: out
            };
        }, {
            parse: "text",
            body: t.String(),
            query: t.Object(store)
        })

        // expected doesnt match = UpdateAsync lost the race, engine refetches and retries
        .post("/set", async ({ body, query, status }) => {
            const [store, key] = keyOf(query.target ?? "", query.key);
            if (key === "") {
                return status(400, {
                    error: "key missing"
                });
            }
            let value: string | null = null;
            let expected: string | null = null;
            for (const [k, v] of fields(body)) {
                if (k === "value") {
                    value = v;
                } else if (k === "expectedValue") {
                    expected = v;
                }
            }
            if (value === null) {
                return status(400, {
                    error: "value missing"
                });
            }

            const result = await withStore(pathOf(query.placeId, query.type!, query.scope!, store), data => {
                if (query.expectedValueLength !== undefined && (data[key] ?? "") !== (expected ?? "")) {
                    return {
                        conflict: true,
                        current: data[key] ?? ""
                    };
                }
                data[key] = value!;
                return {
                    conflict: false,
                    current: value!
                };
            }, true);

            if (result.conflict) {
                return {
                    error: "Expected value mismatch",
                    data: result.current
                };
            }
            return {
                data: value
            };
        }, {
            parse: "text",
            body: t.String(),
            query: t.Object({
                ...store,
                key: t.String(),
                target: t.Optional(t.String()),
                valueLength: t.Optional(t.Numeric()),
                expectedValueLength: t.Optional(t.Numeric())
            })
        })

        .post("/increment", async ({ query, status }) => {
            const [store, key] = keyOf(query.target ?? "", query.key);
            if (key === "") {
                return status(400, {
                    error: "key missing"
                });
            }
            const value = await withStore(pathOf(query.placeId, query.type!, query.scope!, store), data => {
                data[key] = JSON.stringify(numberOf(data[key]) + query.value);
                return data[key];
            }, true);
            return {
                data: value
            };
        }, {
            query: t.Object({
                ...store,
                key: t.String(),
                target: t.Optional(t.String()),
                value: t.Numeric()
            })
        })

        // exclusiveStartKey is target$value of the last entry on the previous page
        .post("/getSortedValues", async ({ query }) => {
            const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 50));
            const ascending = (query.ascending ?? "").toLowerCase() === "true";
            const min = query.inclusiveMinValue;
            const max = query.inclusiveMaxValue;

            let entries = await withStore(pathOf(query.placeId, query.type!, query.scope!, query.key), data =>
                Object.entries(data).flatMap(([target, v]) => {
                    try {
                        const n = JSON.parse(v);
                        return typeof n === "number" ? [{
                            Target: target,
                            Value: n
                        }] : [];
                    } catch {
                        return [];
                    }
                }), false);

            entries = entries.filter(e => (min === undefined || e.Value >= min) && (max === undefined || e.Value <= max));
            entries.sort((a, b) => (a.Value === b.Value ? a.Target.localeCompare(b.Target) : (a.Value < b.Value ? -1 : 1) * (ascending ? 1 : -1)));

            let offset = 0;
            if (query.exclusiveStartKey) {
                const i = entries.findIndex(e => `${e.Target}$${e.Value}` === query.exclusiveStartKey);
                offset = i >= 0 ? i + 1 : 0;
            }
            const page = entries.slice(offset, offset + pageSize);
            const reply: any = {
                Entries: page
            };
            if (offset + pageSize < entries.length && page.length > 0) {
                const last = page[page.length - 1]!;
                reply.ExclusiveStartKey = `${last.Target}$${last.Value}`;
            }
            return {
                data: reply
            };
        }, {
            query: t.Object({
                ...store,
                key: t.String(),
                pageSize: t.Optional(t.Numeric()),
                ascending: t.Optional(t.String()),
                inclusiveMinValue: t.Optional(t.Numeric()),
                inclusiveMaxValue: t.Optional(t.Numeric()),
                exclusiveStartKey: t.Optional(t.String())
            })
        })
    )
