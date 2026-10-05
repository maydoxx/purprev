<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    const categories: [string, string, string | null][] = [
        ["animations", "Animations", null],
        ["audio", "Audio", null],
        ["badges", "Badges", null],
        ["decals", "Decals", null],
        ["faces", "Faces", "faces"],
        ["game-passes", "Game Passes", null],
        ["gear", "Gear", "gear"],
        ["hats", "Hats", "hats"],
        ["heads", "Heads", null],
        ["models", "Models", null],
        ["packages", "Packages", "packages"],
        ["pants", "Pants", "pants"],
        ["places", "Places", null],
        ["plugins", "Plugins", null],
        ["shirts", "Shirts", "shirts"],
        ["t-shirts", "T-Shirts", "t-shirts"]
    ];
    const PER_PAGE = 30;

    const id = $derived(Number(router.query.id) || 0);
    const category = $derived(categories.some(c => c[0] === router.query.category) ? router.query.category! : "hats");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const info = $derived(categories.find(c => c[0] === category)!);

    let data = $state<any>(null);
    let missing = $state(false);

    $effect(() => {
        data = null;
        missing = false;
        if (!id) {
            missing = true;
            return;
        }
        api(`/user/favorites/${id}?category=${category}&page=${page}`).then(d => data = d).catch(() => missing = true);
    });

    const url = (cat: string, p: number) => `/favorites?id=${id}&category=${cat}${p > 1 ? `&page=${p}` : ""}`;
    const itemUrl = (item: any) => category === "places" ? `/game?id=${item.id}` : `/catalog/item?id=${item.id}`;
    const thumb = (item: any) => item.thumbnail || item.icon || "/img/pending.png";
    const overlay = (item: any) => item.is_limited_unique ? "/img/catalog/overlay-limited-unique.png" : item.is_limited ? "/img/catalog/overlay-limited.png" : "";
    const limited = (item: any) => item.is_limited || item.is_limited_unique;
    const n = (v: any) => Number(v).toLocaleString();
</script>

<svelte:head>
    <title>{data ? `${data.username}'s Favorites` : "Favorites"} - NoneRev</title>
    <link rel="stylesheet" href="/css/inventory.css">
</svelte:head>

<main class="inventory-page">
    <div class="inventory-shell">
        {#if missing}
            <div class="inventory-empty">That user does not exist.</div>
        {:else}
            <h1>{data ? `${data.username}'s Favorites` : "Favorites"}</h1>

            <div class="inventory-layout">
                <aside class="inventory-categories">
                    <h2>Category</h2>
                    <nav>
                        {#each categories as [key, label]}
                            <a href={url(key, 1)} class:active={key === category}>{label}</a>
                        {/each}
                    </nav>
                </aside>

                <section class="inventory-content">
                    <div class="inventory-heading-row">
                        <div>
                            <h2>{info[1]}</h2>
                            <p>
                                {#if data && data.items.length > 0}
                                    Showing {(page - 1) * PER_PAGE + 1} - {(page - 1) * PER_PAGE + data.items.length} of {n(data.total)} results
                                {:else}
                                    Showing 0 results
                                {/if}
                            </p>
                        </div>

                        <div class="inventory-get-more">
                            {#if category === "places"}
                                <span>Explore games to<br>find more places!</span>
                                <a href="/games">Get More</a>
                            {:else}
                                <span>Explore the catalog to<br>find more {info[1].toLowerCase()}!</span>
                                <a href={info[2] ? `/catalog?category=${info[2]}` : "/catalog"}>Get More</a>
                            {/if}
                        </div>
                    </div>

                    {#if !data}
                        <div class="inventory-empty">Loading...</div>
                    {:else if data.items.length === 0}
                        <div class="inventory-empty">{data.username} has no favorite {info[1].toLowerCase()} yet.</div>
                    {:else}
                        <div class="inventory-grid">
                            {#each data.items as item}
                                <article class="inventory-item">
                                    <a class="inventory-thumb" href={itemUrl(item)}>
                                        <img src={thumb(item)} alt={item.name}>
                                        {#if overlay(item)}
                                            <img class="inventory-limited-overlay" src={overlay(item)} alt={item.is_limited_unique ? "Limited U" : "Limited"}>
                                        {/if}
                                    </a>
                                    <div class="inventory-item-info">
                                        <a class="inventory-item-name" href={itemUrl(item)} title={item.name}>{item.name}</a>
                                        <div class="inventory-creator">
                                            By
                                            {#if item.creator_id}
                                                <a href="/user?id={item.creator_id}">{item.creator_name}</a>
                                            {:else}
                                                <span>NoneRev</span>
                                            {/if}
                                        </div>
                                        {#if category !== "places"}
                                            <div class="inventory-price">
                                                {#if limited(item) && item.best_price !== null}
                                                    <span class="inventory-robux">{n(item.best_price)}</span>
                                                {:else if limited(item)}
                                                    <span class="inventory-not-a-price">No Resellers</span>
                                                {:else if item.price === null && item.tix_price === null}
                                                    <span class="inventory-not-a-price">Off Sale</span>
                                                {:else if item.price !== null && Number(item.price) === 0}
                                                    <span class="inventory-not-a-price">Free</span>
                                                {:else if item.price !== null}
                                                    <span class="inventory-robux">{n(item.price)}</span>
                                                {:else}
                                                    <span class="inventory-tickets">{n(item.tix_price)}</span>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </article>
                            {/each}
                        </div>

                        {#if data.totalPages > 1}
                            <div class="inventory-pagination">
                                {#if page > 1}
                                    <a href={url(category, page - 1)}>Previous</a>
                                {:else}
                                    <span class="disabled">Previous</span>
                                {/if}
                                <span class="page-number">Page {page} of {data.totalPages}</span>
                                {#if page < data.totalPages}
                                    <a href={url(category, page + 1)}>Next</a>
                                {:else}
                                    <span class="disabled">Next</span>
                                {/if}
                            </div>
                        {/if}
                    {/if}
                </section>
            </div>
        {/if}
    </div>
</main>
