import { join } from "path";

// where renders and uploads go, rcc manager writes here too
export const UPLOADS = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");

export const avatarImage = (userId: number, headshot: boolean) =>
    join(UPLOADS, "avatars", `${userId}${headshot ? "-headshot" : ""}.png`);

export const PENDING = join(import.meta.dir, "static", "pending.png");
