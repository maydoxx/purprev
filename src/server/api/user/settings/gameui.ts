import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";
import { skins } from "../../engine/corescripts";

export const gameui = new Elysia()
    .use(session)
    .post("/gameui", async ({ body, user, status }) => {
        if (body.ui !== "2016" && !skins().some(s => s.id === body.ui)) {
            return status(400, {
                error: "No such game UI"
            });
        }
        await sql`UPDATE users SET game_ui = ${body.ui} WHERE id = ${user.id}`;
        return {
            ok: true,
            ui: body.ui
        };
    }, {
        auth: true,
        body: t.Object({
            ui: t.String({ pattern: "^\\d{4}$" })
        })
    })
