<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import GameCard, { sortRow } from "../GameCard.svelte";

    const sort = $derived(router.query.sort ?? "");
    const genre = $derived(router.query.genre ?? "All");

    const GENRES = [
        "All",
        "Adventure",
        "Building",
        "Comedy",
        "Fighting",
        "FPS",
        "Horror",
        "Medieval",
        "Military",
        "Naval",
        "RPG",
        "Sci-Fi",
        "Sports",
        "Town and City",
        "Western"
    ];

    const link = (s: string, g: string) => {
        const q = new URLSearchParams();
        if (s) {
            q.set("sort", s);
        }
        if (g && g !== "All") {
            q.set("genre", g);
        }
        const qs = q.toString();
        return "/games" + (qs ? "?" + qs : "");
    };

    let rows = $state<any[]>([]);
    let sorts = $state<any[]>([]);
    let games = $state<any[]>([]);
    let title = $state("");
    let page = $state(1);
    let totalPages = $state(1);
    let loaded = $state(false);
    let loading = $state(false);
    let error = $state("");

    const load = (p: number) => {
        loading = true;
        error = "";
        return api(`/games?sort=${encodeURIComponent(sort)}&genre=${encodeURIComponent(genre)}&page=${p}`).then(d => {
            games = p === 1 ? d.games : [...games, ...d.games];
            page = d.page;
            totalPages = d.totalPages;
            title = d.sort?.title ?? "";
            sorts = d.sorts ?? [];
        }).catch(err => {
            error = err.message;
            games = [];
        }).finally(() => {
            loading = false;
            loaded = true;
        });
    };

    $effect(() => {
        loaded = false;
        if (sort) {
            games = [];
            load(1);
            return;
        }
        title = "";
        api(`/games/sorts?genre=${encodeURIComponent(genre)}`).then(d => {
            rows = d.rows ?? [];
            sorts = d.sorts ?? [];
        }).catch(() => {
            rows = [];
        }).finally(() => {
            loaded = true;
        });
    });
</script>

<svelte:head>
    <title>Games - NoneRev</title>
    <link rel="stylesheet" href="/css/games.css">
</svelte:head>

<main class="rbx-content">
    <div class="games-container">
        <div class="games-filters">
            <div class="rbx-select dropdown">
                <button type="button" class="rbx-select-btn" data-bs-toggle="dropdown" aria-expanded="false">
                    <span class="rbx-select-label">{title || "Default"}</span>
                    <span class="rbx-select-arrow"></span>
                </button>
                <ul class="dropdown-menu">
                    <li>
                        <a href={link("", genre)}>Default</a>
                    </li>
                    {#each sorts as s}
                        <li>
                            <a href={link(s.id, genre)}>{s.title}</a>
                        </li>
                    {/each}
                </ul>
            </div>
            <div class="rbx-select dropdown">
                <button type="button" class="rbx-select-btn" data-bs-toggle="dropdown" aria-expanded="false">
                    <span class="rbx-select-label">{genre === "All" ? "Genre" : genre}</span>
                    <span class="rbx-select-arrow"></span>
                </button>
                <ul class="dropdown-menu">
                    {#each GENRES as g}
                        <li>
                            <a href={link(sort, g)}>{g}</a>
                        </li>
                    {/each}
                </ul>
            </div>
        </div>

        {#if sort}
            {#if loaded && games.length === 0}
                <div class="section-content-off games-empty">
                    {error || "No games here yet."}
                </div>
            {/if}
            <div class="game-grid">
                <ul>
                    {#each games as game (game.id)}
                        <GameCard {game} />
                    {/each}
                </ul>
            </div>
            {#if page < totalPages}
                <button type="button" class="btn-load-more" disabled={loading} onclick={() => load(page + 1)}>
                    {loading ? "Loading..." : "Load More"}
                </button>
            {/if}
        {:else}
            {#if loaded && rows.length === 0}
                <div class="section-content-off games-empty">
                    No games have been created yet.
                </div>
            {/if}

            {#each rows as row (row.id)}
                <div class="game-sort" id={row.id}>
                    <div class="game-sort-header">
                        <h3>{row.title}</h3>
                        <a class="btn-see-all" href={link(row.id, genre)}>See All</a>
                    </div>
                    <div class="game-sort-row" use:sortRow>
                        <div class="game-sort-scroller">
                            <div class="game-sort-list">
                                <ul>
                                    {#each row.games as game (game.id)}
                                        <GameCard {game} />
                                    {/each}
                                </ul>
                            </div>
                        </div>
                        <button type="button" class="game-sort-arrow left" aria-label="Scroll Previous" hidden>
                            <span></span>
                        </button>
                        <button type="button" class="game-sort-arrow right" aria-label="Scroll Next" hidden>
                            <span></span>
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</main>
