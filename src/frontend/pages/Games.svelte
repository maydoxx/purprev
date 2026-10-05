<script lang="ts">
    import { api } from "../api";
    import UserAd from "../UserAd.svelte";
    import { router } from "../router.svelte";
    import GameCard from "../GameCard.svelte";

    const TIMES = [
        {
            id: "day",
            title: "Past Day"
        },
        {
            id: "week",
            title: "Past Week"
        },
        {
            id: "all",
            title: "All Time"
        }
    ];

    const TIMED = [
        "top-rated",
        "top-favorited"
    ];

    const sort = $derived(router.query.sort ?? "");
    const genre = $derived(router.query.genre ?? "All");
    const timed = $derived(TIMED.includes(sort));
    const time = $derived(TIMES.find(t => t.id === router.query.time) ?? TIMES[1]);

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

    const DEFAULT_ROWS = [
        "popular",
        "top-earning",
        "top-rated",
        "recommended",
        "featured"
    ];

    const CARD = 161;

    const link = (s: string, g: string, t = "week") => {
        const q = new URLSearchParams();
        if (s) {
            q.set("sort", s);
        }
        if (TIMED.includes(s) && t !== "week") {
            q.set("time", t);
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
    let bottom = $state(false);

    const load = (p: number) => {
        loading = true;
        error = "";
        const span = timed ? `&time=${time.id}` : "";
        return api(`/games?sort=${encodeURIComponent(sort)}&genre=${encodeURIComponent(genre)}${span}&page=${p}`).then(d => {
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
            page = 1;
            totalPages = 1;
            load(1);
            return;
        }
        title = "";
        api(`/games/sorts?genre=${encodeURIComponent(genre)}`).then(d => {
            rows = (d.rows ?? []).filter((row: any) => DEFAULT_ROWS.includes(row.id));
            sorts = d.sorts ?? [];
        }).catch(() => {
            rows = [];
        }).finally(() => {
            loaded = true;
        });
    });

    $effect(() => {
        if (bottom && sort && !loading && page < totalPages) {
            load(page + 1);
        }
    });

    const scroller = (list: HTMLElement) => {
        const view = list.querySelector<HTMLElement>(".games-row-view")!;
        const [prev, next] = list.querySelectorAll<HTMLButtonElement>(".games-scroller");
        const update = () => {
            prev.disabled = view.scrollLeft <= 0;
            next.disabled = view.scrollLeft + view.clientWidth >= view.scrollWidth - 1;
        };
        const move = (direction: number) => {
            const cards = Math.max(1, Math.floor(view.clientWidth / CARD));
            view.scrollBy({
                left: direction * cards * CARD,
                behavior: "smooth"
            });
        };
        const sizes = new ResizeObserver(update);
        sizes.observe(view);
        sizes.observe(view.firstElementChild!);
        view.addEventListener("scroll", update);
        prev.addEventListener("click", () => move(-1));
        next.addEventListener("click", () => move(1));
        return {
            destroy() {
                sizes.disconnect();
            }
        };
    };

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
</script>

<svelte:head>
    <title>Games - NoneRev</title>
    <link rel="stylesheet" href="/css/games.css">
</svelte:head>

<main class="rbx-content">
    <UserAd size="banner" class="user-ad-top" />
    <div class="games-page">
        <div class="games-filters">
            <div class="games-filter dropdown">
                <button type="button" class="games-filter-btn" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
                    <span class="games-filter-label">{title || "Default"}</span>
                    <span class="games-filter-arrow"></span>
                </button>
                <ul class="dropdown-menu games-filter-menu">
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
            {#if timed}
                <div class="games-filter dropdown">
                    <button type="button" class="games-filter-btn" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
                        <span class="games-filter-label">{time.title}</span>
                        <span class="games-filter-arrow"></span>
                    </button>
                    <ul class="dropdown-menu games-filter-menu">
                        {#each TIMES as t}
                            <li>
                                <a href={link(sort, genre, t.id)}>{t.title}</a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
            {#if sort !== "featured"}
                <div class="games-filter dropdown">
                    <button type="button" class="games-filter-btn" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
                        <span class="games-filter-label">{genre}</span>
                        <span class="games-filter-arrow"></span>
                    </button>
                    <ul class="dropdown-menu games-filter-menu">
                        {#each GENRES as g}
                            <li>
                                <a href={link(sort, g, time.id)}>{g}</a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </div>

        {#if sort}
            <div class="games-rows">
                <div class="games-row games-row-single">
                    {#if title}
                        <div class="games-row-header">
                            <h3>{title}</h3>
                        </div>
                    {/if}
                    <div class="games-row-list">
                        {#if loaded && games.length === 0}
                            <div class="section-content-off games-empty">
                                {error || "No games here yet."}
                            </div>
                        {/if}
                        <ul class="games-grid">
                            {#each games as game (game.id)}
                                <GameCard {game} />
                            {/each}
                        </ul>
                        <div class="games-more" use:watch></div>
                    </div>
                </div>
            </div>
        {:else}
            {#if loaded && rows.length === 0}
                <div class="section-content-off games-empty">
                    No games have been created yet.
                </div>
            {/if}

            <div class="games-rows">
                {#each rows as row (row.id)}
                    <div class="games-row" id={row.id}>
                        <div class="games-row-header">
                            <h3>{row.title}</h3>
                            <a class="games-see-all" href={link(row.id, genre)}>See All</a>
                        </div>
                        <div class="games-row-list" use:scroller>
                            <div class="games-row-view">
                                <ul class="games-row-cards">
                                    {#each row.games as game (game.id)}
                                        <GameCard {game} />
                                    {/each}
                                </ul>
                            </div>
                            <button type="button" class="games-scroller prev" aria-label="Scroll Previous" disabled>
                                <span class="games-scroller-arrow"></span>
                            </button>
                            <button type="button" class="games-scroller next" aria-label="Scroll Next">
                                <span class="games-scroller-arrow"></span>
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</main>
