import { Elysia, t } from "elysia";
import { giveStarterItems } from "../../starter";
import { session } from "../../session";
import { sql, now } from "../../db";
import { clientIp } from "../../invites";
import { siteSetting } from "../../settings";
import { verifyTurnstile } from "../../turnstile";
import { announceApplication, updateApplication, verifyInteraction, allowedToDecide, interactionUser, interactionUserId, editInteractionMessage, followUp, denyModal, modalReason, type Application } from "../../discord";
import { rcc } from "../../rcc";

const PER_PAGE = 20;
const USERNAME = /^[a-zA-Z0-9]{3,20}$/;

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const token = () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");

const load = async (id: number): Promise<(Application & { discord_message_id: string, token: string, ip: string, password: string }) | null> => {
    const [row] = await sql`SELECT * FROM applications WHERE id = ${id}`;
    return row ? {
        ...row,
        id: Number(row.id),
        created_at: Number(row.created_at)
    } : null;
};

export const decideApplication = async (id: number, approve: boolean, by: string, byUserId: number, byDiscordId = "", reason = "") => {
    const app = await load(id);
    if (!app) {
        return {
            app: null,
            error: "That application is gone."
        };
    }
    if (app.status !== "pending") {
        return {
            app,
            error: ""
        };
    }
    let userId = 0;
    if (approve) {
        const [taken] = await sql`SELECT id FROM users WHERE username = ${app.name}`;
        if (taken) {
            return {
                app,
                error: `Someone took the name ${app.name} in the meantime, deny it and let them apply again.`
            };
        }
        const created = await sql`INSERT INTO users (username, password, created_at) VALUES (${app.name}, ${app.password}, ${now()})`;
        userId = Number(created.lastInsertRowid);
        await giveStarterItems(userId);
        await sql`
            INSERT INTO invite_log (inviteKey, created_by, created_at, used_by, used_at, ip, user_agent)
            VALUES (${app.token}, ${byUserId}, ${app.created_at}, ${userId}, ${now()}, ${app.ip}, ${"application"})
        `;
        rcc.render.avatar(userId);
    }
    await sql`
        UPDATE applications SET status = ${approve ? "approved" : "denied"}, decided_by = ${by}, decided_by_discord = ${byDiscordId}, decided_at = ${now()}, user_id = ${userId}, reason = ${approve ? "" : reason.slice(0, 500)}
        WHERE id = ${id} AND status = 'pending'
    `;
    return {
        app: await load(id),
        error: ""
    };
};

const publicView = (app: Application & { token?: string }) => ({
    id: app.id,
    name: app.name,
    status: app.status,
    reason: app.status === "denied" ? app.reason : "",
    created_at: app.created_at
});

