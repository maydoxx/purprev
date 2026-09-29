import { Elysia, t } from "elysia";
import { join, basename, extname } from "path";
import { tmpdir } from "os";
import { mkdir, rm } from "fs/promises";
import { session } from "../../session";
import { sql, now } from "../../db";
import { saveImage, mediaUrl, mediaHas, clearMedia, UploadError } from "../../paths";
import { mediaPut, mediaCopy } from "../../media";
import { rcc } from "../../rcc";
import { assetUrl } from "../../site";

const PLACE_MAX = 50 * 1024 * 1024;
const CHUNK_MAX = 768 * 1024;
const CHUNK_COUNT_MAX = 110;
const IMAGE_MAX = 5 * 1024 * 1024;
const AUDIO_MAX = 12 * 1024 * 1024;
const MAX_PRICE = 2000000000;
const TEMPLATE_WIDTH = 585;
const TEMPLATE_HEIGHT = 559;
const TSHIRT_MAX_SIDE = 1024;

const ASSET_ID_BASE = 3000000000;
const CHUNKS = join(tmpdir(), "nonerev-place-uploads");

const id = t.Object({
    id: t.Numeric()
});
const clothing = t.Union([
    t.Literal("shirts"),
    t.Literal("pants"),
    t.Literal("t-shirts")
]);

const price = t.Optional(t.Numeric({ minimum: 0 }));

const CATEGORIES = {
    shirts: "Shirt",
    pants: "Pants",
    "t-shirts": "T-Shirt"
};


const CLOTHING_CLASSES: Record<string, [string, string, string]> = {
    Shirt: ["Shirt", "ShirtTemplate", "Shirt"],
    Pants: ["Pants", "PantsTemplate", "Pants"],
    "T-Shirt": ["ShirtGraphic", "Graphic", "T-Shirt"]
};

const ICON_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
};
const THUMBNAIL_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif"
};

class DevelopError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

const handle = (err: unknown, status: any) => {
    if (err instanceof DevelopError) {
        return status(err.status, {
            error: err.message
        });
    }
    if (err instanceof UploadError) {
        return status(400, {
            error: err.message
        });
    }
    throw err;
};

const ownedGame = async (placeId: number, userId: number) => {
    const [game] = await sql`SELECT * FROM games WHERE id = ${placeId} AND creator_id = ${userId}`;
    if (!game) {
        throw new DevelopError("Place not found.", 404);
    }
    return game;
};

const cleanTitle = (title: string) => {
    title = title.trim();
    if (title === "") {
        throw new DevelopError("Give the place a name.");
    }
    return title.slice(0, 100);
};

const withMedia = async (game: any) => ({
    ...game,
    thumbnail: await mediaUrl("thumbnails", game.id),
    icon: await mediaUrl("icons", game.id),
    has_file: await mediaHas("places", game.id)
});

const checkPlaceName = (name: string) => {
    if (extname(name).toLowerCase() !== ".rbxl") {
        throw new DevelopError("Only .rbxl place files are supported.");
    }
};

const savePlace = async (placeId: number, file: Blob) => {
    await mediaPut("places", placeId, "rbxl", file);
    await sql`UPDATE games SET updated_at = ${now()} WHERE id = ${placeId}`;
};

const chunkPath = (dir: string, index: number) => join(dir, `${String(index).padStart(4, "0")}.part`);


const imageSize = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
        return {
            type: "png",
            width: view.getUint32(16),
            height: view.getUint32(20)
        };
    }
    if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return {
            type: "gif",
            width: view.getUint16(6, true),
            height: view.getUint16(8, true)
        };
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < bytes.length) {
            if (bytes[offset] !== 0xff) {
                return null;
            }
            const marker = bytes[offset + 1]!;

            if (marker === 0xff) {
                offset += 1;
                continue;
            }
            if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
                offset += 2;
                continue;
            }
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return {
                    type: "jpg",
                    width: view.getUint16(offset + 7),
                    height: view.getUint16(offset + 5)
                };
            }
            offset += 2 + view.getUint16(offset + 2);
        }
    }
    return null;
};

