import { Elysia, t } from "elysia";
import { session } from "../../session";
import { sql, now } from "../../db";
import { rcc, RccError } from "../../rcc";
import { SITE_URL, SITE_INTERNAL_URL, appearanceUrl } from "../../site";
import { friendStatus } from "../../friends";
import { sign, rbxsig, studiosig, text } from "./sign";
import { isInternal } from "./internal";
import { bool, xmlBool, xml } from "./respond";
import { TIERS, membershipOf } from "../../membership";
import { report } from "../../counters";

const ADMIN_GROUP = 1200769;

export const placeR15 = async (placeId: number) => {
    const [game] = await sql`SELECT avatar_type FROM games WHERE id = ${placeId}`;
    return game?.avatar_type === "R15";
};

const creatorOf = async (placeId: number) => {
    const [game] = await sql`SELECT creator_id FROM games WHERE id = ${placeId}`;
    return game ? Number(game.creator_id) || 1 : 1;
};


const userFromToken = async (token: string) => {
    const [row] = await sql`
        SELECT users.id, users.username, users.membership, users.membership_expires FROM tokens
        JOIN users ON users.id = tokens.user_id
        WHERE token = ${token} AND expires > ${now()}
    `;
    return row ?? null;
};


export const studioSetup = (site: string) => {
    const social = `${site}/Game/LuaWebService/HandleSocialRequest.ashx?method=`;
    return [
        `pcall(function() game:GetService("InsertService"):SetFreeModelUrl("${site}/Game/Tools/InsertAsset.ashx?type=fm&q=%s&pg=%d&rs=%d") end)`,
        `pcall(function() game:GetService("InsertService"):SetFreeDecalUrl("${site}/Game/Tools/InsertAsset.ashx?type=fd&q=%s&pg=%d&rs=%d") end)`,
        `game:GetService("ScriptInformationProvider"):SetAssetUrl("${site}/Asset/")`,
        `game:GetService("InsertService"):SetBaseSetsUrl("${site}/Game/Tools/InsertAsset.ashx?nsets=10&type=base")`,
        `game:GetService("InsertService"):SetUserSetsUrl("${site}/Game/Tools/InsertAsset.ashx?nsets=20&type=user&userid=%d")`,
        `game:GetService("InsertService"):SetCollectionUrl("${site}/Game/Tools/InsertAsset.ashx?sid=%d")`,
        `game:GetService("InsertService"):SetAssetUrl("${site}/Asset/?id=%d")`,
        `game:GetService("InsertService"):SetAssetVersionUrl("${site}/Asset/?assetversionid=%d")`,
        `pcall(function() game:GetService("SocialService"):SetFriendUrl("${social}IsFriendsWith&playerid=%d&userid=%d") end)`,
        `pcall(function() game:GetService("SocialService"):SetBestFriendUrl("${social}IsBestFriendsWith&playerid=%d&userid=%d") end)`,
        `pcall(function() game:GetService("SocialService"):SetGroupUrl("${social}IsInGroup&playerid=%d&groupid=%d") end)`,
        `pcall(function() game:GetService("SocialService"):SetGroupRankUrl("${social}GetGroupRank&playerid=%d&groupid=%d") end)`,
        `pcall(function() game:GetService("SocialService"):SetGroupRoleUrl("${social}GetGroupRole&playerid=%d&groupid=%d") end)`,
        `pcall(function() game:GetService("GamePassService"):SetPlayerHasPassUrl("${site}/Game/GamePass/GamePassHandler.ashx?Action=HasPass&UserID=%d&PassID=%d") end)`,
        `pcall(function() game:GetService("BadgeService"):SetPlaceId(game.PlaceId) end)`,
        `pcall(function() game:GetService("BadgeService"):SetAwardBadgeUrl("${site}/Game/Badges/AwardBadge.ashx?UserID=%d&BadgeID=%d&PlaceID=%d") end)`,
        `pcall(function() game:GetService("BadgeService"):SetHasBadgeUrl("${site}/Game/Badges/HasBadge.ashx?UserID=%d&BadgeID=%d") end)`,
        `pcall(function() game:GetService("BadgeService"):SetIsBadgeDisabledUrl("${site}/Game/Badges/IsBadgeDisabled.ashx?BadgeID=%d") end)`,
        `pcall(function() game:GetService("MarketplaceService"):SetProductInfoUrl("${site}/marketplace/productinfo?assetId=%d") end)`,
        `pcall(function() game:GetService("MarketplaceService"):SetPlayerOwnsAssetUrl("${site}/ownership/hasAsset?userId=%d&assetId=%d") end)`,
        `game:GetService("ScriptContext"):AddStarterScript(37801172)`
    ];
};


