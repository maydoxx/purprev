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
    const filters = [
        ["my-vip-servers", "My VIP Servers"],
        ["other-vip-servers", "Other VIP Servers"],
        ["created", "Created by Me"],
        ["purchased", "Purchased"],
        ["my-games", "My Games"],
        ["other-games", "Other Games"]
    ];
    const PER_PAGE = 30;

    const category = $derived(categories.some(c => c[0] === router.query.category) ? router.query.category! : "hats");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const filter = $derived(filters.find(f => f[0] === router.query.filter) ?? filters[0]);
    const info = $derived(categories.find(c => c[0] === category)!);
    const special = $derived(category === "badges" || category === "game-passes" || category === "places");
    const label = $derived(category.replace(/-/g, " "));
    const section = $derived(library.includes(category) ? "library" : "catalog");
    const moreUrl = $derived(section === "library" ? "/search?type=library" : info[2] ? `/catalog?category=${info[2]}` : "/catalog");

    let data = $state<any>(null);
    let error = $state("");
    let recommended = $state<any[]>([]);
    let open = $state("");

    const counted = async (query: string, d: any) => {
        const last = d.page < d.totalPages ? await api(`${query}&page=${d.totalPages}`) : d;
        return {
            ...d,
            total: (d.totalPages - 1) * PER_PAGE + last.items.length
        };
    };

    $effect(() => {
        const query = `/user/inventory?category=${category}${category === "places" ? `&places_filter=${filter[0]}` : ""}`;
        data = null;
        error = "";
        api(`${query}&page=${page}`).then(d => counted(query, d)).then(d => {
            data = d;
        }).catch(err => {
            // unknown places filter comes back as 422
            if (err.status === 400 || err.status === 422) {
                data = {
                    items: [],
                    page: 1,
                    totalPages: 1,
                    total: 0
                };
            } else {
                error = err.message;
            }
        });
    });

    $effect(() => {
        recommended = [];
        if (!info[2]) {
            return;
        }
        api(`/catalog?category=${info[2]}&sort=bestselling`).then(d => {
            recommended = d.items.slice(0, 6);
        }).catch(() => {});
    });

    const items = $derived<any[]>(data?.items ?? []);
    const total = $derived(data?.total ?? 0);
    const offset = $derived(((data?.page ?? page) - 1) * PER_PAGE);

    const toggle = (name: string) => {
        open = open === name ? "" : name;
    };

    const outside = (e: MouseEvent) => {
        if (open && !(e.target as Element).closest(".inventory-dropdown")) {
            open = "";
        }
    };

    const url = (cat: string, p: number, f = "") => `/my/inventory?category=${cat}${f ? `&filter=${f}` : ""}${p > 1 ? `&page=${p}` : ""}`;
    const pageUrl = (p: number) => url(category, p, category === "places" ? filter[0] : "");
    const itemUrl = (item: any) => special ? `/game?id=${item.game_id}${category === "game-passes" ? "#store" : ""}` : `/catalog/item?id=${item.id}`;
    const thumb = (item: any) => item.thumbnail || item.icon || "/img/pending.png";

    const price = (item: any) => {
        const value = item.is_limited || item.is_limited_unique ? item.best_price : item.price;
        return value == null || Number(value) <= 0 ? null : Number(value);
    };

    const short = (v: number | null, thousands = false) => {
        if (v === null) {
            return "";
        }
        if (v >= 1e9) {
            return `${n(Math.round(v / 1e9))}B+`;
        }
        if (v >= 1e6 && !thousands) {
            return `${n(Math.round(v / 1e6))}M+`;
        }
        if (v >= 10000 && v < 1e6 && thousands) {
            return `${n(Math.round(v / 1e3))}K+`;
        }
        return n(v);
    };
</script>

<svelte:head>
    <title>Inventory - NoneRev</title>
    <link rel="stylesheet" href="/css/inventory.css">
</svelte:head>

<svelte:window onclick={outside} />