const checkTexture = async (category: string, file: File) => {
    if (file.size <= 0) {
        throw new DevelopError("The uploaded image is empty.");
    }
    if (file.size > IMAGE_MAX) {
        throw new DevelopError("Images can be up to 5 MB.");
    }
    const named = extname(file.name).toLowerCase();
    if (named !== ".png" && named !== ".jpg" && named !== ".jpeg") {
        throw new DevelopError("Only PNG and JPG images are supported.");
    }
    const bytes = await file.bytes();
    const image = imageSize(bytes);
    if (!image || image.type === "gif") {
        throw new DevelopError("That file is not a PNG or JPG image.");
    }

    if (category === "T-Shirt") {
        if (image.width > TSHIRT_MAX_SIDE || image.height > TSHIRT_MAX_SIDE) {
            throw new DevelopError(`T-Shirt images can be up to ${TSHIRT_MAX_SIDE}x${TSHIRT_MAX_SIDE} pixels (this one is ${image.width}x${image.height}).`);
        }
    } else if (image.width !== TEMPLATE_WIDTH || image.height !== TEMPLATE_HEIGHT) {
        throw new DevelopError(`The template must be exactly ${TEMPLATE_WIDTH}x${TEMPLATE_HEIGHT} pixels (this one is ${image.width}x${image.height}).`);
    }
    return {
        bytes,
        extension: image.type
    };
};


const reserveAsset = async (tx: any, userId: number, type: string, name: string, extension: string, parentId: number | null = null) => {
    const created = await tx`INSERT INTO assets (creator_id, type, name, extension, parent_id, created_at) VALUES (${userId}, ${type}, ${name.trim().slice(0, 100) || "Untitled"}, ${extension}, ${parentId}, ${now()})`;
    return Number(created.lastInsertRowid);
};


const deleteAssetTree = async (tx: any, assetId: number, userId: number) => {
    for (const child of await tx`SELECT id FROM assets WHERE parent_id = ${assetId} AND creator_id = ${userId}`) {
        await deleteAssetTree(tx, Number(child.id), userId);
    }
    await tx`DELETE FROM assets WHERE id = ${assetId} AND creator_id = ${userId}`;
    await clearMedia("assets", assetId);
};


const deleteOwnedAsset = async (assetId: number, userId: number) => {
    const [asset] = await sql`SELECT parent_id FROM assets WHERE id = ${assetId} AND creator_id = ${userId}`;
    const [used] = await sql`SELECT 1 FROM catalog_items WHERE asset_id = ${assetId}`;
    if (!asset || asset.parent_id !== null || used) {
        return false;
    }
    await deleteAssetTree(sql, assetId, userId);
    return true;
};

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");


const clothingXml = (category: string, textureId: number) => {
    const [className, property, objectName] = CLOTHING_CLASSES[category]!;
    return [
        '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
        "\t<External>null</External>",
        "\t<External>nil</External>",
        `\t<Item class="${className}" referent="RBX0">`,
        "\t\t<Properties>",
        `\t\t\t<string name="Name">${escapeXml(objectName)}</string>`,
        `\t\t\t<Content name="${property}"><url>${escapeXml(assetUrl(textureId))}</url></Content>`,
        "\t\t</Properties>",
        "\t</Item>",
        "</roblox>",
        ""
    ].join("\n");
};


