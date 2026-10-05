import { sql, now } from "./db";
import { friendCount } from "./friends";
import { membershipOf } from "./membership";

export const SITE_BADGES = {
    administrator: "Administrator",
    "welcome-to-the-club": "Welcome To The Club",
    "builders-club": "Builders Club",
    "turbo-builders-club": "Turbo Builders Club",
    "outrageous-builders-club": "Outrageous Builders Club",
    friendship: "Friendship",
    homestead: "Homestead",
    bricksmith: "Bricksmith",
    "official-model-maker": "Official Model Maker",
    inviter: "Inviter",
    veteran: "Veteran"
};

export type SiteBadge = keyof typeof SITE_BADGES;

const YEAR = 365 * 86400;

export const siteBadges = async (user: { id: number, admin: number, created_at: number | string, membership?: string | null, membership_expires?: number | string | null }) => {
    const [places, models, invited, friends] = await Promise.all([
        sql`SELECT COUNT(*)::int AS n FROM games JOIN media ON media.kind = 'places' AND media.id = games.id WHERE games.creator_id = ${user.id}`,
        sql`SELECT COUNT(*)::int AS n FROM assets WHERE creator_id = ${user.id} AND type = 'Model' AND parent_id IS NULL`,
        sql`SELECT COUNT(*)::int AS n FROM invite_log WHERE created_by = ${user.id} AND used_by > 0`,
        friendCount(user.id)
    ]);
    const published = Number(places[0].n);

    const earned: SiteBadge[] = [];
    if (user.admin > 0) {
        earned.push("administrator");
    }
    const tier = membershipOf(user);
    if (tier !== "None") {
        earned.push("welcome-to-the-club");
        earned.push(tier === "BC" ? "builders-club" : tier === "TBC" ? "turbo-builders-club" : "outrageous-builders-club");
    }
    if (friends >= 20) {
        earned.push("friendship");
    }
    if (published >= 1) {
        earned.push("homestead");
    }
    if (published >= 5) {
        earned.push("bricksmith");
    }
    if (Number(models[0].n) >= 1) {
        earned.push("official-model-maker");
    }
    if (Number(invited[0].n) >= 1) {
        earned.push("inviter");
    }
    if (Number(user.created_at) > 0 && Number(user.created_at) <= now() - YEAR) {
        earned.push("veteran");
    }
    return earned.map(id => ({
        id,
        name: SITE_BADGES[id]
    }));
};
