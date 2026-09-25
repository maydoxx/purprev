import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql } from "../../db";
import { rcc, RccError } from "../../rcc";

// running game servers, straight from rccmanager
export const servers = new Elysia({ prefix: "/api/admin/servers" })
    .use(session)

    .get("/", async () => {
        const list = await rcc.servers();
        const ids = [...new Set(list.map(s => s.placeId))];
        const games = ids.length > 0 ? await sql`SELECT id, title FROM games WHERE id IN ${sql(ids)}` : [];
        const titles = new Map(games.map((g: any) => [Number(g.id), g.title]));
        return {
            health: await rcc.health(),
            servers: list.map(s => ({
                ...s,
                title: titles.get(s.placeId) ?? ""
            }))
        };
    }, {
        admin: true
    })

    .delete("/:jobId", async ({ params, status }) => {
        try {
            await rcc.close(params.jobId);
        } catch (err) {
            if (err instanceof RccError) {
                return status(err.status === 404 ? 404 : 502, {
                    error: err.message
                });
            }
            throw err;
        }
        return {
            ok: true
        };
    }, {
        admin: true,
        params: t.Object({
            jobId: t.String({ pattern: "^[A-Za-z0-9-]+$" })
        })
    })
