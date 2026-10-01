import { api } from "./api";

export type Me = {
    id: number;
    username: string;
    email: string | null;
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
    game_ui: string;
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
