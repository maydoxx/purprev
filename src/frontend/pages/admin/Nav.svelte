<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";

    const groups: [string, [string, string, string[]][]][] = [
        ["", [
            ["/admi", "Dashboard", ["/admi"]]
        ]],
        ["People", [
            ["/admi/users", "Users", ["/admi/users"]],
            ["/admi/moderation", "Moderation", ["/admi/moderation", "/admi/viewmoderation"]],
            ["/admi/invitekeys", "Invite Keys", ["/admi/invitekeys"]],
            ["/admi/applications", "Applications", ["/admi/applications"]]
        ]],
        ["Content", [
            ["/admi/games", "Games", ["/admi/games"]],
            ["/admi/catalog", "Catalog", ["/admi/catalog"]],
            ["/admi/blog", "Blog", ["/admi/blog"]],
            ["/admi/banners", "Banners", ["/admi/banners"]]
        ]],
        ["System", [
            ["/admi/settings", "Settings", ["/admi/settings"]]
        ]]
    ];

    let stats = $state<any>(null);
    api("/admin/stats").then(d => stats = d).catch(() => {});

    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
</script>

<aside class="admin-side">
    <a class="admin-brand" href="/admi">Admin</a>

    <nav class="admin-nav" aria-label="Admin navigation">
        {#each groups as [section, links]}
            {#if section}<div class="admin-nav-section">{section}</div>{/if}
            {#each links as [href, label, match]}
                <a class="admin-nav-link" class:active={match.includes(router.path)} {href}>
                    <span>{label}</span>
                    {#if href === "/admi/moderation" && stats?.moderation > 0}
                        <span class="admin-nav-count danger">{stats.moderation}</span>
                    {:else if href === "/admi/applications" && stats?.applications > 0}
                        <span class="admin-nav-count">{stats.applications}</span>
                    {:else if href === "/admi" && stats?.servers > 0}
                        <span class="admin-nav-count">{stats.servers}</span>
                    {/if}
                </a>
            {/each}
        {/each}
    </nav>

    <div class="admin-side-foot">
        <div class="admin-rcc" class:up={stats?.rcc === "up"} class:down={stats && stats.rcc !== "up"}>
            <span class="dot"></span>
            {stats ? stats.rcc === "up" ? `RCC up, ${stats.servers} server${stats.servers === 1 ? "" : "s"}` : `RCC ${stats.rcc}` : "checking RCC…"}
        </div>
        {#if session.me}
            <a class="admin-me" href="/user?id={session.me.id}">
                <img src={pic(session.me.id)} alt="">
                <span>{session.me.username}</span>
            </a>
        {/if}
        <a class="admin-back" href="/home">Back to site</a>
    </div>
</aside>
