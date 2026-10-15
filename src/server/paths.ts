import { join } from "path";
import { mediaPut, mediaRemove, mediaUrl } from "./media";

export { UPLOADS } from "./storage";
export { mediaUrl, mediaHas } from "./media";

export const PENDING = join(import.meta.dir, "static", "pending.png");

export const clearMedia = mediaRemove;

export class UploadError extends Error {}

// Magic bytes for image formats
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
    png: [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    jpg: [new Uint8Array([0xFF, 0xD8, 0xFF])],
    webp: [new Uint8Array([0x52, 0x49, 0x46, 0x46]), new Uint8Array([0x57, 0x45, 0x42, 0x50])], // RIFF + WEBP at offset 8
    gif: [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
};

function checkMagicBytes(bytes: Uint8Array, expectedType: string): boolean {
    const signatures = MAGIC_BYTES[expectedType];
    if (!signatures) return true; // Unknown type, skip check

    for (const sig of signatures) {
        if (sig.length <= bytes.length) {
            let match = true;
            for (let i = 0; i < sig.length; i++) {
                if (bytes[i] !== sig[i]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
    }
    return false;
}

const IMAGE_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif"
};

const AUDIO_TYPES: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
};

const AUDIO_MAGIC_BYTES: Record<string, Uint8Array[]> = {
    mp3: [
        new Uint8Array([0xFF, 0xFB]), // MP3 with ID3v2
        new Uint8Array([0xFF, 0xF3]), // MP3 without ID3
        new Uint8Array([0x49, 0x44, 0x33]), // ID3v2 header
    ],
    ogg: [new Uint8Array([0x4F, 0x67, 0x67, 0x53])], // OggS
    wav: [new Uint8Array([0x52, 0x49, 0x46, 0x46])], // RIFF (WAVE follows at offset 8)
};

function checkAudioMagicBytes(bytes: Uint8Array, expectedType: string): boolean {
    const signatures = AUDIO_MAGIC_BYTES[expectedType];
    if (!signatures) return true;

    for (const sig of signatures) {
        if (sig.length <= bytes.length) {
            let match = true;
            for (let i = 0; i < sig.length; i++) {
                if (bytes[i] !== sig[i]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
    }
    return false;
}

export const saveAudio = async (id: number, file: File, maxBytes = 12 * 1024 * 1024) => {
    if (file.size > maxBytes) {
        throw new UploadError("Audio files must be 12 MB or smaller.");
    }
    const ext = AUDIO_TYPES[file.type];
    if (!ext) {
        throw new UploadError("Audio must be MP3, OGG or WAV.");
    }

    // Validate magic bytes
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!checkAudioMagicBytes(bytes, ext)) {
        throw new UploadError("File content does not match its declared type.");
    }

    return mediaPut("assets", id, ext, file);
};


export const saveImage = async (kind: string, id: number, file: File, maxBytes = 4 * 1024 * 1024) => {
    if (file.size > maxBytes) {
        throw new UploadError(`Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
    }
    const ext = IMAGE_TYPES[file.type];
    if (!ext) {
        throw new UploadError("Images must be PNG, JPG, WEBP or GIF.");
    }

    // Validate magic bytes
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!checkMagicBytes(bytes, ext)) {
        throw new UploadError("File content does not match its declared type.");
    }

    return mediaPut(kind, id, ext, file);
};


export const withThumbnail = async <T extends { id: number, thumbnail?: string, asset_id?: unknown }>(item: T) => ({
    ...item,
    // pg hands bigint back as a string
    ...(item.asset_id != null ? {
        asset_id: Number(item.asset_id)
    } : {}),
    thumbnail: item.thumbnail || await mediaUrl("catalog", item.id)
});