export const applications = new Elysia()
    .use(session)


    .post("/api/applications", async ({ body, request, server, status }) => {
        if (!(await siteSetting("applications_enabled"))) {
            return status(403, {
                error: "Applications are closed right now"
            });
        }
        const name = clean(body.name, 20);
        const discord = clean(body.discord, 40);
        const found = clean(body.found, 200);
        const why = body.why.trim().slice(0, 1000);
        const revivals = clean(body.revivals ?? "", 500);
        const about = body.about.trim().slice(0, 1000);
        const socials = clean(body.socials, 500);
        const email = clean(body.email ?? "", 120);
        if (body.password.length < 8) {
            return status(400, {
                error: "Password must be at least 8 characters"
            });
        }
        if (body.password !== body.confirmpassword) {
            return status(400, {
                error: "Passwords do not match"
            });
        }
        if (!USERNAME.test(name)) {
            return status(400, {
                error: "Pick a username with 3 to 20 letters or numbers"
            });
        }
        if (discord.length < 2) {
            return status(400, {
                error: "We need your Discord name to reach you"
            });
        }
        if (found.length < 2) {
            return status(400, {
                error: "Tell us where you found us"
            });
        }
        if (why.length < 20) {
            return status(400, {
                error: "Tell us a bit more about why you want to play NoneRev"
            });
        }
        if (about.length < 20) {
            return status(400, {
                error: "Tell us a bit more about yourself"
            });
        }
        if (socials.length < 3) {
            return status(400, {
                error: "Drop a couple of your socials so we know you are real"
            });
        }
        const [taken] = await sql`SELECT id FROM users WHERE username = ${name}`;
        if (taken) {
            return status(400, {
                error: "That username is already taken"
            });
        }
        const ip = clientIp(request, server);
        if (!(await verifyTurnstile(body.turnstile, ip))) {
            return status(400, {
                error: "Please complete the captcha"
            });
        }
        const [open] = await sql`SELECT id FROM applications WHERE status = 'pending' AND (ip = ${ip} OR discord = ${discord})`;
        if (open) {
            return status(429, {
                error: "You already have an application waiting"
            });
        }

        const tok = token();
        const hash = await Bun.password.hash(body.password, "bcrypt");
        const created = await sql`
            INSERT INTO applications (name, discord, email, found, why, revivals, about, socials, password, ip, token, status, created_at)
            VALUES (${name}, ${discord}, ${email}, ${found}, ${why}, ${revivals}, ${about}, ${socials}, ${hash}, ${ip}, ${tok}, 'pending', ${now()})
        `;
        const id = Number(created.lastInsertRowid);
        const app = (await load(id))!;
        const messageId = await announceApplication(app);
        if (messageId) {
            await sql`UPDATE applications SET discord_message_id = ${messageId} WHERE id = ${id}`;
        }
        console.log(`applications: #${id} ${name} (${discord}) from ${ip}`);
        return {
            ok: true,
            token: tok
        };
    }, {
        body: t.Object({
            name: t.String({ maxLength: 40 }),
            discord: t.String({ maxLength: 80 }),
            found: t.String({ maxLength: 400 }),
            why: t.String({ maxLength: 2000 }),
            revivals: t.Optional(t.String({ maxLength: 1000 })),
            about: t.String({ maxLength: 2000 }),
            socials: t.String({ maxLength: 1000 }),
            email: t.Optional(t.String({ maxLength: 200 })),
            password: t.String({ maxLength: 200 }),
            confirmpassword: t.String({ maxLength: 200 }),
            turnstile: t.Optional(t.String({ maxLength: 4000 }))
        })
    })

    .get("/api/applications/status", async ({ query, status }) => {
        const [row] = await sql`SELECT * FROM applications WHERE token = ${query.token}`;
        if (!row) {
            return status(404, {
                error: "No application with that link"
            });
        }
        return publicView({
            ...row,
            id: Number(row.id),
            created_at: Number(row.created_at)
        });
    }, {
        query: t.Object({
            token: t.String({ pattern: "^[0-9a-f]{32}$" })
        })
    })


    .get("/api/admin/applications", async ({ query }) => {
        const which = query.status ?? "pending";
        const where = which === "all" ? sql`1 = 1` : sql`status = ${which}`;
        const [count] = await sql`SELECT COUNT(*) AS n FROM applications WHERE ${where}`;
        const totalPages = Math.max(1, Math.ceil(Number(count.n) / PER_PAGE));
        const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
        const items = await sql`SELECT * FROM applications WHERE ${where} ORDER BY id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`;
        return {
            items,
            total: Number(count.n),
            page,
            totalPages
        };
    }, {
        admin: true,
        query: t.Object({
            status: t.Optional(t.String()),
            page: t.Optional(t.Numeric())
        })
    })

    .post("/api/admin/applications/:id/:verdict", async ({ params, body, user, status }) => {
        const { app, error } = await decideApplication(params.id, params.verdict === "approve", user.username, user.id, "", body?.reason ?? "");
        if (!app) {
            return status(404, {
                error
            });
        }
        if (error) {
            return status(409, {
                error
            });
        }
        await updateApplication(app, app.discord_message_id);
        return app;
    }, {
        admin: true,
        params: t.Object({
            id: t.Numeric(),
            verdict: t.Union([
                t.Literal("approve"),
                t.Literal("deny")
            ])
        }),
        body: t.Optional(t.Object({
            reason: t.Optional(t.String({ maxLength: 500 }))
        }))
    })


    .post("/api/discord/interactions", async ({ request, status }) => {
        const raw = await request.text();
        if (!verifyInteraction(request, raw)) {
            return status(401, "bad signature");
        }
        const interaction = JSON.parse(raw);
        if (interaction.type === 1) {
            return {
                type: 1
            };
        }
        const [kind, verdict, idText] = String(interaction.data?.custom_id ?? "").split(":");
        const who = interactionUser(interaction);
        console.log(`discord: interaction ${interaction.type} ${interaction.data?.custom_id ?? ""} from ${who}`);
        if ((interaction.type !== 3 && interaction.type !== 5) || kind !== "apply") {
            return {
                type: 6
            };
        }
        if (!allowedToDecide(interaction)) {
            return {
                type: 4,
                data: {
                    content: "You are not allowed to decide applications.",
                    flags: 64
                }
            };
        }
        if (interaction.type === 3 && verdict === "deny") {
            return denyModal(Number(idText));
        }
        (async () => {
            const { app, error } = await decideApplication(Number(idText), verdict === "approve", who, 0, interactionUserId(interaction), interaction.type === 5 ? modalReason(interaction) : "");
            if (!app || error) {
                await followUp(interaction, error);
                return;
            }
            await editInteractionMessage(interaction, app);
            console.log(`applications: #${app.id} ${app.status} by ${who} from discord`);
        })().catch(err => console.error("discord:", err));
        return {
            type: 6
        };
    }, {
        parse: "none"
    })
