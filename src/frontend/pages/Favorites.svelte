<script lang="ts">
    import { api } from "../api";
    import { n } from "../catalog";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const categories: [string, string, string | null][] = [
        ["heads", "Heads", null],
        ["faces", "Faces", "faces"],
        ["gear", "Gear", "gear"],
        ["hats", "Hats", "hats"],
        ["t-shirts", "T-Shirts", "t-shirts"],
        ["shirts", "Shirts", "shirts"],
        ["pants", "Pants", "pants"],
        ["decals", "Decals", null],
        ["models", "Models", null],
        ["plugins", "Plugins", null],
        ["animations", "Animations", null],
        ["places", "Places", null],
        ["game-passes", "Game Passes", null],
        ["audio", "Audio", null],
        ["badges", "Badges", null],
        ["packages", "Packages", "packages"]
    ];
    const tabs = [...categories].sort((a, b) => a[0].localeCompare(b[0]));
    const library = ["animations", "audio", "decals", "models", "plugins"];
    const PER_PAGE = 30;

    const id = $derived(Number(router.query.id) || 0);
    const category = $derived(categories.some(c => c[0] === router.query.category) ? router.query.category! : "hats");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const info = $derived(categories.find(c => c[0] === category)!);
    const special = $derived(category === "badges" || category === "game-passes" || category === "places");
    const label = $derived(category.replace(/-/g, " "));
    const mine = $derived(session.me?.id === id);
    const section = $derived(library.includes(category) ? "library" : "catalog");
    const moreUrl = $derived(section === "library" ? "/search?type=library" : info[2] ? `/catalog?category=${info[2]}` : "/catalog");

    let data = $state<any>(null);
    let missing = $state(false);
    let open = $state(false);

    $effect(() => {
        data = null;
        missing = false;
        if (!id) {
            missing = true;
            return;
        }
        api(`/user/favorites/${id}?category=${category}&page=${page}`).then(d => data = d).catch(() => missing = true);
    });

    const items = $derived<any[]>(data?.items ?? []);
    const total = $derived(Number(data?.total ?? 0));
    const offset = $derived(((data?.page ?? page) - 1) * PER_PAGE);

    const outside = (e: MouseEvent) => {
        if (open && !(e.target as Element).closest(".inventory-dropdown")) {
            open = false;
        }
    };

    const url = (cat: string, p: number) => `/favorites?id=${id}&category=${cat}${p > 1 ? `&page=${p}` : ""}`;
    const itemUrl = (item: any) => category === "places" ? `/game?id=${item.id}` : `/catalog/item?id=${item.id}`;
    const thumb = (item: any) => item.thumbnail || item.icon || "/img/pending.png";

    const price = (item: any) => {
        const value = item.is_limited || item.is_limited_unique ? item.best_price : item.price;
        return value == null || Number(value) <= 0 ? null : Number(value);
    };

    const short = (v: number | null) => {
        if (v === null) {
            return "";
        }
        if (v >= 1e9) {
            return `${n(Math.round(v / 1e9))}B+`;
        }
        if (v >= 1e6) {
            return `${n(Math.round(v / 1e6))}M+`;
        }
        return n(v);
    };
</script>

<svelte:head>
    <title>{data ? `${data.username}'s Favorites` : "Favorites"} - NoneRev</title>
    <link rel="stylesheet" href="/css/inventory.css">
</svelte:head>

<svelte:window onclick={outside} />

<main class="inventory-page">
    {#if missing}
        <div class="inventory-empty">That user does not exist.</div>
    {:else}
        <h1 class="inventory-title">{data ? `${data.username}'s Favorites` : "Favorites"}</h1>

        <div class="inventory-explorer">
            <div class="inventory-category-select">
                <h3>Category</h3>
                <div class="inventory-dropdown" class:open>
                    <button type="button" class="inventory-dropdown-btn" onclick={() => open = !open}>
                        <span class="inventory-dropdown-label">{label}</span>
                        <span class="inventory-dropdown-arrow"></span>
                    </button>
                    <ul class="inventory-dropdown-menu">
                        {#each categories as [key, name]}
                            <li><a href={url(key, 1)} onclick={() => open = false}>{name}</a></li>
                        {/each}
                    </ul>
                </div>
            </div>

            <div class="inventory-categories">
                <h3>Category</h3>
                <ul class="inventory-tabs">
                    {#each tabs as [key, name]}
                        <li class:active={key === category}>
                            <a href={url(key, 1)}><span>{name}</span></a>
                        </li>
                    {/each}
                </ul>
            </div>

            <div class="inventory-content">
                <div class="inventory-items" class:loading={!data}>
                    <div class="inventory-header">
                        <div class="inventory-heading">
                            <h3>{label}</h3>
                            <span class="inventory-count">Showing {total === 0 ? 0 : n(offset + 1)} - {n(offset + items.length)} of {n(total)} results</span>
                        </div>

                        {#if !special}
                            <div class="inventory-more">
                                <a class="inventory-more-btn" href={moreUrl}>Get More</a>
                                <div class="inventory-more-text">Explore the {section} to find more {label}!</div>
                            </div>
                        {/if}
                    </div>

                    {#if items.length === 0}
                        <div class="inventory-cards">
                            <div class="inventory-empty">{mine ? "You have" : "This user has"} not favorited any {label}.</div>
                        </div>
                    {/if}

                    <ul class="inventory-cards">
                        {#each items as item}
                            <li class="inventory-card">
                                <div class="inventory-card-box">
                                    <a class="inventory-card-link" href={itemUrl(item)}>
                                        <div class="inventory-card-thumb">
                                            <img src={thumb(item)} alt={item.name}>
                                            {#if item.is_limited_unique}
                                                <span class="inventory-label unique"></span>
                                            {:else if item.is_limited}
                                                <span class="inventory-label"></span>
                                            {/if}
                                        </div>
                                        <div class="inventory-card-name" title={item.name}>{item.name}</div>
                                    </a>
                                    <div class="inventory-card-creator">
                                        <span class="inventory-by">By</span>
                                        {#if item.creator_id}
                                            <a class="inventory-creator-link" href="/user?id={item.creator_id}">{item.creator_name}</a>
                                        {:else}
                                            <span class="inventory-creator-link">NoneRev</span>
                                        {/if}
                                    </div>
                                    <div class="inventory-card-price" class:off={price(item) === null}>
                                        <span class="inventory-nonebux"></span> <span class="inventory-robux">{short(price(item))}</span>
                                    </div>
                                </div>
                            </li>
                        {/each}
                    </ul>

                    {#if data?.totalPages > 1}
                        <div class="inventory-pager">
                            <ul>
                                <li class="inventory-pager-prev" class:disabled={data.page <= 1}>
                                    <a href={data.page > 1 ? url(category, data.page - 1) : undefined}><span></span></a>
                                </li>
                                <li>
                                    <span>{data.page}</span>
                                </li>
                                <li>
                                    <span>of</span> <span>{n(data.totalPages)}</span>
                                </li>
                                <li class="inventory-pager-next" class:disabled={data.page >= data.totalPages}>
                                    <a href={data.page < data.totalPages ? url(category, data.page + 1) : undefined}><span></span></a>
                                </li>
                            </ul>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</main>
