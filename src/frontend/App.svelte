<script lang="ts">
    import type { Component } from "svelte";
    import { session } from "./session.svelte";
    import { router } from "./router.svelte";
    import { api } from "./api";

    import Header from "./Header.svelte";
    import Banners from "./Banners.svelte";
    import Landing from "./pages/Landing.svelte";
    import Login from "./pages/Login.svelte";
    import Signup from "./pages/Signup.svelte";
    import Apply from "./pages/Apply.svelte";
    import Home from "./pages/Home.svelte";
    import Profile from "./pages/Profile.svelte";
    import Settings from "./pages/Settings.svelte";
    import Friends from "./pages/Friends.svelte";
    import Avatar from "./pages/Avatar.svelte";
    import Inventory from "./pages/Inventory.svelte";
    import NotApproved from "./pages/NotApproved.svelte";
    import NotFound from "./pages/NotFound.svelte";
    import Games from "./pages/Games.svelte";
    import Game from "./pages/Game.svelte";
    import Catalog from "./pages/Catalog.svelte";
    import CatalogItem from "./pages/CatalogItem.svelte";
    import Blog from "./pages/Blog.svelte";
    import Search from "./pages/Search.svelte";
    import Download from "./pages/Download.svelte";
    import Nonebux from "./pages/Nonebux.svelte";
    import Membership from "./pages/Membership.svelte";
    import Badges from "./pages/Badges.svelte";
    import Favorites from "./pages/Favorites.svelte";
    import MembershipCheckout from "./pages/MembershipCheckout.svelte";
    import Trade from "./pages/Trade.svelte";
    import Messages from "./pages/Messages.svelte";
    import Notifications from "./pages/Notifications.svelte";
    import Money from "./pages/Money.svelte";
    import Groups from "./pages/groups/Groups.svelte";
    import GroupsMy from "./pages/groups/My.svelte";
    import ForumIndex from "./pages/forum/Index.svelte";
    import ForumShow from "./pages/forum/Forum.svelte";
    import ForumThread from "./pages/forum/Thread.svelte";
    import ForumNew from "./pages/forum/New.svelte";
    import ForumReply from "./pages/forum/Reply.svelte";
    import ForumSearch from "./pages/forum/Search.svelte";
    import ForumModerate from "./pages/forum/Moderate.svelte";
    import ForumMy from "./pages/forum/My.svelte";
    import DevelopIndex from "./pages/develop/Index.svelte";
    import DevelopPlaces from "./pages/develop/Places.svelte";
    import DevelopCreate from "./pages/develop/Create.svelte";
    import DevelopConfigure from "./pages/develop/Configure.svelte";
    import DevelopClothing from "./pages/develop/Clothing.svelte";
    import DevelopAudio from "./pages/develop/Audio.svelte";
    import DevelopBadges from "./pages/develop/Badges.svelte";
    import DevelopGamePasses from "./pages/develop/GamePasses.svelte";
    import AdminIndex from "./pages/admin/Index.svelte";
    import AdminUsers from "./pages/admin/Users.svelte";
    import AdminCatalog from "./pages/admin/Catalog.svelte";
    import AdminModeration from "./pages/admin/Moderation.svelte";
    import AdminViewModeration from "./pages/admin/ViewModeration.svelte";
    import AdminInviteKeys from "./pages/admin/InviteKeys.svelte";
    import AdminBanners from "./pages/admin/Banners.svelte";
    import AdminBlog from "./pages/admin/Blog.svelte";
    import AdminGames from "./pages/admin/Games.svelte";
    import AdminSettings from "./pages/admin/Settings.svelte";
    import AdminApplications from "./pages/admin/Applications.svelte";

    session.refresh();

    const pages: Record<string, Component<any>> = {
        landing: Landing,
        login: Login,
        signup: Signup,
        apply: Apply,
        home: Home,
        user: Profile,
        settings: Settings,
        friends: Friends,
        avatar: Avatar,
        inventory: Inventory,
        "not-approved": NotApproved,
        games: Games,
        game: Game,
        catalog: Catalog,
        "catalog-item": CatalogItem,
        blog: Blog,
        search: Search,
        download: Download,
        nonebux: Nonebux,
        membership: Membership,
        badges: Badges,
        favorites: Favorites,
        "membership-checkout": MembershipCheckout,
        trade: Trade,
        messages: Messages,
        notifications: Notifications,
        money: Money,
        groups: Groups,
        "groups-my": GroupsMy,
        forum: ForumIndex,
        "forum-show": ForumShow,
        "forum-thread": ForumThread,
        "forum-new": ForumNew,
        "forum-reply": ForumReply,
        "forum-search": ForumSearch,
        "forum-moderate": ForumModerate,
        "forum-my": ForumMy,
        develop: DevelopIndex,
        "develop-places": DevelopPlaces,
        "develop-create": DevelopCreate,
        "develop-configure": DevelopConfigure,
        "develop-clothing": DevelopClothing,
        "develop-audio": DevelopAudio,
        "develop-badges": DevelopBadges,
        "develop-game-passes": DevelopGamePasses,
        admin: AdminIndex,
        "admin-users": AdminUsers,
        "admin-catalog": AdminCatalog,
        "admin-moderation": AdminModeration,
        "admin-viewmoderation": AdminViewModeration,
        "admin-invitekeys": AdminInviteKeys,
        "admin-banners": AdminBanners,
        "admin-blog": AdminBlog,
        "admin-games": AdminGames,
        "admin-settings": AdminSettings,
        "admin-applications": AdminApplications,
    };

    const landing = ["landing", "login", "signup", "apply"];
    const bare = ["blog", "download"];

    const needsLogin = [
        "membership-checkout",
        "home",
        "settings",
        "friends",
        "avatar",
        "inventory",
        "trade",
        "messages",
        "notifications",
        "money",
        "groups-my",
        "forum-new",
        "forum-reply",
        "forum-my",
        "forum-moderate",
        "develop",
        "develop-places",
        "develop-create",
        "develop-configure",
        "develop-clothing",
        "develop-audio",
        "develop-badges",
        "develop-game-passes",
        "admin",
        "admin-users",
        "admin-catalog",
        "admin-moderation",
        "admin-viewmoderation",
        "admin-invitekeys",
        "admin-banners",
        "admin-blog",
        "admin-games",
        "admin-settings",
        "admin-applications",
    ];

    const Page = $derived(pages[router.name] ?? NotFound);

    const inApp = /ROBLOX (Android|iOS) App/i.test(navigator.userAgent);

    $effect(() => {
        if (!session.loaded) return;

        if (session.me && landing.includes(router.name)) {
            router.replace("/home");
        } else if (!session.me && needsLogin.includes(router.name)) {
            router.replace("/login");
        } else if (
            session.me?.ongoing_action_id &&
            router.name !== "not-approved"
        ) {
            router.replace("/not-approved");
        }
    });

    $effect(() => {
        document.body.className = inApp
            ? "rbx-in-app"
            : landing.includes(router.name)
              ? "none-landing"
              : router.name === "blog"
                ? "none-blog"
                : router.name === "download"
                  ? "none-download-page"
              : session.me && !bare.includes(router.name)
                ? "rbx-has-left-nav"
                : "";
    });

    $effect(() => {
        if (!session.me) return;
        const timer = setInterval(
            () => api("/user/presence/register", {}).catch(() => {}),
            60 * 1000,
        );
        return () => clearInterval(timer);
    });
</script>

{#if session.loaded}
    {#if inApp}
        <Banners />
        <Page />
    {:else if landing.includes(router.name) || bare.includes(router.name)}
        <Page />
    {:else}
        <Header />
        <Page />
    {/if}
{/if}
