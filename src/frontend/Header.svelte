<script lang="ts">
    import { session } from "./session.svelte";
    import { router } from "./router.svelte";
    import { api } from "./api";
    import Banners from "./Banners.svelte";

    let q = $state("");
    let suggestions = $state<any[]>([]);
    let searchFocused = $state(false);
    let pending = $state(0);
    let unread = $state(0);
    let navOpen = $state(false);

    $effect(() => {
        if (!session.me) return;
        const refresh = () => {
            api("/user/friends?tab=requests").then(d => pending = d.pendingCount).catch(() => {});
            api("/notifications/count").then(d => unread = d.unread).catch(() => {});
        };
        refresh();
        window.addEventListener("notifications:refresh", refresh);
        const timer = setInterval(refresh, 30000);
        return () => { window.removeEventListener("notifications:refresh", refresh); clearInterval(timer); };
    });

    $effect(() => {
        const term = q.trim();
        if (!term) { suggestions = []; return; }
        const timer = setTimeout(() => {
            api(`/site/search/suggestions?q=${encodeURIComponent(term)}`).then(d => {
                if (q.trim() === term) suggestions = Array.isArray(d) ? d : [];
            }).catch(() => { suggestions = []; });
        }, 180);
        return () => clearTimeout(timer);
    });

    $effect(() => {
        const term = q.trim();
        if (!term) {
            suggestions = [];
            return;
        }
        const timer = setTimeout(() => {
            api(`/site/search/suggestions?q=${encodeURIComponent(term)}`).then(d => {
                if (q.trim() === term) {
                    suggestions = Array.isArray(d) ? d : [];
                }
            }).catch(() => {
                suggestions = [];
            });
        }, 180);
        return () => clearTimeout(timer);
    });

    const search = (e: Event) => {
        e.preventDefault();
        router.go("/search?q=" + encodeURIComponent(q));
    };

    const logout = async (e: Event) => {
        e.preventDefault();
        await session.logout();
        router.go("/");
    };

    const badge = (n: number) => n > 99 ? "99+" : String(n);
</script>