const routes = (prefix: string) => new Elysia({ prefix })
    .use(session)


    .all("/Join.ashx", async ({ query, user, status }) => {
        const who = user ?? (query.token ? await userFromToken(query.token) : null);
        console.log(`Join: job ${query.jobId ?? "?"} for ${who ? who.username : "nobody"}`);
        if (!who) {
            return status(401, "invalid auth ticket");
        }

        const server = query.jobId ? await rcc.server(query.jobId) : null;
        if (!server) {
            return status(410, "that game server is gone");
        }

        const placeId = server.placeId;
        const appearance = appearanceUrl(who.id);
        await sql`UPDATE games SET visits = visits + 1 WHERE id = ${placeId}`;
        await sql`INSERT INTO game_plays (user_id, game_id, played_at) VALUES (${who.id}, ${placeId}, ${now()}) ON CONFLICT (user_id, game_id) DO UPDATE SET played_at = ${now()}`;
        const time = String(now());


        const ticket = time
            + ";" + sign([who.id, who.username, appearance, server.jobId, time].join("\n"))
            + ";" + sign([who.id, server.jobId, time].join("\n"));

        const join = {
            ClientPort: 0,
            MachineAddress: server.address,
            ServerPort: server.port,
            PingUrl: "",
            PingInterval: 20,
            UserName: who.username,
            SeleniumTestMode: false,
            UserId: who.id,
            SuperSafeChat: false,
            CharacterAppearance: appearance,
            ClientTicket: ticket,
            GameId: server.jobId,
            PlaceId: placeId,
            MeasurementUrl: "",
            WaitingForCharacterGuid: "26eb3e21-aa80-475b-a777-b43c3ea5f7d2",
            BaseUrl: SITE_URL + "/",
            ChatStyle: "ClassicAndBubble",
            VendorId: 0,
            ScreenShotInfo: "",
            VideoInfo: "",
            CreatorId: await creatorOf(placeId),
            CreatorTypeEnum: "User",
            MembershipType: TIERS[membershipOf(who)].enum,
            AccountAge: 100,
            CookieStoreFirstTimePlayKey: "rbx_evt_ftp",
            CookieStoreFiveMinutePlayKey: "rbx_evt_fmp",
            CookieStoreEnabled: true,
            IsRobloxPlace: false,
            GenerateTeleportJoin: false,
            IsUnknownOrUnder13: false,
            SessionId: "39412c34-2f9b-436f-b19d-b8db90c2e186|00000000-0000-0000-0000-000000000000|0|190.23.103.228|8|2021-03-03T17:04:47+01:00|0|null|null",
            DataCenterId: 0,
            UniverseId: placeId,
            BrowserTrackerId: 0,
            UsePortraitMode: false,
            FollowUserId: 0,
            characterAppearanceId: 1
        };

        return text(rbxsig(JSON.stringify(join)));
    }, {
        query: t.Object({
            jobId: t.Optional(t.String()),
            token: t.Optional(t.String())
        })
    })

    .all("/PlaceLauncher.ashx", async ({ query, user, token, status, request }) => {
        const placeId = query.placeId ?? query.placeid ?? query.PlaceId ?? 0;
        console.log(`PlaceLauncher: place ${placeId} for ${user ? user.username : "nobody"} via ${request.headers.get("user-agent") ?? "?"}`);
        if (!user || !token) {
            return status(403, "invalid auth ticket");
        }

        const [game] = placeId > 0 ? await sql`SELECT id, creator_id, access FROM games WHERE id = ${placeId}` : [];
        if (!game) {
            return {
                jobId: "",
                status: 5,
                message: "no such place"
            };
        }

        const owner = Number(game.creator_id) === user.id || user.admin > 0;
        if (game.access === "private" && !owner) {
            return {
                jobId: "",
                status: 5,
                message: "this place is private"
            };
        }
        if (game.access === "friends" && !owner && await friendStatus(user.id, Number(game.creator_id)) !== "friends") {
            return {
                jobId: "",
                status: 5,
                message: "this place is for the owner's friends"
            };
        }

        let server;
        try {
            server = query.jobId ? await rcc.server(query.jobId) : await rcc.findOrCreate(placeId);
        } catch (err) {
            console.error(`PlaceLauncher: could not start a server for place ${placeId}:`, err instanceof RccError ? err.message : err);
            return {
                jobId: "",
                status: 5,
                message: "could not start a game server"
            };
        }

        // findOrCreate answers without a placeId, only a jobId join can point at the wrong place
        if (!server || (query.jobId && Number(server.placeId) !== Number(placeId))) {
            return {
                jobId: "",
                status: 5,
                message: "server not found"
            };
        }

        if (!server.ready) {
            return {
                jobId: server.jobId,
                status: 0,
                message: "starting the game server"
            };
        }

        await sql`
            INSERT INTO game_visit_sessions (game_id, user_id, job_id, started_at)
            VALUES (${placeId}, ${user.id}, ${server.jobId}, ${now()}) ON CONFLICT DO NOTHING`;

        console.log(`PlaceLauncher: ${user.username} -> ${server.jobId} on ${server.address}:${server.port}`);
        return {
            jobId: server.jobId,
            status: 2,
            joinScriptUrl: `${SITE_URL}/Game/Join.ashx?token=${token}&jobId=${encodeURIComponent(server.jobId)}`,
            authenticationUrl: `${SITE_URL}/Login/Negotiate.ashx`,
            authenticationTicket: token,
            message: "success"
        };
    }, {
        query: t.Object({
            placeId: t.Optional(t.Numeric()),
            placeid: t.Optional(t.Numeric()),
            PlaceId: t.Optional(t.Numeric()),
            jobId: t.Optional(t.String({ maxLength: 64 }))
        })
    })


    .get("/LoadPlaceInfo.ashx", async ({ query }) => {
        const site = SITE_INTERNAL_URL;
        const social = `${site}/Game/LuaWebService/HandleSocialRequest.ashx?method=`;
        const lua = [
            `pcall(function() game:SetCreatorID(${await creatorOf(query.PlaceId)}, Enum.CreatorType.User) end)`,
            `pcall(function() game:GetService("SocialService"):SetFriendUrl("${social}IsFriendsWith&playerid=%d&userid=%d") end)`,
            `pcall(function() game:GetService("SocialService"):SetBestFriendUrl("${social}IsBestFriendsWith&playerid=%d&userid=%d") end)`,
            `pcall(function() game:GetService("SocialService"):SetGroupUrl("${social}IsInGroup&playerid=%d&groupid=%d") end)`,
            `pcall(function() game:GetService("SocialService"):SetGroupRankUrl("${social}GetGroupRank&playerid=%d&groupid=%d") end)`,
            `pcall(function() game:GetService("SocialService"):SetGroupRoleUrl("${social}GetGroupRole&playerid=%d&groupid=%d") end)`,
            `pcall(function() game:GetService("FriendService"):SetGetFriendsUrl("${site}/Friend/AreFriends?userId=%d") end)`,
            `pcall(function() game:GetService("FriendService"):SetCreateFriendRequestUrl("${site}/Friend/CreateFriendRequest?firstUserId=%d&secondUserId=%d") end)`,
            `pcall(function() game:GetService("FriendService"):SetDeleteFriendRequestUrl("${site}/Friend/DeleteFriendRequest?firstUserId=%d&secondUserId=%d") end)`,
            `pcall(function() game:GetService("FriendService"):SetMakeFriendUrl("${site}/Friend/CreateFriend?firstUserId=%d&secondUserId=%d") end)`,
            `pcall(function() game:GetService("FriendService"):SetBreakFriendUrl("${site}/Friend/BreakFriend?firstUserId=%d&secondUserId=%d") end)`,
            `pcall(function() game:GetService("FriendService"):SetEnabled(true) end)`,
            `pcall(function() game:GetService("GamePassService"):SetPlayerHasPassUrl("${site}/Game/GamePass/GamePassHandler.ashx?Action=HasPass&UserID=%d&PassID=%d") end)`,
            `pcall(function() game:GetService("BadgeService"):SetPlaceId(${query.PlaceId}) end)`,
            `pcall(function() game:GetService("BadgeService"):SetAwardBadgeUrl("${site}/Game/Badges/AwardBadge.ashx?UserID=%d&BadgeID=%d&PlaceID=%d") end)`,
            `pcall(function() game:GetService("BadgeService"):SetHasBadgeUrl("${site}/Game/Badges/HasBadge.ashx?UserID=%d&BadgeID=%d") end)`,
            `pcall(function() game:GetService("BadgeService"):SetIsBadgeDisabledUrl("${site}/Game/Badges/IsBadgeDisabled.ashx?BadgeID=%d") end)`,
            `pcall(function() game:GetService("MarketplaceService"):SetProductInfoUrl("${site}/marketplace/productinfo?assetId=%d") end)`,
            `pcall(function() game:GetService("MarketplaceService"):SetDevProductInfoUrl("${site}/marketplace/productDetails?productId=%d") end)`,
            `pcall(function() game:GetService("MarketplaceService"):SetPlayerOwnsAssetUrl("${site}/ownership/hasAsset?userId=%d&assetId=%d") end)`,
            `pcall(function() game:SetUniverseId(${query.PlaceId}) end)`,
            `pcall(function() game.ForceR15 = ${await placeR15(query.PlaceId)} end)`,
            `pcall(function() game:SetPlaceVersion(1) end)`,
            `pcall(function() game:SetVIPServerOwnerId(0) end)`,
            ""
        ].join("\n");

        return text(rbxsig(lua));
    }, {
        query: t.Object({
            PlaceId: t.Numeric()
        })
    })


    .get("/studio.ashx", () => text(studiosig(["", ...studioSetup(SITE_URL), ""].join("\n"))))

    .get("/players/:userId", () => ({
        ChatFilter: "blacklist"
    }), {
        params: t.Object({
            userId: t.Numeric()
        })
    })

    .all("/validate-machine", () => ({
        success: true
    }))

    .all("/report-stats", ({ query }) => {
        const value = Number(query.value);
        if (query.name && Number.isFinite(value)) {
            report(query.name.slice(0, 80), value);
        }
        return "";
    }, {
        query: t.Object({
            name: t.Optional(t.String()),
            value: t.Optional(t.String())
        })
    })


    .all("/MachineConfiguration.ashx", () => "")

    // phones report how the join went, c is the step and r the outcome
    .all("/JoinRate.ashx", ({ query }) => {
        console.log(`JoinRate: ${query.c ?? "?"} ${query.r ?? "?"} user ${query.i ?? "?"} place ${query.p ?? "?"} after ${query.d ?? "?"}ms, ${query.b ?? "?"} bytes in, ${query.platform ?? "?"}`);
        return "";
    }, {
        query: t.Object({
            i: t.Optional(t.String()),
            p: t.Optional(t.String()),
            c: t.Optional(t.String()),
            r: t.Optional(t.String()),
            d: t.Optional(t.String()),
            b: t.Optional(t.String()),
            platform: t.Optional(t.String())
        })
    })


    .all("/Badges/AwardBadge.ashx", async ({ query, request, server }) => {
        if (!isInternal(request, server)) {
            return bool(false);
        }
        const [badge] = await sql`SELECT game_id, enabled FROM game_badges WHERE id = ${query.BadgeID}`;
        if (!badge || !badge.enabled || Number(badge.game_id) !== query.PlaceID) {
            return bool(false);
        }
        const [exists] = await sql`SELECT id FROM users WHERE id = ${query.UserID}`;
        if (!exists) {
            return bool(false);
        }
        await sql`INSERT INTO user_badges (user_id, badge_id, awarded_at) VALUES (${query.UserID}, ${query.BadgeID}, ${now()}) ON CONFLICT DO NOTHING`;
        return bool(true);
    }, {
        query: t.Object({
            UserID: t.Numeric(),
            BadgeID: t.Numeric(),
            PlaceID: t.Numeric()
        })
    })

    .get("/Badges/HasBadge.ashx", async ({ query }) => {
        const [row] = await sql`SELECT 1 FROM user_badges WHERE user_id = ${query.UserID} AND badge_id = ${query.BadgeID}`;
        return bool(!!row);
    }, {
        query: t.Object({
            UserID: t.Numeric(),
            BadgeID: t.Numeric()
        })
    })


    .get("/Badges/IsBadgeDisabled.ashx", async ({ query }) => {
        const [badge] = await sql`SELECT enabled FROM game_badges WHERE id = ${query.BadgeID}`;
        return bool(!badge || !badge.enabled);
    }, {
        query: t.Object({
            BadgeID: t.Numeric()
        })
    })


    .get("/GamePass/GamePassHandler.ashx", async ({ query, set }) => {
        if (query.Action !== "HasPass") {
            set.status = 400;
            return xmlBool(false);
        }
        const [row] = await sql`SELECT 1 FROM user_game_passes WHERE user_id = ${query.UserID} AND pass_id = ${query.PassID}`;
        return xmlBool(!!row);
    }, {
        query: t.Object({
            Action: t.String(),
            UserID: t.Numeric(),
            PassID: t.Numeric()
        })
    })


    .get("/LuaWebService/HandleSocialRequest.ashx", async ({ query }) => {
        const isAdmin = async () => {
            const [row] = await sql`SELECT admin FROM users WHERE id = ${query.playerid}`;
            return !!row && Number(row.admin) > 0;
        };

        switch (query.method) {
            case "IsFriendsWith":
                return xmlBool(query.userid !== undefined && await friendStatus(query.playerid, query.userid) === "friends");
            case "IsInGroup":
                return xmlBool(query.groupid === ADMIN_GROUP && await isAdmin());
            case "GetGroupRank":
                return xml("integer", query.groupid === 1 && await isAdmin() ? 255 : 0);
            case "GetGroupRole":
                return xml("string", query.groupid === 1 && await isAdmin() ? "Admin" : "Guest");
            default:
                return xmlBool(false);
        }
    }, {
        query: t.Object({
            method: t.Union([
                t.Literal("IsFriendsWith"),
                t.Literal("IsBestFriendsWith"),
                t.Literal("IsInGroup"),
                t.Literal("GetGroupRank"),
                t.Literal("GetGroupRole")
            ]),
            playerid: t.Numeric(),
            userid: t.Optional(t.Numeric()),
            groupid: t.Optional(t.Numeric())
        })
    })

