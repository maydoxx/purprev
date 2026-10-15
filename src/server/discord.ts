import { createPublicKey, verify } from "node:crypto";
import { SITE_URL } from "./site";

const env = process.env;
const BOT = env.DISCORD_BOT_TOKEN ?? "";
const CHANNEL = env.DISCORD_APPLICATIONS_CHANNEL ?? "";
const WEBHOOK = env.DISCORD_WEBHOOK_URL ?? "";
const PUBLIC_KEY = env.DISCORD_PUBLIC_KEY ?? "";
const ADMIN_ROLE = env.DISCORD_ADMIN_ROLE ?? "";
const API = "https://discord.com/api/v10";

export const discordMode = BOT && CHANNEL ? "bot" : WEBHOOK ? "webhook" : "off";

export type Application = {
    id: number;
    name: string;
    discord: string;
    found: string;
    why: string;
    revivals: string;
    about: string;
    socials: string;
    status: string;
    decided_by: string;
    decided_by_discord: string;
    reason: string;
    user_id: number;
    invite_key: string;
    created_at: number;
};

const COLORS: Record<string, number> = {
    pending: 0x7b2cbf,
    approved: 0x02b757,
    denied: 0xe04848
};

const cut = (s: string, n = 1024) => s.length > n ? s.slice(0, n - 1) + "…" : s;
const md = (s: string) => s.replace(/([\\`*_~|>#\[\]()<-])/g, "\\$1").replace(/@/g, "@\u200b");
const safe = (s: string, n = 1024) => md(cut(s, n - 200)) || "\u200b";

export const applicationEmbed = (app: Application) => ({
    author: {
        name: app.status === "pending" ? "New application" : app.status === "approved" ? "Approved application" : "Denied application"
    },
    title: md(app.name),
    url: `${SITE_URL}/admi/applications`,
    color: COLORS[app.status] ?? COLORS.pending,
    description: [
        `**Discord** ${md(app.discord) || "none"}`,
        `**Socials** ${safe(app.socials || "none given", 500)}`
    ].join("\n"),
    fields: [
        {
            name: "Where did they find us",
            value: safe(app.found || "did not say")
        },
        {
            name: "Why NoneRev",
            value: safe(app.why)
        },
        {
            name: "Other revivals",
            value: safe(app.revivals || "none")
        },
        {
            name: "About them",
            value: safe(app.about)
        },
        ...(app.status !== "pending" ? [{
            name: app.status === "approved" ? "Approved by" : "Denied by",
            value: (app.decided_by_discord ? `<@${app.decided_by_discord}>` : app.decided_by || "someone")
                + (app.user_id ? `, account [${md(app.name)}](${SITE_URL}/user?id=${app.user_id})` : "")
                + (app.reason ? `\n> ${safe(app.reason, 600)}` : "")
        }] : [])
    ],
    footer: {
        text: `#${app.id}`
    },
    timestamp: new Date(app.created_at * 1000).toISOString()
});

const buttons = (id: number) => [{
    type: 1,
    components: [{
        type: 2,
        style: 3,
        label: "Approve",
        custom_id: `apply:approve:${id}`
    }, {
        type: 2,
        style: 4,
        label: "Deny",
        custom_id: `apply:deny:${id}`
    }]
}];

export const denyModal = (id: number) => ({
    type: 9,
    data: {
        custom_id: `apply:deny:${id}`,
        title: "Deny application",
        components: [{
            type: 1,
            components: [{
                type: 4,
                custom_id: "reason",
                style: 2,
                label: "Reason, they get to see this",
                placeholder: "leave empty for no reason",
                required: false,
                max_length: 500
            }]
        }]
    }
});

export const modalReason = (interaction: any) => {
    for (const row of interaction.data?.components ?? []) {
        for (const c of row.components ?? []) {
            if (c.custom_id === "reason") {
                return String(c.value ?? "").trim().slice(0, 500);
            }
        }
    }
    return "";
};

const call = async (path: string, method: string, body: unknown) => {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bot ${BOT}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
        throw new Error(`discord ${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    return res.json() as Promise<any>;
};

export const announceApplication = async (app: Application) => {
    try {
        if (discordMode === "bot") {
            const msg = await call(`/channels/${CHANNEL}/messages`, "POST", {
                embeds: [applicationEmbed(app)],
                components: buttons(app.id)
            });
            return String(msg.id);
        }
        if (discordMode === "webhook") {
            await fetch(WEBHOOK, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    embeds: [applicationEmbed(app)]
                }),
                signal: AbortSignal.timeout(10000)
            });
        }
    } catch (err) {
        console.warn("discord:", err instanceof Error ? err.message : err);
    }
    return "";
};

export const updateApplication = async (app: Application, messageId: string) => {
    if (discordMode !== "bot" || !messageId) {
        return;
    }
    try {
        await call(`/channels/${CHANNEL}/messages/${messageId}`, "PATCH", {
            embeds: [applicationEmbed(app)],
            components: []
        });
    } catch (err) {
        console.warn("discord:", err instanceof Error ? err.message : err);
    }
};

export const editInteractionMessage = async (interaction: any, app: Application) => {
    try {
        await fetch(`${API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                embeds: [applicationEmbed(app)],
                components: []
            }),
            signal: AbortSignal.timeout(10000)
        });
    } catch (err) {
        console.warn("discord:", err instanceof Error ? err.message : err);
    }
};

export const followUp = async (interaction: any, content: string) => {
    try {
        await fetch(`${API}/webhooks/${interaction.application_id}/${interaction.token}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content,
                flags: 64
            }),
            signal: AbortSignal.timeout(10000)
        });
    } catch (err) {
        console.warn("discord:", err instanceof Error ? err.message : err);
    }
};

export const verifyInteraction = (request: Request, body: string) => {
    if (!PUBLIC_KEY) {
        return false;
    }
    const sig = request.headers.get("x-signature-ed25519") ?? "";
    const ts = request.headers.get("x-signature-timestamp") ?? "";
    if (!/^[0-9a-f]{128}$/.test(sig) || !ts) {
        return false;
    }
    try {
        const key = createPublicKey({
            key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(PUBLIC_KEY, "hex")]),
            format: "der",
            type: "spki"
        });
        return verify(null, Buffer.from(ts + body), key, Buffer.from(sig, "hex"));
    } catch {
        return false;
    }
};

export const allowedToDecide = (interaction: any) => {
    if (!ADMIN_ROLE) {
        return true;
    }
    const roles: string[] = interaction.member?.roles ?? [];
    return roles.includes(ADMIN_ROLE);
};

export const interactionUserId = (interaction: any) => String(interaction.member?.user?.id ?? interaction.user?.id ?? "");

export const interactionUser = (interaction: any) => {
    const u = interaction.member?.user ?? interaction.user ?? {};
    return String(u.global_name || u.username || "someone").slice(0, 60);
};
