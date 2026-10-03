const routes: [string, string][] = [
    ["/", "landing"],
    ["/login", "login"],
    ["/signup", "signup"],
    ["/register", "signup"],
    ["/apply", "apply"],
    ["/home", "home"],
    ["/user", "user"],
    ["/my/settings", "settings"],
    ["/my/friends", "friends"],
    ["/my/avatar", "avatar"],
    ["/my/inventory", "inventory"],
    ["/not-approved", "not-approved"],
    ["/info/tos", "tos"],
    ["/games", "games"],
    ["/game", "game"],
    ["/catalog", "catalog"],
    ["/catalog/item", "catalog-item"],
    ["/blog", "blog"],
    ["/search", "search"],
    ["/download", "download"],
    ["/upgrades/nonebux", "nonebux"],
    ["/premium/membership", "membership"],
    ["/badges", "badges"],
    ["/favorites", "favorites"],
    ["/upgrades/paymentmethods", "membership-checkout"],
    ["/trade", "trade"],
    ["/my/messages", "messages"],
    ["/my/notifications", "notifications"],
    ["/my/money", "money"],
    ["/groups", "groups"],
    ["/my/groups", "groups-my"],
    ["/forum", "forum"],
    ["/forum/show", "forum-show"],
    ["/forum/thread", "forum-thread"],
    ["/forum/new", "forum-new"],
    ["/forum/reply", "forum-reply"],
    ["/forum/search", "forum-search"],
    ["/forum/moderate", "forum-moderate"],
    ["/my/forums", "forum-my"],
    ["/develop", "develop"],
    ["/develop/places", "develop-places"],
    ["/develop/create", "develop-create"],
    ["/develop/configure", "develop-configure"],
    ["/develop/shirts", "develop-clothing"],
    ["/develop/pants", "develop-clothing"],
    ["/develop/t-shirts", "develop-clothing"],
    ["/develop/audio", "develop-audio"],
    ["/develop/badges", "develop-badges"],
    ["/develop/game-passes", "develop-game-passes"],
    ["/admi", "admin"],
    ["/admi/users", "admin-users"],
    ["/admi/catalog", "admin-catalog"],
    ["/admi/moderation", "admin-moderation"],
    ["/admi/viewmoderation", "admin-viewmoderation"],
    ["/admi/invitekeys", "admin-invitekeys"],
    ["/admi/banners", "admin-banners"],
    ["/admi/blog", "admin-blog"],
    ["/admi/games", "admin-games"],
    ["/admi/settings", "admin-settings"],
    ["/admi/applications", "admin-applications"],
    ["/info/privacy", "privacy"],
    ["/redeem", "redeem"],
    ["/my/sets", "sets"],
    ["/admi/gamecards", "admin-gamecards"],
    ["/abusereport", "abusereport"],
    ["/admi/reports", "admin-reports"],
    ["/groups/search", "groups-search"]
];

const parse = () => {
    const path = (location.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    const query: Record<string, string> = {};
    new URLSearchParams(location.search).forEach((v, k) => {
        query[k] = v;
    });

    const hit = routes.find(([p]) => p === path);
    return {
        name: hit ? hit[1] : "404",
        path,
        query
    };
};

let current = $state(parse());

const update = () => {
    current = parse();
    window.scrollTo(0, 0);
};

window.addEventListener("popstate", update);


document.addEventListener("click", e => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute("download") || a.origin !== location.origin) return;

    const href = a.getAttribute("href") ?? "";
    if (href === "" || href.startsWith("#") || href.startsWith("/api/") || href.startsWith("/uploads/")) return;

    const target = (a.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    if (!routes.some(([p]) => p === target)) return;

    e.preventDefault();
    router.go(href);
});

export const router = {
    get name() {
        return current.name;
    },
    get path() {
        return current.path;
    },
    get query() {
        return current.query;
    },
    go(path: string) {
        if (path === location.pathname + location.search) return;
        history.pushState(null, "", path);
        update();
    },
    replace(path: string) {
        history.replaceState(null, "", path);
        update();
    }
};