const storeClothing = async (userId: number, category: string, name: string, file: File, objectId = 0) => {
    const texture = await checkTexture(category, file);
    const fresh = objectId <= 0;
    const dropped: number[] = [];

    await sql.begin(async tx => {
        if (fresh) {
            objectId = await reserveAsset(tx, userId, category, name, "rbxmx");
        }
        const textureId = await reserveAsset(tx, userId, "Image", name, texture.extension, objectId);
        try {
            await mediaPut("assets", textureId, texture.extension, texture.bytes);
            await mediaPut("assets", objectId, "rbxmx", clothingXml(category, textureId));
        } catch (err) {
            await clearMedia("assets", textureId);
            if (fresh) {
                await clearMedia("assets", objectId);
            }
            throw err;
        }
        for (const old of await tx`SELECT id FROM assets WHERE parent_id = ${objectId} AND id <> ${textureId}`) {
            await tx`DELETE FROM assets WHERE id = ${old.id}`;
            dropped.push(Number(old.id));
        }
    });
    for (const oldId of dropped) {
        await clearMedia("assets", oldId);
    }
    return objectId;
};

const ownedItem = async (itemId: number, userId: number, category: string) => {
    const [item] = await sql`SELECT * FROM catalog_items WHERE id = ${itemId} AND creator_id = ${userId} AND category = ${category}`;
    if (!item) {
        throw new DevelopError("Clothing item not found.", 404);
    }
    return item;
};

const cleanName = (name: string) => {
    name = name.trim();
    if (name === "") {
        throw new DevelopError("Give the item a name.");
    }
    return name.slice(0, 80);
};

const cleanDescription = (description?: string) => (description ?? "").trim().slice(0, 2000);


const parsePrice = (price?: number) => {
    if (price === undefined) {
        return null;
    }
    if (!Number.isInteger(price)) {
        throw new DevelopError("Price must be a whole number, or left blank for Off Sale.");
    }
    if (price > MAX_PRICE) {
        throw new DevelopError(`Price must be ${MAX_PRICE.toLocaleString("en-US")} or less.`);
    }
    return price;
};


const numericId = (value: any) => value === null || value === undefined ? null : Number(value);

const withItemMedia = async (item: any) => ({
    ...item,
    asset_id: numericId(item.asset_id),
    thumbnail: item.thumbnail || await mediaUrl("catalog", item.id)
});

const cleanGameAsset = (kind: string, name: string, description?: string) => {
    name = name.trim();
    description = (description ?? "").trim();
    if (name === "" || name.length > 100) {
        throw new DevelopError(`${kind} name must be 1-100 characters.`);
    }
    if (description.length > 2000) {
        throw new DevelopError("Description cannot be longer than 2000 characters.");
    }
    return {
        name,
        description
    };
};

const storeIcon = async (kind: string, dir: string, id: number, file: File) => {
    if (file.size <= 0 || file.size > IMAGE_MAX) {
        throw new DevelopError(`${kind} icons can be up to 5 MB.`);
    }
    if (!ICON_TYPES[file.type]) {
        throw new DevelopError("Use a PNG, JPG or WEBP icon.");
    }
    return await saveImage(dir, id, file, IMAGE_MAX);
};

const hasFile = (file?: File) => !!file && file.size > 0;

const ownedBadge = async (badgeId: number, userId: number) => {
    const [badge] = await sql`SELECT * FROM game_badges WHERE id = ${badgeId} AND creator_id = ${userId}`;
    if (!badge) {
        throw new DevelopError("Badge not found.", 404);
    }
    return badge;
};

const ownedPass = async (passId: number, userId: number) => {
    const [pass] = await sql`SELECT * FROM game_passes WHERE id = ${passId} AND creator_id = ${userId}`;
    if (!pass) {
        throw new DevelopError("Game pass not found.", 404);
    }
    return pass;
};

const ownsGame = async (gameId: number, userId: number, message: string) => {
    const [game] = await sql`SELECT 1 FROM games WHERE id = ${gameId} AND creator_id = ${userId}`;
    if (!game) {
        throw new DevelopError(message);
    }
};

const passPrice = (price?: number) => {
    if (price === undefined) {
        return null;
    }
    if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
        throw new DevelopError("Invalid price.");
    }
    return price;
};


