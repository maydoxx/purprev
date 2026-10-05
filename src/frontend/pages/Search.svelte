<script lang="ts">
    import GameCard from "../GameCard.svelte";
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const categories: [string, string][] = [["games", "Games"], ["user", "People"], ["groups", "Groups"], ["catalog", "Catalog"], ["library", "Library"]];
    const q = $derived((router.query.q ?? "").trim());
    const type = $derived(router.query.type === "users" ? "user" : categories.some(([key]) => key === router.query.type) ? router.query.type : "games");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    let term = $state("");
    let results = $state<any[]>([]);
    let shown = $state(1);
    let totalPages = $state(1);
    let loaded = $state(false);
    let loading = $state(false);
    let pressed = $state(false);
    let error = $state("");
    let bottom = $state(false);
    let sent = $state<Record<number, boolean>>({});

    $effect(() => {
        term = q;
    });

    $effect(() => {
        if (type === "groups") {
            router.replace(`/groups/search?q=${encodeURIComponent(q)}`);
        } else if (type === "catalog") {
            router.replace(`/catalog?q=${encodeURIComponent(q)}`);
        }
    });

    const load = (p: number) => {
        const current = `${q}:${type}:${page}`;
        loading = true;
        error = "";
        api(`/site/search?q=${encodeURIComponent(q)}&type=${type}&page=${p}`).then(d => {
            if (`${q}:${type}:${page}` !== current) {
                return;
            }
            const rows = Array.isArray(d?.results) ? d.results : [];
            results = type === "games" && p > 1 ? [...results, ...rows] : rows;
            shown = p;
            totalPages = Math.max(1, Number(d?.totalPages) || 1);
        }).catch(err => {
            if (`${q}:${type}:${page}` !== current) {
                return;
            }
            error = err.message;
        }).finally(() => {
            if (`${q}:${type}:${page}` === current) {
                loading = false;
                pressed = false;
                loaded = true;
            }
        });
    };

    $effect(() => {
        if (type === "groups" || type === "catalog") {
            return;
        }
        loaded = false;
        results = [];
        shown = 1;
        totalPages = 1;
        if (type === "user" && !q) {
            loading = false;
            pressed = false;
            error = "";
            loaded = true;
            return;
        }
        load(type === "games" ? 1 : page);
    });

    $effect(() => {
        if (type === "games" && bottom && loaded && !loading && shown < totalPages) {
            load(shown + 1);
        }
    });

    const watch = (el: HTMLElement) => {
        const seen = new IntersectionObserver(entries => {
            bottom = entries[0].isIntersecting;
        }, {
            rootMargin: "200px"
        });
        seen.observe(el);
        return {
            destroy() {
                seen.disconnect();
                bottom = false;
            }
        };
    };

    const focus = (el: HTMLInputElement) => {
        el.focus();
    };

    const search = (e: Event) => {
        e.preventDefault();
        const next = term.trim();
        // same keyword on page 1 doesn't reload, the gif would stick
        pressed = next !== q || page !== 1;
        router.go(`/search?q=${encodeURIComponent(next)}&type=${type}`);
    };

    const request = async (userId: number) => {
        try {
            await api("/user/friends", {
                action: "request",
                userId
            });
            sent[userId] = true;
        } catch (err: any) {
            error = err.message;
        }
    };

    const url = (p: number, category = type) => `/search?q=${encodeURIComponent(q)}&type=${category}&page=${p}`;
    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const linkify = (text: string) => (text ?? "").split(/(https?:\/\/[^\s<]+)/g);
    const playing = (user: any) => user.presence?.type === "game";
    const live = (user: any) => user.online || playing(user);
    const status = (user: any) => playing(user) ? "In Game" : user.online ? "Website" : "Offline";

    const lastSeen = (time: number) => {
        const d = new Date(time * 1000);
        const hour = d.getHours() % 12 || 12;
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${hour}:${minutes} ${d.getHours() < 12 ? "AM" : "PM"}`;
    };
</script>

<svelte:head>
    <title>{type === "games" ? "Games - NoneRev" : type === "user" ? "NoneRev" : "Search - NoneRev"}</title>
    {#if type === "games"}
        <link rel="stylesheet" href="/css/games.css">
    {/if}
    <link rel="stylesheet" href="/css/search.css">
</svelte:head>

{#if type === "games"}
    <main class="search-games">
        <div class="search-games-results" class:pending={loading}>
            <div class="search-games-header">
                <h3>Results for <span class="search-games-query">{q}</span></h3>
            </div>
            <div class="search-games-list">
                {#if loaded && results.length === 0}
                    <strong>{error || "No Search Results Found"}</strong>
                {/if}
                <ul class="search-games-cards">
                    {#each results as game (game.id)}
                        <GameCard {game} />
                    {/each}
                </ul>
                <div class="search-games-more" use:watch></div>
            </div>
        </div>
    </main>
{:else if type === "user"}
    <main class="search-people">
        <div class="search-people-body">
            <div class="search-people-container">
                <form class="search-people-bar" onsubmit={search}>
                    <label class="search-people-label" for="search-people-keyword">Search:</label>
                    <input type="text" id="search-people-keyword" class="search-people-input" name="name" bind:value={term} maxlength="120" autocomplete="off" placeholder="Search for users..." use:focus>
                    <span class="search-people-submit">
                        <button type="submit" class="search-people-button">Search Users</button>
                        {#if pressed && loading}
                            <img src="/img/catalog/ProgressIndicator4.gif" alt="">
                        {/if}
                    </span>
                </form>
                <div class="search-people-results">
                    {#if error}
                        <div class="search-people-error">{error}</div>
                    {:else if loaded && results.length === 0}
                        <div>No results were found.</div>
                    {/if}
                    {#if results.length > 0}
                        <div class="search-people-list">
                            {#each results as user (user.id)}
                                <div class="search-people-row">
                                    <div class="search-people-avatar">
                                        <img src={pic(user.id)} alt={user.username}>
                                    </div>
                                    <div class="search-people-text">
                                        <div>
                                            <img src="/img/search/status-{live(user) ? "online" : "offline"}.png" alt={live(user) ? "online" : "offline"} title={status(user)}>
                                            <a href="/user?id={user.id}" class="search-people-name">{user.username}</a>
                                        </div>
                                        <div class="search-people-blurb">
                                            {#each linkify(user.about) as part, i}
                                                {#if i % 2}
                                                    <a href={part} target="_blank" rel="noopener noreferrer">{part}</a>
                                                {:else}
                                                    {part}
                                                {/if}
                                            {/each}
                                        </div>
                                    </div>
                                    <div class="search-people-side">
                                        {#if user.last_online}
                                            <span>{lastSeen(user.last_online)}</span>
                                        {/if}
                                        {#if session.me && session.me.id !== user.id}
                                            <button type="button" class="search-people-add" disabled={sent[user.id]} onclick={() => request(user.id)}>{sent[user.id] ? "Request Sent" : "Add Friend"}</button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                            {#if totalPages > 1}
                                <div class="search-people-pager">
                                    {#if page > 1}
                                        <a href={url(page - 1)} class="search-people-arrow previous" aria-label="Previous page"></a>
                                    {/if}
                                    <span class="search-people-page">{page}/{totalPages}</span>
                                    {#if page < totalPages}
                                        <a href={url(page + 1)} class="search-people-arrow next" aria-label="Next page"></a>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </main>
{:else if type === "library"}
    <main class="rbx-content legacy-search">
        <div class="legacy-search-wrap">
            <h1>{q ? `Search results for “${q}”` : "Search NoneRev"}</h1>
            <form class="legacy-search-form" onsubmit={search}>
                <input type="search" bind:value={term} maxlength="120" aria-label="Search terms" placeholder="Search">
                <button type="submit">Search</button>
            </form>
            <nav class="legacy-search-tabs" aria-label="Search categories">
                {#each categories as [key, label]}
                    <a href={url(1, key)} class:active={type === key}>{label}</a>
                {/each}
            </nav>
            {#if error}
                <p class="legacy-search-notice" role="alert">{error}</p>
            {/if}
            {#if !loaded}
                <p class="legacy-search-notice">Searching…</p>
            {:else if results.length === 0}
                <p class="legacy-search-notice">No library found.</p>
            {:else}
                <div class="legacy-search-results">
                    {#each results as result (result.id)}
                        <div class="legacy-search-result">
                            <div class="legacy-search-asset-icon">{result.type?.slice(0, 1) || "L"}</div>
                            <div class="legacy-search-result-info">
                                <strong>{result.name}</strong>
                                <span>{result.type} · By {result.creator_name || "Unknown"}</span>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
            {#if totalPages > 1}
                <nav class="legacy-search-pages" aria-label="Result pages">
                    {#if page > 1}
                        <a href={url(page - 1)}>Previous</a>
                    {/if}
                    <span>Page {page} of {totalPages}</span>
                    {#if page < totalPages}
                        <a href={url(page + 1)}>Next</a>
                    {/if}
                </nav>
            {/if}
        </div>
    </main>
{/if}
