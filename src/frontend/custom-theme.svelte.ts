import { session } from "./session.svelte";

export const CUSTOM_CSS_LIMIT = 256 * 1024;
export const CUSTOM_CSS_RECOVERY = "/my/settings?tab=developer&customCss=off";

type CustomTheme = {
    css: string;
    url: string;
    enabled: boolean;
};
const empty = (): CustomTheme => ({
    css: "",
    url: "",
    enabled: false
});
const key = (id: number) => `nonerev-custom-css:${id}`;

export const customTheme = $state({
    ...empty(),
    userId: null as number | null,
    error: ""
});
export const customThemeLoad = $state({
    status: "idle" as "idle" | "loading" | "loaded" | "error",
    error: "",
    revision: 0
});
export const reloadCustomTheme = () => { customThemeLoad.revision++; };

export const validateCustomUrl = (input: string): string => {
    const value = input.trim();
    if (!value) return "";
    if (value.length > 4096) throw new Error("The stylesheet URL is too long (maximum 4096 characters).");
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error("Enter a full HTTPS stylesheet URL.");
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Use an HTTP or HTTPS stylesheet URL without a username or password.");
    }
    if (location.protocol === "https:" && url.protocol !== "https:") {
        throw new Error("Use HTTPS for your stylesheet on this site.");
    }
    return url.href;
};

export const validateCustomCss = (css: string) => {
    if (new TextEncoder().encode(css).byteLength > CUSTOM_CSS_LIMIT) {
        throw new Error("Custom CSS must be 256 KB or smaller.");
    }
};

export const loadCustomTheme = (id: number | null, recover: boolean) => {
    let value = empty();
    let error = "";
    if (id !== null) {
        try {
            const saved: unknown = JSON.parse(localStorage.getItem(key(id)) ?? "null");
            if (saved && typeof saved === "object" && "css" in saved && typeof saved.css === "string") {
                validateCustomCss(saved.css);
                value = {
                    css: saved.css,
                    url: "url" in saved && typeof saved.url === "string" ? saved.url : "",
                    enabled: "enabled" in saved && saved.enabled === true
                };
                if (!recover && value.enabled) value.url = validateCustomUrl(value.url);
            }
            if (recover) {
                value.enabled = false;
                localStorage.setItem(key(id), JSON.stringify(value));
            }
        } catch {
            value.enabled = false;
            error = "Custom CSS could not be loaded or saved in this browser. It is disabled for this visit.";
        }
    }
    Object.assign(customTheme, value, {
        userId: id,
        error
    });
};

export const saveCustomTheme = (css: string, enabled: boolean, inputUrl = "") => {
    const id = session.me?.id;
    if (!id || customTheme.userId !== id) throw new Error("Sign in before saving custom CSS.");
    validateCustomCss(css);
    // allow disabling a saved http url after moving to https
    const url = enabled ? validateCustomUrl(inputUrl) : inputUrl.trim();
    if (enabled && !css.trim() && !url) throw new Error("Enter CSS or a stylesheet URL before enabling your theme.");
    const value = {
        css,
        url,
        enabled
    };
    try {
        localStorage.setItem(key(id), JSON.stringify(value));
    } catch {
        throw new Error("Could not save custom CSS. Check that browser storage is available.");
    }
    Object.assign(customTheme, value, { error: "" });
};
