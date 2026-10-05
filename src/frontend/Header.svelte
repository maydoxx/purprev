<script lang="ts">
    import { session } from "./session.svelte";
    import { router } from "./router.svelte";
    import { api } from "./api";

    const targets = [
        ["People", "user"],
        ["Games", "games"],
        ["Catalog", "catalog"],
        ["Groups", "groups"],
        ["Library", "library"]
    ];

    let q = $state("");
    let suggestions = $state<any[]>([]);
    let searchFocused = $state(false);
    let selected = $state(0);
    let pending = $state(0);
    let messages = $state(0);
    let unread = $state(0);
    let navOpen = $state(false);
    let settingsOpen = $state(false);
    let searchShown = $state(false);

    const query = $derived(q.trim());
    const searchUrls = $derived(query ? targets.map(([, type]) => `/search?q=${encodeURIComponent(query)}&type=${type}`) : []);
    const extra = $derived(suggestions.filter(s => !searchUrls.includes(s.url)));
    const urls = $derived([...searchUrls, ...extra.map(s => String(s.url))]);
    const active = $derived(selected < urls.length ? selected : 0);

    $effect(() => {
        if (!session.me) return;
        const refresh = () => {
            api("/user/friends?tab=requests").then(d => {
                pending = d.pendingCount;
            }).catch(() => {});
            api("/messages/unread").then(d => {
                messages = d.unread;
            }).catch(() => {});
            api("/notifications/count").then(d => {
                unread = d.unread;
            }).catch(() => {});
        };
        refresh();
        window.addEventListener("notifications:refresh", refresh);
        const timer = setInterval(refresh, 30000);
        return () => {
            window.removeEventListener("notifications:refresh", refresh);
            clearInterval(timer);
        };
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

    $effect(() => {
        router.path;
        navOpen = false;
        settingsOpen = false;
        searchShown = false;
    });

    const go = (url: string) => {
        searchFocused = false;
        router.go(url);
    };

    const search = (e: Event) => {
        e.preventDefault();
        if (urls.length) {
            go(urls[active]!);
        }
    };

    const typed = () => {
        if (selected >= targets.length) {
            selected = 0;
        }
        searchFocused = true;
    };

    const keys = (e: KeyboardEvent) => {
        if (!searchFocused || !urls.length) return;
        if (e.key === "ArrowDown" || e.key === "Tab") {
            e.preventDefault();
            selected = (active + 1) % urls.length;
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selected = (active + urls.length - 1) % urls.length;
        } else if (e.key === "Escape") {
            searchFocused = false;
        }
    };

    const pick = (e: MouseEvent, url: string) => {
        e.preventDefault();
        go(url);
    };

    const toggleSettings = (e: MouseEvent) => {
        e.preventDefault();
        settingsOpen = !settingsOpen;
    };

    const closeSettings = (e: MouseEvent) => {
        if (settingsOpen && !(e.target as HTMLElement).closest(".header-settings")) {
            settingsOpen = false;
        }
    };

    const logout = async (e: Event) => {
        e.preventDefault();
        await session.logout();
        router.go("/");
    };

    const badge = (n: number) => n < 99 ? String(n) : "99+";

    const bigBadge = (n: number) => n < 1000 ? String(n) : "1k+";
</script>

<svelte:window onclick={closeSettings} />

<div class="site-header" role="navigation" aria-label="Main navigation">
    <div class="site-header-inner">
        <div class="header-brand">
            {#if session.me}
                <button type="button" class="nav-toggle" title="Menu" aria-label="Toggle navigation" aria-expanded={navOpen} onclick={() => navOpen = !navOpen}>
                    <span class="icon-nav-menu"></span>
                    {#if messages + pending > 0}
                        <span class="nav-toggle-count" title={String(messages + pending)}>{badge(messages + pending)}</span>
                    {/if}
                </button>
            {:else}
                <div class="nav-toggle"></div>
            {/if}
            <a class="header-logo" href={session.me ? "/home" : "/"} title="NoneRev">
                <span></span>
            </a>
        </div>

        <ul class="header-links">
            <li><a href="/games">Games</a></li>
            <li><a href="/catalog">Catalog</a></li>
            <li><a href="/develop/">Develop</a></li>
            <li><a href="/upgrades/nonebux">NONEBUX</a></li>
            <li><a href="/download">Download</a></li>
        </ul>

        <div class="header-search" class:shown={searchShown} role="search">
            <form class="header-search-group" onsubmit={search}>
                <input class="header-search-input" type="text" bind:value={q} placeholder="Search" maxlength="120" autocomplete="off" oninput={typed} onfocus={() => searchFocused = true} onblur={() => searchFocused = false} onkeydown={keys}>
                <button class="header-search-button" type="submit" aria-label="Search">
                    <span class="icon-nav-search"></span>
                </button>
            </form>
            {#if searchFocused && urls.length}
                <ul class="header-search-menu" role="menu">
                    {#each targets as [label], i}
                        <li class="header-search-option" class:selected={i === active}>
                            <a href={urls[i]} onmouseenter={() => selected = i} onmousedown={e => e.preventDefault()} onclick={e => pick(e, urls[i]!)}>Search <span class="header-search-term">"{query}"</span> in {label}</a>
                        </li>
                    {/each}
                    {#each extra as suggestion, i}
                        <li class="header-search-option" class:selected={targets.length + i === active}>
                            <a href={suggestion.url} onmouseenter={() => selected = targets.length + i} onmousedown={e => e.preventDefault()} onclick={e => pick(e, suggestion.url)}>{suggestion.label}</a>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>

        <div class="header-right">
            {#if session.me}
                <ul class="header-icons">
                    <li class="header-settings">
                        <a class="header-icon-item" href="/my/settings" role="button" title="Settings" aria-expanded={settingsOpen} onclick={toggleSettings}>
                            <span class="icon-nav-settings"></span>
                        </a>
                        {#if settingsOpen}
                            <div class="header-popover-arrow"></div>
                            <div class="header-popover">
                                <ul class="header-menu" role="menu">
                                    {#if session.me.admin > 0}
                                        <li><a href="/admi/">Admin</a></li>
                                    {/if}
                                    <li><a href="/my/settings">Settings</a></li>
                                    <li><a href="/logout" onclick={logout}>Logout</a></li>
                                </ul>
                            </div>
                        {/if}
                    </li>
                    <li>
                        <a class="header-icon-item" href="/my/money" title="Tix balance" aria-label={`Tix balance: ${(session.me.tix ?? 0).toLocaleString()}`}>
                            <span class="icon-nav-tix"></span>
                            <span class="header-amount">{(session.me.tix ?? 0).toLocaleString()}</span>
                        </a>
                    </li>
                    <li>
                        <a class="header-icon-item" href="/upgrades/nonebux" title="Nonebux">
                            <span class="icon-nav-robux"></span>
                            <span class="header-amount">{session.me.currency.toLocaleString()}</span>
                        </a>
                    </li>
                    <li>
                        <a class="header-icon-item" href="/my/notifications" title="Notifications" aria-label={`Notifications: ${unread} unread`}>
                            <span class="icon-nav-message"></span>
                            {#if unread > 0}
                                <span class="header-icon-count">{badge(unread)}</span>
                            {/if}
                        </a>
                    </li>
                    <li class="header-search-toggle">
                        <button type="button" class="header-icon-item" aria-label="Search" onclick={() => searchShown = !searchShown}>
                            <span class="icon-nav-search-white"></span>
                        </button>
                    </li>
                </ul>
            {:else}
                <ul class="header-account-links">
                    <li><a href="/login">Log In</a></li>
                    <li><a href="/signup">Sign Up</a></li>
                    <li class="header-search-toggle">
                        <button type="button" aria-label="Search" onclick={() => searchShown = !searchShown}>
                            <span class="icon-nav-search-white"></span>
                        </button>
                    </li>
                </ul>
            {/if}
        </div>

        <ul class="header-links header-links-row">
            <li><a href="/games">Games</a></li>
            <li><a href="/catalog">Catalog</a></li>
            <li><a href="/develop/">Develop</a></li>
            <li><a href="/upgrades/nonebux">NONEBUX</a></li>
            <li><a href="/download">Download</a></li>
        </ul>
    </div>
</div>

{#if session.me}
    <div class="left-nav" class:open={navOpen}>
        <ul>
            <li class="left-nav-user">
                <a href="/user?id={session.me.id}" title={session.me.username}>{session.me.username}</a>
            </li>
            <li class="left-nav-divider"></li>
        </ul>
        <div class="left-nav-scroll">
            <ul>
                <li><a class="left-nav-link" href="/home"><span class="icon-nav-home"></span><span class="left-nav-label">Home</span></a></li>
                <li><a class="left-nav-link" href="/user?id={session.me.id}"><span class="icon-nav-profile"></span><span class="left-nav-label">Profile</span></a></li>
                <li>
                    <a class="left-nav-link" href="/my/messages"><span class="icon-nav-message"></span><span class="left-nav-label">Messages</span>{#if messages > 0}<span class="left-nav-count" title={String(messages)}>{bigBadge(messages)}</span>{/if}</a>
                </li>
                <li>
                    <a class="left-nav-link" href="/my/friends"><span class="icon-nav-friends"></span><span class="left-nav-label">Friends</span>{#if pending > 0}<span class="left-nav-count" title={String(pending)}>{badge(pending)}</span>{/if}</a>
                </li>
                <li><a class="left-nav-link" href="/my/avatar"><span class="icon-nav-charactercustomizer"></span><span class="left-nav-label">Avatar</span></a></li>
                <li><a class="left-nav-link" href="/my/inventory"><span class="icon-nav-inventory"></span><span class="left-nav-label">Inventory</span></a></li>
                <li><a class="left-nav-link" href="/trade"><span class="icon-nav-trade"></span><span class="left-nav-label">Trade</span></a></li>
                <li><a class="left-nav-link" href="/my/groups"><span class="icon-nav-group"></span><span class="left-nav-label">Groups</span></a></li>
                <li><a class="left-nav-link" href="/my/forums"><span class="icon-nav-forum"></span><span class="left-nav-label">Forum</span></a></li>
                <li><a class="left-nav-link" href="/blog"><span class="icon-nav-blog"></span><span class="left-nav-label">Blog</span></a></li>
                <li class="left-nav-upgrade"><a href="/premium/membership">Upgrade Now</a></li>
                <li class="left-nav-events">Events</li>
                <li class="left-nav-sponsor">
                    <a href="/blog?category=events" title="NONE BETA events">
                        <img src="/img/none-beta.png" alt="NONE BETA">
                    </a>
                </li>
            </ul>
        </div>
    </div>
{/if}
