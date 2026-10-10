import { Elysia, t } from "elysia";
import { session, type User } from "../../session";
import { sql, now } from "../../db";
import { rcc } from "../../rcc";
import { SITE_URL } from "../../site";
import { mediaPut, mediaHas, mediaUrl, unsafeXml } from "../../media";
import { PENDING } from "../../paths";
import { text, studiosig } from "../engine/sign";
import { studioSetup, placeR15 } from "../engine/game";
import { html, welcomePage, toolboxPage, publishPage, saveModelPage } from "./pages";
import { searchFree, searchOwn, item as toolboxItem, stamp } from "./toolbox";
import { setsOf, setItems } from "../sets";
import { placeLimit, placeLimitLabel } from "../../games";


const ASSET_MAX = 20 * 1024 * 1024;
const PER_PAGE_MAX = 50;
const USER_SET = 1000000;

const ASSET_TYPES: Record<number, string> = {
    1: "Image",
    4: "Mesh",
    5: "Script",
    10: "Model",
    13: "Decal",
    24: "Animation"
};

const num = (...values: unknown[]) => {
    for (const v of values) {
        const n = Number(v);
        if (v !== undefined && v !== "" && Number.isInteger(n) && n > 0) {
            return n;
        }
    }
    return 0;
};

const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });

const unpack = (bytes: Uint8Array<ArrayBuffer>) => {
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        return Bun.gunzipSync(bytes);
    }
    if (bytes[0] === 0x78) {
        try {
            return Bun.inflateSync(bytes);
        } catch {
            return bytes;
        }
    }
    return bytes;
};

const startsWith = (bytes: Uint8Array, s: string) => {
    for (let i = 0; i < s.length; i++) {
        if (bytes[i] !== s.charCodeAt(i)) {
            return false;
        }
    }
    return true;
};

const extensionFor = (type: string, bytes: Uint8Array) => {
    if (type === "Image" || type === "Decal") {
        if (startsWith(bytes, "\x89PNG")) {
            return "png";
        }
        if (bytes[0] === 0xff && bytes[1] === 0xd8) {
            return "jpg";
        }
        if (startsWith(bytes, "GIF8")) {
            return "gif";
        }
        if (startsWith(bytes, "BM")) {
            return "bmp";
        }
        return "png";
    }
    if (type === "Mesh") {
        return "mesh";
    }
    return startsWith(bytes, "<roblox") ? "rbxmx" : "rbxm";
};

const ownedPlace = async (placeId: number, user: User) => {
    const [game] = await sql`SELECT id, creator_id, title FROM games WHERE id = ${placeId}`;
    if (!game || (Number(game.creator_id) !== user.id && user.admin < 1)) {
        return null;
    }
    return game;
};

const placeInfo = async (placeId: number) => {
    const [game] = await sql`SELECT games.id, games.creator_id, games.title, users.username FROM games LEFT JOIN users ON users.id = games.creator_id WHERE games.id = ${placeId}`;
    return game ?? null;
};

const myPlaces = async (userId: number) => {
    const rows = await sql`SELECT id, title FROM games WHERE creator_id = ${userId} ORDER BY id DESC`;
    return Promise.all(rows.map(async (g: any) => ({
        id: Number(g.id),
        title: g.title,
        icon: await mediaUrl("icons", Number(g.id)),
        has_file: await mediaHas("places", Number(g.id))
    })));
};

const cleanName = (name: string) => name.replace(/[\r\n\t]+/g, " ").trim().slice(0, 100);

const raw = {
    parse: "none" as const
};