<div id="header" class="rbx-header" role="navigation" aria-label="Main navigation">
    <div class="container-fluid">
        <div class="rbx-navbar-header">
            {#if session.me}
                <div class="rbx-nav-collapse" onclick={() => navOpen = !navOpen} title="Menu" role="button" aria-label="Toggle navigation">
                    <span class="icon-nav-menu"></span>
                </div>
            {/if}
            <a class="rbx-brand" href="/home" title="NoneRev">
                <span class="logo"></span>
            </a>
        </div>

        <ul class="rbx-navbar rbx-navbar-desktop">
            <li><a href="/games">Games</a></li>
            <li><a href="/catalog">Catalog</a></li>
            <li><a href="/develop/">Develop</a></li>
            <li><a class="buy-robux" href="/upgrades/nonebux">NONEBUX</a></li>
            <li><a href="/download">Download</a></li>
        </ul>

        <div id="navbar-universal-search" class="rbx-navbar-search search-form" role="search">
            <form onsubmit={search} class="rbx-input-group">
                <input id="navbar-search-input" class="input-field" type="text" bind:value={q} placeholder="Search" maxlength="120" autocomplete="off" onfocus={() => searchFocused = true} onblur={() => setTimeout(() => searchFocused = false, 120)}>
                <button id="navbar-search-btn" class="rbx-input-addon-btn" type="submit" aria-label="Search">
                    <span class="icon-nav-search"></span>
                </button>
            </form>
            {#if searchFocused && suggestions.length}
                <ul class="dropdown-menu rbx-dropdown-menu show" role="menu">
                    {#each suggestions as suggestion}
                        <li><a class="dropdown-item" href={suggestion.url} onclick={() => searchFocused = false}>{suggestion.label}</a></li>
                    {/each}
                </ul>
            {/if}
        </div>

        <div class="rbx-navbar-right">
            {#if session.me}
                <ul class="rbx-navbar-icon-group">
                    <li class="dropdown">
                        <a href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" title="Settings">
                            <span class="icon-nav-settings"></span>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end rbx-dropdown-menu">
                            {#if session.me.admin > 0}
                                <li><a href="/admi/">Admin</a></li>
                            {/if}
                            <li><a href="/my/settings">Settings</a></li>
                            <li><a href="/logout" onclick={logout}>Logout</a></li>
                        </ul>
                    </li>
                    <li>
                        <a href="/my/money" title="Tix balance" aria-label={`Tix balance: ${(session.me.tix ?? 0).toLocaleString()}`}>
                            <span class="icon-nav-tix"></span>
                            <span class="rbx-text-navbar-right">{(session.me.tix ?? 0).toLocaleString()}</span>
                        </a>
                    </li>
                    <li>
                        <a href="/upgrades/nonebux" title="Nonebux">
                            <span class="icon-nav-robux"></span>
                            <span class="rbx-text-navbar-right">{session.me.currency.toLocaleString()}</span>
                        </a>
                    </li>
                    <li>
                        <a href="/my/notifications" title="Notifications" aria-label={`Notifications: ${unread} unread`}>
                            <span class="icon-nav-message"></span>
                            {#if unread > 0}<span class="rbx-topbar-badge">{badge(unread)}</span>{/if}
                        </a>
                    </li>
                </ul>
            {:else}
                <ul class="rbx-navbar-right-nav">
                    <li><a class="rbx-navbar-login" href="/login">Log In</a></li>
                    <li><a class="rbx-navbar-signup" href="/signup">Sign Up</a></li>
                </ul>
            {/if}
        </div>

        <ul class="rbx-navbar rbx-navbar-mobile">
            <li><a href="/games">Games</a></li>
            <li><a href="/catalog">Catalog</a></li>
            <li><a href="/develop/">Develop</a></li>
            <li><a class="buy-robux" href="/upgrades/nonebux">NONEBUX</a></li>
        </ul>
    </div>
</div>

{#if session.me}
    <div id="navigation" class="rbx-left-col" class:nav-show={navOpen}>
        <ul>
            <li class="rbx-nav-username">
                <a href="/user?id={session.me.id}" title={session.me.username}>{session.me.username}</a>
            </li>
            <li class="rbx-divider"></li>
            <li><a href="/home"><span class="icon-nav-home"></span><span class="rbx-text-nav">Home</span></a></li>
            <li><a href="/user?id={session.me.id}"><span class="icon-nav-profile"></span><span class="rbx-text-nav">Profile</span></a></li>
            <li><a class="rbx-nav-badged" href="/my/messages"><span class="icon-nav-message"></span><span class="rbx-text-nav">Messages</span></a></li>
            <li><a class="rbx-nav-badged" href="/my/friends"><span class="icon-nav-friends"></span><span class="rbx-text-nav">Friends</span>{#if pending > 0}<span class="rbx-nav-badge">{badge(pending)}</span>{/if}</a></li>
            <li><a href="/my/avatar"><span class="icon-nav-charactercustomizer"></span><span class="rbx-text-nav">Avatar</span></a></li>
            <li><a href="/my/inventory"><span class="icon-nav-inventory"></span><span class="rbx-text-nav">Inventory</span></a></li>
            <li><a href="/trade"><span class="icon-nav-trade"></span><span class="rbx-text-nav">Trade</span></a></li>
            <li><a href="/my/groups"><span class="icon-nav-group"></span><span class="rbx-text-nav">Groups</span></a></li>
            <li><a href="/my/forums"><span class="icon-nav-forum"></span><span class="rbx-text-nav">Forum</span></a></li>
            <li><a href="/blog"><span class="icon-nav-blog"></span><span class="rbx-text-nav">Blog</span></a></li>
            <li><a href="/catalog"><span class="icon-nav-shop"></span><span class="rbx-text-nav">Shop</span></a></li>
            <li class="rbx-upgrade-now"><a href="/premium/membership">Upgrade Now</a></li>
            <li class="rbx-sidebar-events">
                <span class="rbx-sidebar-events-title">Events</span>
                <a href="/blog?category=events" title="NONE BETA events">
                    <img src="/img/none-beta.png" alt="NONE BETA">
                </a>
            </li>
        </ul>
    </div>
{/if}

<Banners />