export const game = new Elysia()
    .use(session)
    .use(routes("/Game"))
    .use(routes("/game"))


    .get("/GetAllowedMD5Hashes", () => ({
        data: ["3000f74eb7ffca5c3b5fc7d93f80de30"]
    }))

    .get("/GetAllowedSecurityKeys", () => ({
        data: ["76E5A40C-3AE1-4028-9F10-7C62520BD94F"]
    }))

    .get("/GetAllowedSecurityVersions", () => ({
        data: ["0.249.0pcplayer"]
    }))

    .get("/users/:userId/canmanage/:placeId", async ({ params }) => {
        const [game] = await sql`SELECT creator_id FROM games WHERE id = ${params.placeId}`;
        return { Success: true, CanManage: !!game && Number(game.creator_id) === params.userId };
    }, {
        params: t.Object({
            userId: t.Numeric(),
            placeId: t.Numeric()
        })
    })

    .get("/discord", ({ redirect }) => redirect("https://discord.gg/qvYkJ6q6A9", 302))


    .get("/games/start", ({ query, redirect }) => {
        const placeId = query.placeid ?? query.placeId;
        // a discord join brings the job along
        const join = query.jobId ? `&join=${encodeURIComponent(query.jobId)}` : "";
        return redirect(placeId === undefined ? "/games" : `/game?id=${placeId}${join}`);
    }, {
        query: t.Object({
            placeid: t.Optional(t.Numeric()),
            placeId: t.Optional(t.Numeric()),
            jobId: t.Optional(t.String({ maxLength: 64 }))
        })
    })


    .get("/Login/Negotiate.ashx", async ({ query, cookie, status }) => {
        const who = await userFromToken(query.suggest);
        console.log(`Negotiate: ${who ? who.username : "bad ticket"}`);
        if (!who) {
            return status(403, "false");
        }
        cookie[".ROBLOSECURITY"]!.set({
            value: query.suggest,
            path: "/",
            httpOnly: true,
            sameSite: "lax"
        });
        return text("");
    }, {
        query: t.Object({
            suggest: t.String()
        })
    })
