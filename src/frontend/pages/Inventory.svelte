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

    const category = $derived(categories.some(c => c[0] === router.query.category) ? router.query.category! : "hats");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const info = $derived(categories.find(c => c[0] === category)!);
    const special = $derived(category === "badges" || category === "game-passes");

    let data = $state<any>(null);
    let error = $state("");

    $effect(() => {
        data = null;
        error = "";
        api(`/user/inventory?category=${category}&page=${page}`).then(d => {
            data = d;
        }).catch(err => {
            if (err.status === 400) {
                data = {
                    items: [],
                    totalPages: 1
                };
            } else {
                error = err.message;
            }
        });
    });

    const url = (cat: string, p: number) => `/my/inventory?category=${cat}${p > 1 ? `&page=${p}` : ""}`;
    const itemUrl = (item: any) => special ? `/game?id=${item.game_id}${category === "game-passes" ? "#store" : ""}` : `/catalog/item?id=${item.id}`;
    const thumb = (item: any) => item.thumbnail || item.icon || "/img/pending.png";
    const overlay = (item: any) => item.is_limited_unique ? "/img/catalog/overlay-limited-unique.png" : item.is_limited ? "/img/catalog/overlay-limited.png" : "";
</script>

<svelte:head>
    <title>My Inventory - NoneRev</title>
    <link rel="stylesheet" href="/css/inventory.css">
</svelte:head>

<main class="inventory-2016">
    <div class="inventory-shell">
        <h1>My Inventory</h1>

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
                                Showing {(page - 1) * PER_PAGE + 1} - {(page - 1) * PER_PAGE + data.items.length} results
                            {:else}
                                Showing 0 results
                            {/if}
                        </p>
                    </div>

                    <div class="inventory-get-more">
                        <span>Explore the catalog to<br>find more {info[1].toLowerCase()}!</span>
                        <a href={info[2] ? `/catalog?category=${info[2]}` : "/catalog"}>Get More</a>
                    </div>
                </div>

                {#if error}
                    <div class="inventory-empty">{error}</div>
                {:else if !data}
                    <div class="inventory-empty">Loading...</div>
                {:else if data.items.length === 0}
                    <div class="inventory-empty">You don't have any {info[1].toLowerCase()} yet.</div>
                {:else}
                    <div class="inventory-grid">
                        {#each data.items as item}
                            <article class="inventory-item">
                                <a class="inventory-thumb" href={itemUrl(item)}>
                                    <img src={thumb(item)} alt={item.name}>
                                    {#if !special && overlay(item)}
                                        <img class="inventory-limited-overlay" src={overlay(item)} alt={item.is_limited_unique ? "Limited U" : "Limited"}>
                                    {/if}
                                </a>
                                <div class="inventory-item-info">
                                    <a class="inventory-item-name" href={itemUrl(item)} title={item.name}>{item.name}</a>
                                    {#if !special && item.is_limited_unique && item.serial_number}
                                        <div class="inventory-serial">#{item.serial_number.toLocaleString()} of {(item.limited_stock ?? 0).toLocaleString()}</div>
                                    {:else if category === "badges"}
                                        <div class="inventory-serial">{item.game_title || "Game Badge"}</div>
                                    {:else if category === "game-passes"}
                                        <div class="inventory-serial">{item.game_title || "Game Pass"}</div>
                                    {/if}
                                    <div class="inventory-creator">
                                        By
                                        {#if item.creator_id}
                                            <a href="/user?id={item.creator_id}">{item.creator_name}</a>
                                        {:else}
                                            <span>NoneRev</span>
                                        {/if}
                                    </div>
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
    </div>
</main>
