import { Elysia, t } from "elysia";
import { join } from "path";

// the flag dumps from the php site, served as is
const STATIC = join(import.meta.dir, "..", "..", "static", "settings");

export const settings = new Elysia({ prefix: "/Setting/QuietGet" })
    // keep EnableLoginLogoutSignupWithApi and EnableXBOXSignupRules false or the app looks for an api. subdomain
    .get("/:name", ({ params }) =>
        new Response(Bun.file(join(STATIC, `${params.name}.json`)), {
            headers: {
                "Content-Type": "application/json"
            }
        }), {
        params: t.Object({
            name: t.Union([
                t.Literal("ClientAppSettings"),
                t.Literal("ClientSharedSettings"),
                t.Literal("AndroidAppSettings"),
                t.Literal("RCCService"),
                t.Literal("co")
            ])
        })
    })