export const studio = new Elysia()
    .use(session)


    .get("/game/GetCurrentUser.ashx", ({ user }) => text(user ? String(user.id) : "null"))
    .get("/Game/GetCurrentUser.ashx", ({ user }) => text(user ? String(user.id) : "null"))

    // edit.ashx starts the loop that calls this, nothing else says studio is open
    .get("/Game/Studio/Presence.ashx", async ({ query, user }) => {
        if (user) {
            await sql`UPDATE users SET last_studio = ${now()}, studio_place_id = ${num(query.placeId)} WHERE id = ${user.id}`;
        }
        return text("");
    }, {
        query: t.Object({
            placeId: t.Optional(t.String())
        })
    })

    .get("/login/RequestAuth.ashx", ({ user, token, status }) => user && token ? text(`${SITE_URL}/Login/Negotiate.ashx?suggest=${token}`) : status(403, ""))
    .get("/Login/RequestAuth.ashx", ({ user, token, status }) => user && token ? text(`${SITE_URL}/Login/Negotiate.ashx?suggest=${token}`) : status(403, ""))

    .get("/game/logout.aspx", async ({ logout }) => {
        await logout();
        return text("");
    })
    .get("/Game/logout.aspx", async ({ logout }) => {
        await logout();
        return text("");
    })


    .get("/ide/welcome", async ({ user, request }) => {
        const params = new URL(request.url).searchParams;
        const paths = params.getAll("filepath");
        const names = params.getAll("filename");
        return html(welcomePage({
            user,
            places: user ? await myPlaces(user.id) : [],
            recent: paths.map((path, i) => ({
                path,
                name: names[i] || path
            })),
            showLogin: params.get("showlogin") === "True"
        }));
    })
    .get("/My/Places.aspx", ({ redirect }) => redirect("/ide/welcome", 302))
    .get("/my/places.aspx", ({ redirect }) => redirect("/ide/welcome", 302))


    .get("/Game/edit.ashx", async ({ query, user, status }) => {
        const placeId = num(query.PlaceID, query.placeId, query.placeid);
        const game = placeId ? await placeInfo(placeId) : null;
        if (!game) {
            return status(404, "no such place");
        }
        const site = SITE_URL;
        const lua = [
            `game:GetService("ChangeHistoryService"):SetEnabled(false)`,
            `game:SetPlaceID(${placeId}, false)`,
            `pcall(function() game:SetUniverseId(${placeId}) end)`,
            `game:GetService("Visit"):SetUploadUrl("${site}/Data/Upload.ashx?assetid=${placeId}")`,
            ...studioSetup(site),
            await mediaHas("places", placeId) ? `game:Load("${site}/asset/?id=${placeId}")` : `print("edit: nothing published for this place yet")`,
            `game:GetService("ChangeHistoryService"):SetEnabled(true)`,
            `game:GetService("ChangeHistoryService"):ResetWaypoints()`,
            `spawn(function() while true do pcall(function() game:HttpGet("${site}/Game/Studio/Presence.ashx?placeId=${placeId}", true) end) wait(60) end end)`,
            ""
        ].join("\n");
        console.log(`edit: place ${placeId} for ${user ? user.username : "nobody"}`);
        return text(studiosig(lua));
    }, {
        query: t.Object({
            PlaceID: t.Optional(t.String()),
            placeId: t.Optional(t.String()),
            placeid: t.Optional(t.String())
        })
    })


    .get("/universes/get-universe-containing-place", async ({ query }) => {
        const placeId = num(query.placeId, query.placeid, query.PlaceId);
        const game = placeId ? await placeInfo(placeId) : null;
        return json(game ? {
            UniverseId: placeId,
            RootPlaceId: placeId,
            Name: game.title
        } : {
            UniverseId: null
        });
    }, {
        query: t.Object({
            placeId: t.Optional(t.String()),
            placeid: t.Optional(t.String()),
            PlaceId: t.Optional(t.String())
        })
    })

    .get("/universes/:id/cloudeditenabled", () => json({
        enabled: false
    }))

    .get("/universes/:id/game-start-info", async ({ params }) => json({
        r15Morphing: await placeR15(params.id)
    }), {
        params: t.Object({
            id: t.Numeric()
        })
    })

    .get("/universes/get-info", async ({ query, user }) => {
        const game = await placeInfo(query.universeId);
        if (!game) {
            return json({});
        }
        return json({
            UniverseId: query.universeId,
            Name: game.title,
            RootPlace: query.universeId,
            r15Morphing: game.avatar_type === "R15",
            CurrentUserHasEditPermissions: !!user && (Number(game.creator_id) === user.id || user.admin > 0),
            IsActive: true,
            Creator: {
                Id: Number(game.creator_id),
                Name: game.username ?? "NoneRev",
                Type: 1
            }
        });
    }, {
        query: t.Object({
            universeId: t.Numeric()
        })
    })

    .get("/universes/get-universe-places", async ({ query }) => {
        const game = await placeInfo(query.universeId);
        return json({
            FinalPage: true,
            RootPlace: query.universeId,
            Places: game ? [{
                PlaceId: query.universeId,
                Name: game.title
            }] : []
        });
    }, {
        query: t.Object({
            universeId: t.Numeric(),
            page: t.Optional(t.String())
        })
    })

    .get("/developerproducts/list", () => json({
        FinalPage: true,
        DeveloperProducts: []
    }))

    .get("/universes/get-aliases", () => json({
        FinalPage: true,
        Aliases: []
    }))


    .get("/IDE/ClientToolbox.aspx", ({ user }) => html(toolboxPage(!!user)))

    .get("/Game/Tools/InsertAsset.ashx", async ({ query, user }) => {
        const kind = query.type === "fd" ? "Decal" : "Model";
        const page = Math.max(1, num(query.pg));
        const per = Math.min(PER_PAGE_MAX, Math.max(1, num(query.rs) || 21));

        if (query.type === "base") {
            return json([{
                Name: "Free Models",
                SetId: 1,
                CategoryId: 0,
                CreatorName: "NoneRev",
                ImageAssetId: 0,
                ImageAssetUrl: ""
            }, {
                Name: "Free Decals",
                SetId: 2,
                CategoryId: 0,
                CreatorName: "NoneRev",
                ImageAssetId: 0,
                ImageAssetUrl: ""
            }]);
        }

        if (query.type === "user") {
            const userId = num(query.userid);
            return json(userId ? [{
                Name: "My Models",
                SetId: USER_SET + userId,
                CategoryId: 0,
                CreatorName: "",
                ImageAssetId: 0,
                ImageAssetUrl: ""
            }, {
                Name: "My Decals",
                SetId: USER_SET * 2 + userId,
                CategoryId: 0,
                CreatorName: "",
                ImageAssetId: 0,
                ImageAssetUrl: ""
            }, ...(await setsOf(userId)).map(set => ({
                Name: set.name,
                SetId: set.id,
                CategoryId: 0,
                CreatorName: "",
                ImageAssetId: 0,
                ImageAssetUrl: set.icon
            }))] : []);
        }

        const sid = num(query.sid);
        if (sid) {
            if (sid === 1 || sid === 2) {
                return json((await searchFree(sid === 1 ? "Model" : "Decal", "", page, per)).items);
            }
            if (sid < USER_SET) {
                const items = await setItems(sid);
                return json(items.slice((page - 1) * per, page * per).map(i => toolboxItem(i.asset_id, i.name, i.creator, stamp(i.created_at))));
            }
            const setKind = sid >= USER_SET * 2 ? "Decal" : "Model";
            const userId = sid - (setKind === "Decal" ? USER_SET * 2 : USER_SET);
            return json((await searchOwn(setKind, "", page, per, userId)).items);
        }

        const q = (query.q ?? "").trim().slice(0, 100);
        const found = query.mine === "1" && user
            ? await searchOwn(kind, q, page, per, user.id)
            : await searchFree(kind, q, page, per);
        return json([{
            TotalCount: found.total,
            Results: found.items
        }]);
    }, {
        query: t.Object({
            type: t.Optional(t.String()),
            q: t.Optional(t.String()),
            pg: t.Optional(t.String()),
            rs: t.Optional(t.String()),
            nsets: t.Optional(t.String()),
            userid: t.Optional(t.String()),
            sid: t.Optional(t.String()),
            mine: t.Optional(t.String())
        })
    })


    .get("/IDE/publishas", async ({ user }) => html(publishPage(user, user ? await myPlaces(user.id) : [])))
    .get("/IDE/publishgameas", async ({ user }) => html(publishPage(user, user ? await myPlaces(user.id) : [])))
    .get("/IDE/Upload.aspx", async ({ user }) => html(publishPage(user, user ? await myPlaces(user.id) : [])))

    .post("/IDE/publishas", async ({ body, user, status }) => {
        if (!user) {
            return status(401, {
                error: "not logged in"
            });
        }
        const title = cleanName(body.name);
        if (!title) {
            return status(400, {
                error: "name the place"
            });
        }
        const created = await sql`INSERT INTO games (creator_id, title, created_at, updated_at) VALUES (${user.id}, ${title}, ${now()}, ${now()}) RETURNING id`;
        return {
            id: Number(created[0].id)
        };
    }, {
        body: t.Object({
            name: t.String()
        })
    })

    .get("/UI/Save.aspx", ({ query, user }) => html(saveModelPage(user, query.type ?? "Model")), {
        query: t.Object({
            type: t.Optional(t.String())
        })
    })


    .post("/Data/Upload.ashx", async ({ query, user, request, status }) => {
        const placeId = num(query.assetid, query.assetId, query.AssetID);
        if (!user) {
            return status(401, "log in first");
        }
        const game = placeId ? await ownedPlace(placeId, user) : null;
        if (!game) {
            return status(403, "not your place");
        }
        const bytes = unpack(new Uint8Array(await request.arrayBuffer()));
        if (bytes.byteLength < 16 || !startsWith(bytes, "<roblox")) {
            return status(400, "that is not a place file");
        }
        if (bytes.byteLength > placeLimit(user)) {
            return status(413, `place files can be up to ${placeLimitLabel(user)}`);
        }
        if (unsafeXml(bytes)) {
            return status(400, "that place file has markup that isnt allowed");
        }
        await rcc.closePlace(placeId);
        await mediaPut("places", placeId, "rbxl", bytes);
        await sql`UPDATE games SET updated_at = ${now()} WHERE id = ${placeId}`;
        rcc.render.place(placeId);
        console.log(`publish: place ${placeId} (${game.title}) by ${user.username}, ${bytes.byteLength} bytes`);
        return text(String(placeId));
    }, {
        ...raw,
        query: t.Object({
            assetid: t.Optional(t.String()),
            assetId: t.Optional(t.String()),
            AssetID: t.Optional(t.String())
        })
    })

    .post("/Data/NewAsset.ashx", async ({ query, user, request, status }) => {
        if (!user) {
            return status(401, "log in first");
        }
        const type = ASSET_TYPES[num(query.type)];
        if (!type) {
            return status(400, "unknown asset type");
        }
        const bytes = unpack(new Uint8Array(await request.arrayBuffer()));
        if (bytes.byteLength < 4) {
            return status(400, "empty asset");
        }
        if (bytes.byteLength > ASSET_MAX) {
            return status(413, "assets can be up to 20 MB");
        }
        const name = cleanName(query.Name ?? query.name ?? "") || `Untitled ${type}`;
        const extension = extensionFor(type, bytes);
        if (extension === "rbxmx" && unsafeXml(bytes)) {
            return status(400, "that model has markup that isnt allowed");
        }
        const created = await sql`INSERT INTO assets (creator_id, type, name, extension, parent_id, created_at) VALUES (${user.id}, ${type}, ${name}, ${extension}, ${null}, ${now()}) RETURNING id`;
        const id = Number(created[0].id);
        await mediaPut("assets", id, extension, bytes);
        console.log(`publish: ${type} ${id} (${name}) by ${user.username}, ${bytes.byteLength} bytes`);
        return text(String(id));
    }, {
        ...raw,
        query: t.Object({
            type: t.Optional(t.String()),
            Name: t.Optional(t.String()),
            name: t.Optional(t.String()),
            Description: t.Optional(t.String())
        })
    })