export const develop = new Elysia({ prefix: "/api/develop" })
    .use(session)


    .get("/places", async ({ user }) => {
        const rows = await sql`SELECT * FROM games WHERE creator_id = ${user.id} ORDER BY id ASC`;
        return await Promise.all(rows.map(withMedia));
    }, {
        auth: true
    })

    .post("/places", async ({ body, user, status }) => {
        try {
            const title = cleanTitle(body.title);
            const file = hasFile(body.place_file) ? body.place_file! : null;
            if (file) {
                checkPlaceName(file.name);
                if (file.size > PLACE_MAX) {
                    throw new DevelopError("Place files can be up to 50 MB.");
                }
            }

            const created = await sql`INSERT INTO games (creator_id, title, created_at, updated_at) VALUES (${user.id}, ${title}, ${now()}, ${now()})`;
            const id = Number(created.lastInsertRowid);
            if (file) {
                await savePlace(id, file);
                rcc.render.place(id);
            }
            return {
                ok: true,
                id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            title: t.String(),
            place_file: t.Optional(t.File())
        })
    })

    .patch("/places/:id", async ({ params, body, user, status }) => {
        try {
            await ownedGame(params.id, user.id);
            const title = cleanTitle(body.title);
            await sql`UPDATE games SET title = ${title}, updated_at = ${now()} WHERE id = ${params.id} AND creator_id = ${user.id}`;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            title: t.String()
        })
    })

    .delete("/places/:id", async ({ params, user, status }) => {
        try {
            await ownedGame(params.id, user.id);
            await sql`DELETE FROM games WHERE id = ${params.id} AND creator_id = ${user.id}`;
            await clearMedia("places", params.id);
            await clearMedia("thumbnails", params.id);
            await clearMedia("icons", params.id);
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })


    .post("/places/:id/upload", async ({ params, body, user, status }) => {
        try {
            const [game] = await sql`SELECT 1 FROM games WHERE id = ${params.id} AND creator_id = ${user.id}`;
            if (!game) {
                throw new DevelopError("This place does not belong to your account.", 403);
            }
            const { chunkIndex, chunkCount, chunk } = body;
            if (chunkIndex < 0 || chunkCount < 1 || chunkCount > CHUNK_COUNT_MAX || chunkIndex >= chunkCount) {
                throw new DevelopError("Invalid upload chunk information.");
            }
            checkPlaceName(body.originalName);
            if (chunk.size <= 0 || chunk.size > CHUNK_MAX) {
                throw new DevelopError("Invalid upload chunk size.");
            }

            const dir = join(CHUNKS, `${user.id}-${params.id}`);

            if (chunkIndex === 0) {
                await rm(dir, {
                    recursive: true,
                    force: true
                });
            }
            await mkdir(dir, {
                recursive: true
            });
            await Bun.write(chunkPath(dir, chunkIndex), chunk);

            if (chunkIndex !== chunkCount - 1) {
                return {
                    ok: true,
                    complete: false,
                    received: chunkIndex + 1,
                    total: chunkCount
                };
            }

            let size = 0;
            for (let i = 0; i < chunkCount; i++) {
                const part = Bun.file(chunkPath(dir, i));
                if (!(await part.exists())) {
                    throw new DevelopError(`Upload is incomplete. Missing chunk ${i + 1}.`, 409);
                }
                size += part.size;
                if (size > PLACE_MAX) {
                    throw new DevelopError("Place files can be up to 50 MB.", 413);
                }
            }

            const assembled = join(dir, "place.rbxl.tmp");
            const out = Bun.file(assembled).writer();
            for (let i = 0; i < chunkCount; i++) {
                out.write(await Bun.file(chunkPath(dir, i)).bytes());
            }
            await out.end();
            await savePlace(params.id, Bun.file(assembled));
            await rm(dir, {
                recursive: true,
                force: true
            });
            rcc.render.place(params.id);

            return {
                ok: true,
                complete: true,
                size
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            chunkIndex: t.Numeric(),
            chunkCount: t.Numeric(),
            originalName: t.String(),
            chunk: t.File()
        })
    })


    .post("/places/:id/thumbnail", async ({ params, body, user, status }) => {
        try {
            await ownedGame(params.id, user.id);
            const image = body.image;
            if (image.size <= 0) {
                throw new DevelopError("That image is empty.");
            }
            if (image.size > IMAGE_MAX) {
                throw new DevelopError("Thumbnails can be up to 5 MB.");
            }
            const ext = THUMBNAIL_TYPES[image.type];
            if (!ext) {
                throw new DevelopError("Use a PNG, JPG or GIF.");
            }
            const info = imageSize(await image.bytes());
            if (!info || info.type !== ext) {
                throw new DevelopError("That file is not an image.");
            }
            if (info.width < 64 || info.height < 64) {
                throw new DevelopError("That image is too small, use at least 64x64.");
            }

            const thumbnail = await saveImage("thumbnails", params.id, image, IMAGE_MAX);

            const icon = await mediaCopy("thumbnails", "icons", params.id);

            return {
                ok: true,
                thumbnail,
                icon
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            image: t.File({ type: "image" })
        })
    })


    .get("/clothing/:category", async ({ params, user }) => {
        const rows = await sql`SELECT * FROM catalog_items WHERE creator_id = ${user.id} AND category = ${CATEGORIES[params.category]} ORDER BY id DESC`;
        return await Promise.all(rows.map(withItemMedia));
    }, {
        auth: true,
        params: t.Object({
            category: clothing
        })
    })

    .post("/clothing/:category", async ({ params, body, user, status }) => {
        try {
            const category = CATEGORIES[params.category];
            const name = cleanName(body.name);
            const description = cleanDescription(body.description);
            const price = parsePrice(body.price);
            const assetId = await storeClothing(user.id, category, name, body.texture_file);

            const created = await sql`
                INSERT INTO catalog_items (name, description, creator_id, category, asset_id, price, thumbnail, is_featured, created_at, updated_at)
                VALUES (${name}, ${description}, ${user.id}, ${category}, ${assetId}, ${price}, '', 0, ${now()}, ${now()})
            `;
            const itemId = Number(created.lastInsertRowid);
            rcc.render.item(itemId, assetId);

            return {
                ok: true,
                id: itemId
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            category: clothing
        }),
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            texture_file: t.File({ type: "image" })
        })
    })

    .patch("/clothing/:category/:id", async ({ params, body, user, status }) => {
        try {
            const category = CATEGORIES[params.category];
            const item = await ownedItem(params.id, user.id, category);
            const name = cleanName(body.name);
            const description = cleanDescription(body.description);
            const price = parsePrice(body.price);
            let assetId = numericId(item.asset_id);
            const newImage = hasFile(body.texture_file);


            if (newImage) {
                const [existing] = assetId !== null && assetId >= ASSET_ID_BASE ? await sql`SELECT * FROM assets WHERE id = ${assetId}` : [null];
                const reusable = existing && Number(existing.creator_id) === user.id && existing.parent_id === null && existing.type in CLOTHING_CLASSES;
                assetId = await storeClothing(user.id, category, name, body.texture_file!, reusable ? assetId! : 0);
            }


            await sql`
                UPDATE catalog_items SET name = ${name}, description = ${description}, asset_id = ${assetId}, price = ${price},
                    thumbnail = ${newImage ? "" : item.thumbnail}, updated_at = ${now()}
                WHERE id = ${params.id} AND creator_id = ${user.id}
            `;
            if (newImage) {
                rcc.render.item(params.id, assetId!);
            }
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            category: clothing,
            id: t.Numeric()
        }),
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            texture_file: t.Optional(t.File({ type: "image" }))
        })
    })

    .delete("/clothing/:category/:id", async ({ params, user, status }) => {
        try {
            const item = await ownedItem(params.id, user.id, CATEGORIES[params.category]);
            await sql`DELETE FROM catalog_items WHERE id = ${params.id} AND creator_id = ${user.id}`;

            await sql`DELETE FROM user_items WHERE item_id = ${params.id}`;


            const assetId = numericId(item.asset_id);
            if (assetId !== null && assetId >= ASSET_ID_BASE) {
                await deleteOwnedAsset(assetId, user.id);
            }
            await clearMedia("catalog", params.id);
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: t.Object({
            category: clothing,
            id: t.Numeric()
        })
    })


    .get("/audio", async ({ user }) => {
        const rows = await sql`SELECT * FROM assets WHERE creator_id = ${user.id} AND type = 'Audio' ORDER BY id DESC`;
        return rows.map((asset: any) => ({
            ...asset,
            id: Number(asset.id)
        }));
    }, {
        auth: true
    })

    .post("/audio", async ({ body, user, status }) => {
        try {
            const file = body.audio_file;
            if (file.size <= 0) {
                throw new DevelopError("Choose an audio file.");
            }
            if (file.size > AUDIO_MAX) {
                throw new DevelopError("Audio files can be up to 12 MB.");
            }
            const extension = extname(file.name).slice(1).toLowerCase();
            if (!["mp3", "ogg", "wav"].includes(extension)) {
                throw new DevelopError("Only MP3, OGG and WAV files are supported.");
            }
            const name = (body.name.trim() || basename(file.name, extname(file.name))).slice(0, 100);

            const id = await reserveAsset(sql, user.id, "Audio", name, extension);
            try {
                await mediaPut("assets", id, extension, file);
            } catch (err) {
                await sql`DELETE FROM assets WHERE id = ${id}`;
                throw err;
            }
            return {
                ok: true,
                id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            name: t.String(),
            audio_file: t.File()
        })
    })

    .delete("/audio/:id", async ({ params, user, status }) => {
        const [asset] = await sql`SELECT 1 FROM assets WHERE id = ${params.id} AND creator_id = ${user.id} AND type = 'Audio'`;
        if (!asset || !(await deleteOwnedAsset(params.id, user.id))) {
            return status(404, {
                error: "Audio asset not found."
            });
        }
        return {
            ok: true
        };
    }, {
        auth: true,
        params: id
    })


    .get("/badges", async ({ user }) => {
        const rows = await sql`
            SELECT b.*, g.title AS game_title, (SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id) AS awarded_count
            FROM game_badges b LEFT JOIN games g ON g.id = b.game_id
            WHERE b.creator_id = ${user.id} ORDER BY b.id DESC
        `;
        return await Promise.all(rows.map(async (b: any) => ({
            ...b,
            id: Number(b.id),
            awarded_count: Number(b.awarded_count),
            icon: b.icon || await mediaUrl("badges", Number(b.id))
        })));
    }, {
        auth: true
    })

    .post("/badges", async ({ body, user, status }) => {
        try {
            await ownsGame(body.game_id, user.id, "You can only create a badge for your own place.");
            const { name, description } = cleanGameAsset("Badge", body.name, body.description);
            const created = await sql`
                INSERT INTO game_badges (game_id, creator_id, name, description, enabled, created_at, updated_at)
                VALUES (${body.game_id}, ${user.id}, ${name}, ${description}, ${!!body.enabled}, ${now()}, ${now()})
            `;
            const id = Number(created.lastInsertRowid);

            if (hasFile(body.icon)) {
                try {
                    const icon = await storeIcon("Badge", "badges", id, body.icon!);
                    await sql`UPDATE game_badges SET icon = ${icon} WHERE id = ${id}`;
                } catch (err) {
                    await sql`DELETE FROM game_badges WHERE id = ${id}`;
                    throw err;
                }
            }
            return {
                ok: true,
                id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            enabled: t.Optional(t.BooleanString()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .patch("/badges/:id", async ({ params, body, user, status }) => {
        try {
            const badge = await ownedBadge(params.id, user.id);
            await ownsGame(body.game_id, user.id, "You can only move a badge to your own place.");
            const { name, description } = cleanGameAsset("Badge", body.name, body.description);
            const icon = hasFile(body.icon) ? await storeIcon("Badge", "badges", params.id, body.icon!) : badge.icon;

            await sql`
                UPDATE game_badges SET game_id = ${body.game_id}, name = ${name}, description = ${description},
                    enabled = ${!!body.enabled}, icon = ${icon}, updated_at = ${now()}
                WHERE id = ${params.id} AND creator_id = ${user.id}
            `;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            enabled: t.Optional(t.BooleanString()),
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .delete("/badges/:id", async ({ params, user, status }) => {
        try {
            await ownedBadge(params.id, user.id);
            await sql.begin(async tx => {
                await tx`DELETE FROM user_badges WHERE badge_id = ${params.id}`;
                await tx`DELETE FROM game_badges WHERE id = ${params.id} AND creator_id = ${user.id}`;
            });
            await clearMedia("badges", params.id);
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })


    .get("/game-passes", async ({ user }) => {
        const rows = await sql`
            SELECT p.*, g.title AS game_title FROM game_passes p
            LEFT JOIN games g ON g.id = p.game_id
            WHERE p.creator_id = ${user.id} ORDER BY p.id DESC
        `;
        return await Promise.all(rows.map(async (p: any) => ({
            ...p,
            id: Number(p.id),
            icon: p.icon || await mediaUrl("gamepasses", Number(p.id))
        })));
    }, {
        auth: true
    })

    .post("/game-passes", async ({ body, user, status }) => {
        try {
            await ownsGame(body.game_id, user.id, "You can only create a pass for your own place.");
            const { name, description } = cleanGameAsset("Game pass", body.name, body.description);
            const price = passPrice(body.price);
            const created = await sql`
                INSERT INTO game_passes (game_id, creator_id, name, description, price, created_at, updated_at)
                VALUES (${body.game_id}, ${user.id}, ${name}, ${description}, ${price}, ${now()}, ${now()})
            `;
            const id = Number(created.lastInsertRowid);

            if (hasFile(body.icon)) {
                try {
                    const icon = await storeIcon("Game pass", "gamepasses", id, body.icon!);
                    await sql`UPDATE game_passes SET icon = ${icon} WHERE id = ${id}`;
                } catch (err) {
                    await sql`DELETE FROM game_passes WHERE id = ${id}`;
                    throw err;
                }
            }
            return {
                ok: true,
                id
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .patch("/game-passes/:id", async ({ params, body, user, status }) => {
        try {
            const pass = await ownedPass(params.id, user.id);
            await ownsGame(body.game_id, user.id, "You can only move a pass to your own place.");
            const { name, description } = cleanGameAsset("Game pass", body.name, body.description);
            const price = passPrice(body.price);
            const icon = hasFile(body.icon) ? await storeIcon("Game pass", "gamepasses", params.id, body.icon!) : pass.icon;

            await sql`
                UPDATE game_passes SET game_id = ${body.game_id}, name = ${name}, description = ${description},
                    price = ${price}, icon = ${icon}, updated_at = ${now()}
                WHERE id = ${params.id} AND creator_id = ${user.id}
            `;
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id,
        body: t.Object({
            game_id: t.Numeric(),
            name: t.String(),
            description: t.Optional(t.String()),
            price,
            icon: t.Optional(t.File({ type: "image" }))
        })
    })

    .delete("/game-passes/:id", async ({ params, user, status }) => {
        try {
            await ownedPass(params.id, user.id);
            await sql.begin(async tx => {
                await tx`DELETE FROM user_game_passes WHERE pass_id = ${params.id}`;
                await tx`DELETE FROM game_passes WHERE id = ${params.id} AND creator_id = ${user.id}`;
            });
            await clearMedia("gamepasses", params.id);
            return {
                ok: true
            };
        } catch (err) {
            return handle(err, status);
        }
    }, {
        auth: true,
        params: id
    })
