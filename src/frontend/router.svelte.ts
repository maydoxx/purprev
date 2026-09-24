const routes: [string, string][] = [
    ["/", "landing"],
    ["/login", "login"],
    ["/signup", "signup"],
    ["/home", "home"],
    ["/user", "user"],
    ["/my/settings", "settings"],
    ["/my/friends", "friends"],
    ["/my/avatar", "avatar"],
    ["/my/inventory", "inventory"],
    ["/not-approved", "not-approved"],
    ["/games", "games"],
    ["/game", "game"],
    ["/catalog", "catalog"],
    ["/catalog/item", "catalog-item"],
    ["/blog", "blog"],
    ["/search", "search"],
    ["/download", "download"],
    ["/trade", "trade"],
    ["/my/messages", "messages"],
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
    ["/admi/blog", "admin-blog"]
];

const parse = () => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
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

// same site links go through pushState instead of reloading
document.addEventListener("click", e => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute("download") || a.origin !== location.origin) return;

    const href = a.getAttribute("href") ?? "";
    if (href === "" || href.startsWith("#") || href.startsWith("/api/") || href.startsWith("/uploads/")) return;

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
