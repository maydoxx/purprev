import { session } from "./session.svelte";
import { isTheme, resolve, type Theme } from "./themes";
import { router } from "./router.svelte";
import { customTheme, customThemeLoad, loadCustomTheme } from "./custom-theme.svelte";

const KEY = "nonerev-theme";
export const themePreview = $state({ name: null as Theme | null });

// literal paths so the build can hash them
const themeStylesheets = {
    dark: "/css/themes/dark.css",
    halloween: "/css/themes/halloween.css",
    sakura: "/css/themes/sakura.css"
};

let themeOrderObserver: MutationObserver | null = null;

// page css loads during navigation, theme and custom css have to stay after it
const orderThemeStyles = () => {
    const styles = ["site-theme", "site-custom-theme-url", "site-custom-theme"].map(id => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const tail = [...document.head.children].slice(-styles.length);
    if (styles.some((el, i) => tail[i] !== el)) document.head.append(...styles);
};

const observeThemeOrder = () => {
    if (themeOrderObserver) return;
    themeOrderObserver = new MutationObserver(orderThemeStyles);
    themeOrderObserver.observe(document.head, { childList: true });
};

const themeColors: Record<Theme, string> = {
    auto: "#7B2CBF",
    classic: "#7B2CBF",
    dark: "#17171c",
    halloween: "#1f1611",
    sakura: "#5b2a42"
};

const saved = () => {
    try {
        const name = localStorage.getItem(KEY);
        return isTheme(name) ? name : null;
    } catch {
        return null;
    }
};

export const preferredTheme = (): Theme => {
    // read before the ?? so the effect below always tracks it
    const account = session.me?.theme;
    return saved() ?? account ?? "auto";
};

export const applyTheme = (theme: Theme) => {
    const name = resolve(theme, new Date());
    document.documentElement.dataset.siteTheme = name;
    document.documentElement.dataset.bsTheme = name === "dark" ? "dark" : "light";

    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", themeColors[name]);

    let link = document.getElementById("site-theme");
    if (name === "classic") {
        link?.remove();
        orderThemeStyles();
        return;
    }
    if (!link) {
        link = document.createElement("link");
        link.id = "site-theme";
        link.setAttribute("rel", "stylesheet");
    }
    const href = themeStylesheets[name];
    if (link.getAttribute("href") !== href) {
        link.setAttribute("href", href);
    }
    document.head.append(link);
    observeThemeOrder();
    orderThemeStyles();
};

export const setTheme = (theme: Theme) => {
    try {
        localStorage.setItem(KEY, theme);
    } catch {}
    applyTheme(theme);
};

export const followTheme = () => {
    applyTheme(preferredTheme());
    $effect.root(() => {
        $effect(() => {
            applyTheme(themePreview.name ?? preferredTheme());
        });
        $effect(() => {
            loadCustomTheme(session.me?.id ?? null, router.query.customCss === "off");
        });
        $effect(() => {
            const enabled = customTheme.enabled && customTheme.userId === session.me?.id && router.query.customCss !== "off";
            const url = customTheme.url;
            customThemeLoad.revision;
            customThemeLoad.status = "idle";
            customThemeLoad.error = "";
            if (!enabled || !url) return;

            const link = document.createElement("link");
            link.id = "site-custom-theme-url";
            link.rel = "stylesheet";
            link.referrerPolicy = "no-referrer";
            link.href = url;
            let disposed = false;
            const fail = () => {
                if (disposed) return;
                disposed = true;
                clearTimeout(timer);
                link.remove();
                customThemeLoad.status = "error";
                customThemeLoad.error = "The stylesheet could not be loaded. Check the URL and that the host serves public CSS as text/css, then retry. Editor CSS still applies.";
            };
            const timer = setTimeout(fail, 15000);
            link.onload = () => {
                if (disposed) return;
                clearTimeout(timer);
                customThemeLoad.status = "loaded";
            };
            link.onerror = fail;
            customThemeLoad.status = "loading";
            document.head.append(link);
            observeThemeOrder();
            orderThemeStyles();
            return () => {
                disposed = true;
                clearTimeout(timer);
                link.onload = null;
                link.onerror = null;
                link.remove();
            };
        });
        $effect(() => {
            const enabled = customTheme.enabled && customTheme.userId === session.me?.id && router.query.customCss !== "off";
            document.documentElement.toggleAttribute("data-custom-theme", enabled);
            let style = document.getElementById("site-custom-theme");
            if (!enabled) {
                style?.remove();
                return;
            }
            if (!style) {
                style = document.createElement("style");
                style.id = "site-custom-theme";
            }
            // textContent, so a pasted </style> cant add markup
            style.textContent = customTheme.css;
            document.head.append(style);
            observeThemeOrder();
            orderThemeStyles();
        });
    });
};
