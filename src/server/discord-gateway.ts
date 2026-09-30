import { decideApplication } from "./api/applications";
import { applicationEmbed, allowedToDecide, interactionUser, interactionUserId, denyModal, modalReason } from "./discord";

// no interactions url in the portal or discord posts there instead

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const API = "https://discord.com/api/v10";
const GATEWAY = "wss://gateway.discord.gg";

let ws: WebSocket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let seq: number | null = null;
let sessionId = "";
let resumeUrl = "";
let acked = true;
let backoff = 1000;

const send = (op: number, d: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            op,
            d
        }));
    }
};

const respond = (interaction: any, payload: unknown) =>
    fetch(`${API}/interactions/${interaction.id}/${interaction.token}/callback`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
    });

const whisper = (interaction: any, content: string) => respond(interaction, {
    type: 4,
    data: {
        content,
        flags: 64
    }
});

const handle = async (interaction: any) => {
    if (interaction.type !== 3 && interaction.type !== 5) {
        return;
    }
    const [kind, verdict, id] = String(interaction.data?.custom_id ?? "").split(":");
    if (kind !== "apply") {
        return;
    }
    const who = interactionUser(interaction);
    if (!allowedToDecide(interaction)) {
        await whisper(interaction, "You are not allowed to decide applications.");
        return;
    }
    if (interaction.type === 3 && verdict === "deny") {
        await respond(interaction, denyModal(Number(id)));
        return;
    }
    const reason = interaction.type === 5 ? modalReason(interaction) : "";
    const { app, error } = await decideApplication(Number(id), verdict === "approve", who, 0, interactionUserId(interaction), reason);
    if (!app || error) {
        await whisper(interaction, error);
        return;
    }
    await respond(interaction, {
        type: 7,
        data: {
            embeds: [applicationEmbed(app)],
            components: []
        }
    });
    console.log(`applications: #${app.id} ${app.status} by ${who} from discord`);
};

const connect = (resume: boolean) => {
    const base = resume && resumeUrl ? resumeUrl : GATEWAY;
    ws = new WebSocket(`${base}/?v=10&encoding=json`);

    ws.onmessage = e => {
        const msg = JSON.parse(String(e.data));
        if (msg.s) {
            seq = msg.s;
        }
        switch (msg.op) {
            case 10:
                if (heartbeat) {
                    clearInterval(heartbeat);
                }
                acked = true;
                heartbeat = setInterval(() => {
                    if (!acked) {
                        ws?.close(4000, "no heartbeat ack");
                        return;
                    }
                    acked = false;
                    send(1, seq);
                }, msg.d.heartbeat_interval);
                if (resume && sessionId) {
                    send(6, {
                        token: TOKEN,
                        session_id: sessionId,
                        seq
                    });
                } else {
                    send(2, {
                        token: TOKEN,
                        intents: 0,
                        properties: {
                            os: process.platform,
                            browser: "nonerev",
                            device: "nonerev"
                        },
                        presence: {
                            status: "online",
                            since: 0,
                            afk: false,
                            activities: [{
                                name: "your applications",
                                type: 3
                            }]
                        }
                    });
                }
                break;
            case 11:
                acked = true;
                break;
            case 1:
                send(1, seq);
                break;
            case 7:
                ws?.close(4001, "reconnect");
                break;
            case 9:
                if (!msg.d) {
                    sessionId = "";
                }
                setTimeout(() => ws?.close(4002, "invalid session"), 1500);
                break;
            case 0:
                if (msg.t === "READY") {
                    sessionId = msg.d.session_id;
                    resumeUrl = msg.d.resume_gateway_url;
                    backoff = 1000;
                    console.log(`discord: gateway ready as ${msg.d.user?.username ?? "bot"}`);
                } else if (msg.t === "RESUMED") {
                    backoff = 1000;
                } else if (msg.t === "INTERACTION_CREATE") {
                    handle(msg.d).catch(err => console.error("discord:", err));
                }
                break;
        }
    };

    ws.onclose = e => {
        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }
        if (e.code === 4004) {
            console.error("discord: the bot token is wrong, gateway off");
            return;
        }
        if (e.code === 4010 || e.code === 4011 || e.code === 4013 || e.code === 4014) {
            console.error(`discord: gateway refused us (${e.code} ${e.reason}), gateway off`);
            return;
        }
        const wait = backoff;
        backoff = Math.min(backoff * 2, 60000);
        setTimeout(() => connect(!!sessionId), wait);
    };

    ws.onerror = () => {};
};

export const startDiscordGateway = () => {
    if (!TOKEN || process.env.DISCORD_GATEWAY === "0") {
        return;
    }
    connect(false);
};
