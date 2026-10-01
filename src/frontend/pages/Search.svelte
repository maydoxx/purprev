<script lang="ts">
    import GameCard from "../GameCard.svelte";
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const categories: [string, string][] = [["games", "Games"], ["user", "People"], ["groups", "Groups"], ["catalog", "Catalog"], ["library", "Library"]];
    const q = $derived((router.query.q ?? "").trim());
    const type = $derived(categories.some(([key]) => key === router.query.type) ? router.query.type : "games");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    let term = $state("");
    let results = $state<any[]>([]);
    let totalPages = $state(1);
    let loaded = $state(false);
    let error = $state("");
    let sent = $state<Record<number, boolean>>({});

    $effect(() => { term = q; });
    $effect(() => {
        term = q;
    });

    $effect(() => {
        const current = `${q}:${type}:${page}`;
        loaded = false;
        error = "";
        api(`/site/search?q=${encodeURIComponent(q)}&type=${type}&page=${page}`).then(d => {
            if (`${q}:${type}:${page}` !== current) {
                return;
            }
            results = Array.isArray(d?.results) ? d.results : [];
            totalPages = Math.max(1, Number(d?.totalPages) || 1);
        }).catch(err => {
            if (`${q}:${type}:${page}` !== current) {
                return;
            }
            results = [];
            error = err.message;
        }).finally(() => {
            if (`${q}:${type}:${page}` === current) {
                loaded = true;
            }
        });
    });

    const search = (e: Event) => {
        e.preventDefault();
        router.go(`/search?q=${encodeURIComponent(term.trim())}&type=${type}`);
    };

    const request = async (userId: number) => {
        try {
            await api("/user/friends", { action: "request", userId });
            sent[userId] = true;
        } catch (err: any) {
            error = err.message;
        }
    };

    const url = (p: number, category = type) => `/search?q=${encodeURIComponent(q)}&type=${category}&page=${p}`;
    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
</script>

<svelte:head>
    <title>Search - NoneRev</title>
    <link rel="stylesheet" href="/css/search.css">
</svelte:head>

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
            <p class="legacy-search-notice">No {categories.find(([key]) => key === type)?.[1].toLowerCase()} found.</p>
        {:else if type === "games"}
            <ul class="legacy-search-games">
                {#each results as game (game.id)}
                    <GameCard {game} />
                {/each}
            </ul>
        {:else}
            <div class="legacy-search-results">
                {#each results as result (result.id)}
                    <div class="legacy-search-result">
                        {#if type === "user"}
                            <a href="/user?id={result.id}">
                                <img src={pic(result.id)} alt="">
                            </a>
                            <div class="legacy-search-result-info">
                                <a href="/user?id={result.id}">{result.username}</a>
                                <span>{result.online ? "Online" : "Offline"}</span>
                            </div>
                            {#if session.me && session.me.id !== result.id}
                                <button type="button" disabled={sent[result.id]} onclick={() => request(result.id)}>{sent[result.id] ? "Request Sent" : "Add Friend"}</button>
                            {/if}
                        {:else if type === "groups"}
                            <a href="/groups?id={result.id}">
                                <img src={result.icon || "/img/pending.png"} alt="">
                            </a>
                            <div class="legacy-search-result-info">
                                <a href="/groups?id={result.id}">{result.name}</a>
                                <span>{Number(result.member_count).toLocaleString()} Members</span>
                            </div>
                        {:else if type === "catalog"}
                            <a href="/catalog/item?id={result.id}">
                                <img src={result.thumbnail || "/img/pending.png"} alt="">
                            </a>
                            <div class="legacy-search-result-info">
                                <a href="/catalog/item?id={result.id}">{result.name}</a>
                                <span>{result.category} · By {result.creator_name || "NoneRev"}</span>
                            </div>
                            <span class="legacy-search-price">{result.price === null ? "Off Sale" : Number(result.price) === 0 ? "Free" : `N$${Number(result.price).toLocaleString()}`}</span>
                        {:else}
                            <div class="legacy-search-asset-icon">{result.type?.slice(0, 1) || "L"}</div>
                            <div class="legacy-search-result-info">
                                <strong>{result.name}</strong>
                                <span>{result.type} · By {result.creator_name || "Unknown"}</span>
                            </div>
                        {/if}
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
