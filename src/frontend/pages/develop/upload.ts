import { postForm } from "./develop";

const CHUNK = 768 * 1024;
const MAX = 50 * 1024 * 1024;

export const checkPlaceFile = (file: File) => {
    if (!/\.rbxl$/i.test(file.name)) return "Only .rbxl place files are supported.";
    if (file.size <= 0 || file.size > MAX) return "Place files can be up to 50 MB.";
    return "";
};

export const uploadPlace = async (placeId: number, file: File, progress?: (percent: number) => void) => {
    const count = Math.ceil(file.size / CHUNK);

    for (let i = 0; i < count; i++) {
        const form = new FormData();
        form.append("chunkIndex", String(i));
        form.append("chunkCount", String(count));
        form.append("originalName", file.name);
        form.append("chunk", file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK)), "chunk.bin");

        progress?.(Math.round(i / count * 100));
        await postForm(`/develop/places/${placeId}/upload`, form);
    }

    progress?.(100);
};
