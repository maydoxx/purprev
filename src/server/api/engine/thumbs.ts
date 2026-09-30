import { Elysia, t } from "elysia";
import { mediaStream } from "../../media";
import { PENDING } from "../../paths";
import { thumbnail } from "../studio/toolbox";

const pending = () =>
    new Response(Bun.file(PENDING), {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=300"
        }
    });

const num = (...values: unknown[]) => {
    for (const v of values) {
        const n = Number(v);
        if (v !== undefined && v !== "" && Number.isInteger(n) && n > 0) {
            return n;
        }
    }
    return 0;
};

const asset = ({ query, status }: any) => {
    const id = num(query.assetId, query.AssetID, query.assetid, query.AssetId, query.aid, query.id);
    if (!id) {
        return status(400, "assetId missing");
    }
    return thumbnail(id, PENDING, num(query.width, query.Width, query.wd, query.height, query.Height, query.ht) || 150);
};

const person = (kind: "avatars" | "headshots") => async ({ query, status }: any) => {
    const id = num(query.userId, query.UserID, query.userid, query.UserId);
    if (!id) {
        return status(400, "userId missing");
    }
    return (await mediaStream(kind, id, "private, max-age=300")) ?? pending();
};

const any = t.Record(t.String(), t.Optional(t.String()));

const routes = (prefix: string) => new Elysia({ prefix })
    .get("/Asset.ashx", asset, { query: any })
    .get("/asset.ashx", asset, { query: any })
    .get("/Avatar.ashx", person("avatars"), { query: any })
    .get("/avatar.ashx", person("headshots"), { query: any })
    .get("/AvatarHeadshot.ashx", person("headshots"), { query: any })
    .get("/Head.ashx", person("headshots"), { query: any });

export const thumbs = new Elysia()
    .use(routes("/Thumbs"))
    .use(routes("/thumbs"))
    .get("/Game/Tools/ThumbnailAsset.ashx", asset, { query: any })
    .get("/Game/Tools/ThumbnailsAssets.ashx", asset, { query: any })
    .get("/game/Tools/ThumbnailAsset.ashx", asset, { query: any });
