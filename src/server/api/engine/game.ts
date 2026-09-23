import { Elysia, t } from "elysia";
import { stub } from "../stub";
import { bool, xmlBool } from "./respond";

// client uses /Game and /game both
const routes = (prefix: string) => new Elysia({ prefix })
    // join script, has to be signed with the client key
    // keep IsRobloxPlace false or a bad LocalScript freezes the client
    // TODO: auth from .ROBLOSECURITY cookie, server/port for the jobId from rcc manager
    .get("/Join.ashx", stub, {
        query: t.Object({
            jobId: t.Optional(t.String())
        })
    })

    // status 0 = still starting (client retries), 2 = ready, anything else = *dead*
    // dont put a slash before the ? in joinScriptUrl or the client wont fetch it
    // TODO: ask rcc manager for a server
    .get("/PlaceLauncher.ashx", stub, {
        query: t.Object({
            placeId: t.Optional(t.Numeric()),
            placeid: t.Optional(t.Numeric()),
            PlaceId: t.Optional(t.Numeric())
        })
    })

    // lua the game server runs on start, signed like Join.ashx
    // use the internal url in here, only the game server fetches these
    .get("/LoadPlaceInfo.ashx", stub, {
        query: t.Object({
            PlaceId: t.Numeric()
        })
    })

    // same for studio, signature is %sig% without --rbxsig
    .get("/studio.ashx", stub)

    .get("/players/:userId", () => ({
        ChatFilter: "blacklist"
    }), {
        params: t.Object({
            userId: t.Numeric()
        })
    })

    .all("/validate-machine", () => "")

    // TODO: game servers only, then actually award
    .all("/Badges/AwardBadge.ashx", () => bool(false), {
        query: t.Object({
            UserID: t.Numeric(),
            BadgeID: t.Numeric(),
            PlaceID: t.Numeric()
        })
    })

    .get("/Badges/HasBadge.ashx", () => bool(false), {
        query: t.Object({
            UserID: t.Numeric(),
            BadgeID: t.Numeric()
        })
    })

    // unknown badge = disabled
    .get("/Badges/IsBadgeDisabled.ashx", () => bool(true), {
        query: t.Object({
            BadgeID: t.Numeric()
        })
    })

    // Action is always HasPass
    .get("/GamePass/GamePassHandler.ashx", () => xmlBool(false), {
        query: t.Object({
            Action: t.String(),
            UserID: t.Numeric(),
            PassID: t.Numeric()
        })
    })

    // IsBestFriendsWith is always false
    // TODO: GetGroupRank wants <Value Type="integer">, GetGroupRole never existed
    .get("/LuaWebService/HandleSocialRequest.ashx", () => xmlBool(false), {
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
    .use(routes("/Game"))
    .use(routes("/game"))

    // android app catches this url and launches the game itself
    .get("/games/start", ({ query, redirect }) => {
        const placeId = query.placeid ?? query.placeId;
        return redirect(placeId === undefined ? "/games" : `/game?id=${placeId}`);
    }, {
        query: t.Object({
            placeid: t.Optional(t.Numeric()),
            placeId: t.Optional(t.Numeric())
        })
    })

    // suggest is the ticket, good = set .ROBLOSECURITY and echo it, bad = 403 "false"
    .get("/Login/Negotiate.ashx", stub, {
        query: t.Object({
            suggest: t.String()
        })
    })
