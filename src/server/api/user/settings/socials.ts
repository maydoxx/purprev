import { Elysia, t } from "elysia";
import { session } from "../../../session";
import { sql } from "../../../db";

const discordName = (s: string) => {
    const v = s.trim().replace(/^@/, "");
    return /^[a-z0-9._]{2,32}(#\d{4})?$/i.test(v) ? v : null;
};

const twitterName = (s: string) => {
    const v = s.trim().replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "").replace(/^@/, "").replace(/[/?].*$/, "");
    return /^[A-Za-z0-9_]{1,15}$/.test(v) ? v : null;
};

const youtubeName = (s: string) => {
    const v = s.trim().replace(/^https?:\/\/(www\.|m\.)?youtube\.com\//i, "").replace(/[?#].*$/, "").replace(/\/$/, "");
    if (/^@[A-Za-z0-9._-]{3,30}$/.test(v)) {
        return v;
    }
    if (/^(c|channel|user)\/[A-Za-z0-9._-]{1,60}$/.test(v)) {
        return v;
    }
    return /^[A-Za-z0-9._-]{3,30}$/.test(v) ? `@${v}` : null;
};

export const socials = new Elysia()
    .use(session)
    .post("/socials", async ({ body, user, status }) => {
        const discord = body.discord.trim() ? discordName(body.discord) : "";
        const twitter = body.twitter.trim() ? twitterName(body.twitter) : "";
        const youtube = body.youtube.trim() ? youtubeName(body.youtube) : "";
        if (discord === null) {
            return status(400, {
                error: "That does not look like a Discord username"
            });
        }
        if (twitter === null) {
            return status(400, {
                error: "That does not look like a Twitter handle"
            });
        }
        if (youtube === null) {
            return status(400, {
                error: "Give a YouTube handle like @name or a youtube.com link"
            });
        }
        await sql`UPDATE users SET social_discord = ${discord}, social_twitter = ${twitter}, social_youtube = ${youtube} WHERE id = ${user.id}`;
        return {
            ok: true,
            discord,
            twitter,
            youtube
        };
    }, {
        auth: true,
        body: t.Object({
            discord: t.String({ maxLength: 120 }),
            twitter: t.String({ maxLength: 200 }),
            youtube: t.String({ maxLength: 200 })
        })
    })
