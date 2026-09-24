<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import GameCard from "../GameCard.svelte";

    const q = $derived(router.query.q ?? "");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let games = $state<any[]>([]);
    let loaded = $state(false);

    $effect(() => {
        loaded = false;
        api(`/games?q=${encodeURIComponent(q)}&page=${page}`).then(d => {
            const list = Array.isArray(d) ? d : d.games;
            games = Array.isArray(list) ? list : [];
        }).catch(() => {
            games = [];
        }).finally(() => {
            loaded = true;
        });
    });

    const rows = $derived([
        {
            id: "popular",
            title: "Popular",
            games: [...games].reverse()
        },
        {
            id: "recently-created",
            title: "Recently Created",
            games
        }
    ]);
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
                    <span class="rbx-select-label">Default</span>
                    <span class="rbx-select-arrow"><i class="bi bi-chevron-down"></i></span>
                </button>
                <ul class="dropdown-menu">
                    <li><a href="/games">Default</a></li>
                    {#each rows as row}
                        <li><a href="#{row.id}">{row.title}</a></li>
                    {/each}
                </ul>
            </div>
            <div class="rbx-select dropdown">
                <button type="button" class="rbx-select-btn" data-bs-toggle="dropdown" aria-expanded="false">
                    <span class="rbx-select-label">All Genres</span>
                    <span class="rbx-select-arrow"><i class="bi bi-chevron-down"></i></span>
                </button>
                <ul class="dropdown-menu">
                    <li><a href="/games">All Genres</a></li>
                </ul>
            </div>
        </div>

        {#if loaded && games.length === 0}
            <div class="section-content-off games-empty">
                No games have been created yet.
            </div>
        {/if}

        {#each rows as row}
            {#if row.games.length > 0}
                <div class="game-sort" id={row.id}>
                    <div class="game-sort-header">
                        <h3>{row.title}</h3>
                        <a class="btn-see-all" href="/search?q=&type=games">See All</a>
                    </div>
                    <div class="game-sort-row">
                        <div class="game-sort-scroller">
                            <div class="game-sort-list">
                                <ul>
                                    {#each row.games as game (game.id)}
                                        <GameCard {game} />
                                    {/each}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        {/each}
    </div>
</main>
