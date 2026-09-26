import { join } from "path";
import { mediaPut, mediaRemove, mediaUrl } from "./media";

export { UPLOADS } from "./storage";
export { mediaUrl, mediaHas } from "./media";

export const PENDING = join(import.meta.dir, "static", "pending.png");

export const clearMedia = mediaRemove;

export class UploadError extends Error {}

const IMAGE_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif"
};


export const saveImage = async (kind: string, id: number, file: File, maxBytes = 4 * 1024 * 1024) => {
    if (file.size > maxBytes) {
        throw new UploadError(`Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
    }
    const ext = IMAGE_TYPES[file.type];
    if (!ext) {
        throw new UploadError("Images must be PNG, JPG, WEBP or GIF.");
    }
    return mediaPut(kind, id, ext, file);
};


export const withThumbnail = async <T extends { id: number, thumbnail?: string }>(item: T) => ({
    ...item,
    thumbnail: item.thumbnail || await mediaUrl("catalog", item.id)
});