{#snippet creator(item: any)}
    <div class="inventory-card-creator">
        <span class="inventory-by">By</span>
        {#if item.vip_owner_id}
            <a class="inventory-creator-link" href="/user?id={item.vip_owner_id}">{item.vip_owner_name}</a>
        {:else if item.creator_id}
            <a class="inventory-creator-link" href="/user?id={item.creator_id}">{item.creator_name}</a>
        {:else}
            <span class="inventory-creator-link">NoneRev</span>
        {/if}
    </div>
{/snippet}

<main class="inventory-page">
    <h1 class="inventory-title">{session.me ? `${session.me.username}'s Inventory` : "Inventory"}</h1>

    <div class="inventory-explorer">
        <div class="inventory-category-select">
            <h3>Category</h3>
            <div class="inventory-dropdown" class:open={open === "category"}>
                <button type="button" class="inventory-dropdown-btn" onclick={() => toggle("category")}>
                    <span class="inventory-dropdown-label">{label}</span>
                    <span class="inventory-dropdown-arrow"></span>
                </button>
                <ul class="inventory-dropdown-menu">
                    {#each categories as [key, name]}
                        <li><a href={url(key, 1)} onclick={() => open = ""}>{name}</a></li>
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
            <div class="inventory-items" class:loading={!data && !error}>
                <div class="inventory-header" class:places={category === "places"}>
                    <div class="inventory-heading">
                        <h3>{label}</h3>
                        <span class="inventory-count">Showing {total === 0 ? 0 : n(offset + 1)} - {n(offset + items.length)} of {n(total)} results</span>
                    </div>

                    {#if category === "places"}
                        <div class="inventory-places">
                            <div class="inventory-dropdown" class:open={open === "places"}>
                                <button type="button" class="inventory-dropdown-btn" onclick={() => toggle("places")}>
                                    <span class="inventory-dropdown-label">{filter[1]}</span>
                                    <span class="inventory-dropdown-arrow"></span>
                                </button>
                                <ul class="inventory-dropdown-menu">
                                    {#each filters as [key, name]}
                                        <li><a href={url("places", 1, key)} onclick={() => open = ""}>{name}</a></li>
                                    {/each}
                                </ul>
                            </div>
                        </div>
                    {:else if !special}
                        <div class="inventory-more">
                            <a class="inventory-more-btn" href={moreUrl}>Get More</a>
                            <div class="inventory-more-text">Explore the {section} to find more {label}!</div>
                        </div>
                    {/if}
                </div>

                {#if error || items.length === 0}
                    <div class="inventory-cards">
                        <div class="inventory-empty">
                            {#if error}
                                {error}
                            {:else if special}
                                You have no {label}.
                            {:else}
                                You have no {label}. Try using the <a href={moreUrl}>{section}</a> to find new items.
                            {/if}
                        </div>
                    </div>
                {/if}

                <ul class="inventory-cards">
                    {#each items as item}
                        <li class="inventory-card">
                            <div class="inventory-card-box">
                                <a class="inventory-card-link" href={itemUrl(item)}>
                                    <div class="inventory-card-thumb">
                                        {#if item.serial_number != null}
                                            <div class="inventory-serial">#{item.serial_number}</div>
                                        {/if}
                                        <img src={thumb(item)} alt={item.name}>
                                        {#if item.is_limited_unique}
                                            <span class="inventory-label unique"></span>
                                        {:else if item.is_limited}
                                            <span class="inventory-label"></span>
                                        {/if}
                                    </div>
                                    <div class="inventory-card-name" title={item.name}>{item.name}</div>
                                </a>
                                {@render creator(item)}
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
                                <a href={data.page > 1 ? pageUrl(data.page - 1) : undefined}><span></span></a>
                            </li>
                            <li>
                                <span>{data.page}</span>
                            </li>
                            <li>
                                <span>of</span> <span>{n(data.totalPages)}</span>
                            </li>
                            <li class="inventory-pager-next" class:disabled={data.page >= data.totalPages}>
                                <a href={data.page < data.totalPages ? pageUrl(data.page + 1) : undefined}><span></span></a>
                            </li>
                        </ul>
                    </div>
                {/if}
            </div>

            {#if recommended.length > 0}
                <div class="inventory-recommended">
                    <div class="inventory-recommended-header">
                        <h3>Recommended {label}</h3>
                    </div>
                    <div class="inventory-recommended-row">
                        <ul class="inventory-cards">
                            {#each recommended as item (item.id)}
                                <li class="inventory-card">
                                    <div class="inventory-card-box">
                                        <a class="inventory-card-link" href="/catalog/item?id={item.id}">
                                            <div class="inventory-card-thumb">
                                                <img src={thumb(item)} alt={item.name}>
                                            </div>
                                            <div class="inventory-card-name">{item.name}</div>
                                        </a>
                                        {@render creator(item)}
                                        <div class="inventory-card-price" class:off={price(item) === null}>
                                            <span class="inventory-nonebux"></span> <span class="inventory-robux">{short(price(item), true)}</span>
                                        </div>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</main>
