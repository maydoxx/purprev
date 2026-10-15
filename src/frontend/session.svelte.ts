import { api } from "./api";
import type { Theme } from "./themes";

export type Me = {
    id: number;
    username: string;
    about: string | null;
    admin: number;
    currency: number;
    tix: number;
    ongoing_action_id: number | null;
    membership: "None" | "BC" | "TBC" | "OBC";
    membership_expires: number;
    social_discord: string;
    social_twitter: string;
    social_youtube: string;
    theme: Theme;
    social_visibility: Record<string, boolean>;
    processing_consents: Record<string, boolean>;
    processing_objections: Record<string, boolean>;
    processing_restricted: boolean;
};

let me = $state<Me | null>(null);
let loaded = $state(false);

export const session = {
    get me() {
        return me;
    },
    get loaded() {
        return loaded;
    },

    set(user: Me) {
        me = user;
        loaded = true;
    },

    async refresh() {
        try {
            me = await api<Me>("/auth/me");
        } catch {
            me = null;
        }
        loaded = true;
    },

    async logout() {
        await api("/auth/logout", {});
        me = null;
    }
};
