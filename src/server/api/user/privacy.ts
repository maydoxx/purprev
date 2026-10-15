import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, parseJson } from "../../db";
import { apiLimiter } from "../../ratelimit";
import { recordSecurityAudit } from "../../audit";
import { exportUserData, rectifyUserData, restrictProcessing, withdrawConsent, getRetentionInfo } from "../../privacy-rights";

export const privacy = new Elysia({ prefix: "/privacy" })
    .use(session)
    .use(apiLimiter)

    // data export / portability (gdpr 20, pdpa 30)
    .get("/export", async ({ user, request, server, status }) => {
        try {
            const data = await exportUserData(user.id);

            await recordSecurityAudit({
                userId: user.id,
                username: user.username,
                event: "data_export",
                request,
                server,
                success: true
            });

            return new Response(JSON.stringify(data, null, 2), {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="nonerev-data-export-${user.id}-${new Date().toISOString().split("T")[0]}.json"`
                }
            });
        } catch (err) {
            await recordSecurityAudit({
                userId: user.id,
                username: user.username,
                event: "data_export_failed",
                request,
                server,
                success: false,
                details: err instanceof Error ? err.message : String(err)
            });
            return status(500, { error: "Export failed" });
        }
    }, {
        auth: true
    })

    // correction of inaccurate profile fields (gdpr 16, pdpa 31)
    .patch("/rectify", async ({ body, user, request, server, status }) => {
        try {
            const result = await rectifyUserData(user.id, body);

            await recordSecurityAudit({
                userId: user.id,
                username: user.username,
                event: "data_rectified",
                request,
                server,
                success: true,
                details: `Fields updated: ${Object.keys(body).join(", ")}`
            });

            return { ok: true, updated: result };
        } catch (err) {
            return status(400, { error: err instanceof Error ? err.message : "Rectification failed" });
        }
    }, {
        auth: true,
        body: t.Object({
            about: t.Optional(t.String({ maxLength: 5000 })),
            social_discord: t.Optional(t.String({ maxLength: 40 })),
            social_twitter: t.Optional(t.String({ maxLength: 60 })),
            social_youtube: t.Optional(t.String({ maxLength: 120 })),
            theme: t.Optional(t.Union([
                t.Literal("auto"), t.Literal("classic"), t.Literal("dark"),
                t.Literal("oled"), t.Literal("halloween"), t.Literal("sakura")
            ])),
            social_visibility: t.Optional(t.Object({
                discord: t.Optional(t.Boolean()),
                twitter: t.Optional(t.Boolean()),
                youtube: t.Optional(t.Boolean())
            }))
        })
    })

    // freeze processing while a request is looked at (gdpr 18, pdpa 32)
    .post("/restrict", async ({ body, user, request, server, status }) => {
        try {
            await restrictProcessing(user.id, body.restrict);

            await recordSecurityAudit({
                userId: user.id,
                username: user.username,
                event: body.restrict ? "processing_restricted" : "processing_restriction_lifted",
                request,
                server,
                success: true
            });

            return { ok: true, restricted: body.restrict };
        } catch (err) {
            return status(400, { error: err instanceof Error ? err.message : "Failed to update restriction" });
        }
    }, {
        auth: true,
        body: t.Object({
            restrict: t.Boolean()
        })
    })

    // object to a processing category (gdpr 21, pdpa 33)
    .post("/object", async ({ body, user, request, server, status }) => {
        try {
            await withdrawConsent(user.id, body.processing_type, body.object);

            await recordSecurityAudit({
                userId: user.id,
                username: user.username,
                event: body.object ? "processing_objected" : "processing_objection_withdrawn",
                request,
                server,
                success: true,
                details: `Processing type: ${body.processing_type}`
            });

            return { ok: true, objected: body.object };
        } catch (err) {
            return status(400, { error: err instanceof Error ? err.message : "Failed to update objection" });
        }
    }, {
        auth: true,
        body: t.Object({
            processing_type: t.Union([
                t.Literal("marketing"),
                t.Literal("analytics"),
                t.Literal("profiling"),
                t.Literal("third_party_sharing")
            ]),
            object: t.Boolean()
        })
    })

    // how long each kind of data is kept (pdpa 24)
    .get("/retention", async ({ user }) => {
        return getRetentionInfo();
    }, {
        auth: true
    })

    // current consent flags
    .get("/consents", async ({ user }) => {
        const [row] = await sql`SELECT processing_consents FROM users WHERE id = ${user.id}`;
        return {
            consents: parseJson(row?.processing_consents, {
                marketing: false,
                analytics: true,
                profiling: false,
                third_party_sharing: false
            })
        };
    }, {
        auth: true
    })