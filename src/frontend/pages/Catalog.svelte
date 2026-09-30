<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    const titles: Record<string, string> = {
        featured: "Featured Items on NoneRev",
        all: "All Items",
        clothing: "Clothing",
        bodyparts: "Body Parts",
        hats: "Hats",
        faces: "Faces",
        "t-shirts": "T-Shirts",
        shirts: "Shirts",
        pants: "Pants",
        gear: "Gear",
        packages: "Packages"
    };
    const sorts = ["featured", "recent", "price-low", "price-high"];
    const searchCategories: [string, string][] = [
        ["all", "All Categories"],
        ["featured", "Featured"],
        ["clothing", "Clothing"],
        ["bodyparts", "Body Parts"],
        ["gear", "Gear"]
    ];

    const q = $derived((router.query.q ?? "").trim());
    const category = $derived.by(() => {
        const c = router.query.category! in titles ? router.query.category! : "featured";
        return q !== "" && c === "featured" ? "all" : c;
    });
    const sort = $derived(sorts.includes(router.query.sort!) ? router.query.sort! : "featured");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const featured = $derived(category === "featured");
    const heading = $derived(q !== "" ? `Results for "${q}" in ${titles[category]}` : titles[category]);

    let data = $state<any>(null);
    let error = $state("");

    $effect(() => {
        data = null;
        error = "";
        const params = new URLSearchParams({
            q,
            category,
            sort,
            page: String(page)
        });
        api("/catalog?" + params).then(d => {
            data = Array.isArray(d.items) ? d : {
                items: [],
                totalPages: 1
            };
        }).catch(err => {
            error = err.message;
        });
    });

    const url = (cat: string, s = "featured", query = "", p = 1) => {
        const params = new URLSearchParams({
            category: cat
        });
        if (s !== "featured") params.set("sort", s);
        if (query !== "") params.set("q", query);
        if (p > 1) params.set("page", String(p));
        return "/catalog?" + params;
    };

    const search = (e: SubmitEvent) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget as HTMLFormElement);
        router.go(url(String(f.get("category")), "featured", String(f.get("q")).trim()));
    };

    const jump = (e: SubmitEvent) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget as HTMLFormElement);
        router.go(url(category, sort, q, Math.max(1, Number(f.get("page")) || 1)));
    };

    const inCategory = (...cats: string[]) => cats.includes(category);
    const thumb = (item: any) => item.thumbnail || "/img/pending.png";
    const overlay = (item: any) => item.is_limited_unique ? "/img/catalog/overlay-limited-unique.png" : item.is_limited ? "/img/catalog/overlay-limited.png" : "";
    const isNew = (item: any) => Number(item.created_at) * 1000 > Date.now() - 14 * 86400 * 1000;
    const soldOut = (item: any) => item.is_limited_unique && item.limited_stock !== null && Math.max(0, item.limited_stock - item.limited_sold) === 0;
</script>

<svelte:head>
    <title>Catalog - NoneRev</title>
    <link rel="stylesheet" href="/css/catalog.css">
</svelte:head>

{#snippet card(item: any)}
    <article class="catalog-card">
        <a class="catalog-card-thumb" href="/catalog/item?id={item.id}" title={item.name}>
            <img class="catalog-card-image" src={thumb(item)} alt={item.name}>
            {#if overlay(item)}
                <img class="catalog-card-limited" src={overlay(item)} alt={item.is_limited_unique ? "Limited U" : "Limited"}>
            {/if}
            {#if isNew(item)}
                <img class="catalog-card-new" src="/img/catalog/overlay-new.png" alt="New">
            {/if}
        </a>
        <div class="catalog-card-info">
            <a class="catalog-card-name" href="/catalog/item?id={item.id}" title={item.name}>{item.name}</a>
            <div class="catalog-card-creator">By <a href="/user?id={item.creator_id ?? 0}">{item.creator_name ?? "NoneRev"}</a></div>
            <div class="catalog-card-price">
                {#if soldOut(item)}
                    <span class="catalog-offsale">Sold Out</span>
                {:else if item.price === null && item.tix_price === null}
                    <span class="catalog-offsale">Off Sale</span>
                {:else if item.price !== null && Number(item.price) === 0}
                    <span class="catalog-free">Free</span>
                {:else}
                    {#if item.price !== null}<span class="robux">{Number(item.price).toLocaleString()}</span>{/if}
                {/if}
                {#if item.tix_price !== null}<span class="catalog-tix-label">{Number(item.tix_price).toLocaleString()} Tix</span>{/if}
            </div>
        </div>
    </article>
{/snippet}

<main class="rbx-content">
    <div class="catalog-body">
        <div id="catalog">
            <div class="header">
                <div class="header-title">
                    <h1><a href="/catalog" id="CatalogLink">Catalog</a></h1>
                </div>
                <form class="CatalogSearchBar" onsubmit={search}>
                    <input id="keywordTextbox" name="q" type="text" class="text-box text-box-small" value={q} maxlength="100">
                    <div class="category-select-wrap">
                        <select id="categoriesForKeyword" name="category" value={category}>
                            {#each searchCategories as [value, label]}
                                <option {value}>{label}</option>
                            {/each}
                        </select>
                    </div>
                    <button id="submitSearchButton" type="submit" class="btn-control btn-control-large top-level">Search</button>
                </form>
            </div>

            <div class="left-nav-menu divider-right">
                <div class="browseDropdownHeader"></div>
                <div id="dropdown" class="splashdropdown">
                    <ul id="dropdownUl" class="clearfix">
                        <li class="subcategories">
                            <a href={url("featured")} class="assetTypeFilter" class:selectedAssetTypeFilter={featured}>Featured</a>
                            <ul class="slideOut">
                                <li class="slideHeader"><span>Featured Types</span></li>
                                <li><a href={url("featured")} class="assetTypeFilter">All Featured Items</a></li>
                            </ul>
                        </li>
                        <li class="slideHeader DropdownDivider divider-bottom"></li>
                        <li>
                            <a href={url("all")} class="assetTypeFilter" class:selectedAssetTypeFilter={category === "all"}>All Categories</a>
                        </li>
                        <li class="subcategories">
                            <a href={url("clothing")} class="assetTypeFilter" class:selectedAssetTypeFilter={inCategory("clothing", "hats", "shirts", "t-shirts", "pants")}>Clothing</a>
                            <ul class="slideOut">
                                <li class="slideHeader"><span>Clothing Types</span></li>
                                <li><a href={url("clothing")} class="assetTypeFilter">All Clothing</a></li>
                                <li><a href={url("hats")} class="assetTypeFilter">Hats</a></li>
                                <li><a href={url("shirts")} class="assetTypeFilter">Shirts</a></li>
                                <li><a href={url("t-shirts")} class="assetTypeFilter">T-Shirts</a></li>
                                <li><a href={url("pants")} class="assetTypeFilter">Pants</a></li>
                                <li><a href={url("packages")} class="assetTypeFilter">Packages</a></li>
                            </ul>
                        </li>
                        <li class="subcategories">
                            <a href={url("bodyparts")} class="assetTypeFilter" class:selectedAssetTypeFilter={inCategory("bodyparts", "faces", "packages")}>Body Parts</a>
                            <ul class="slideOut">
                                <li class="slideHeader"><span>Body Part Types</span></li>
                                <li><a href={url("bodyparts")} class="assetTypeFilter">All Body Parts</a></li>
                                <li><a href={url("faces")} class="assetTypeFilter">Faces</a></li>
                                <li><a href={url("packages")} class="assetTypeFilter">Packages</a></li>
                            </ul>
                        </li>
                        <li class="subcategories">
                            <a href={url("gear")} class="assetTypeFilter" class:selectedAssetTypeFilter={category === "gear"}>Gear</a>
                            <ul class="slideOut">
                                <li class="slideHeader"><span>Gear Categories</span></li>
                                <li><a href={url("gear")} class="assetTypeFilter">All Gear</a></li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div id="legend">
                    <div class="header expanded" id="legendheader">
                        <h3>Legend</h3>
                    </div>
                    <div id="legendcontent">
                        <img src="/img/catalog/legend-bc.png" alt="Builders Club">
                        <div class="legendText"><b>Builders Club Only</b><br>Only purchasable by Builders Club members.</div>
                        <img src="/img/catalog/legend-limited.png" alt="Limited">
                        <div class="legendText"><b>Limited Items</b><br>Owners of these discontinued items can re-sell them to other users at any price.</div>
                        <img src="/img/catalog/legend-limited-unique.png" alt="Limited Unique">
                        <div class="legendText"><b>Limited Unique Items</b><br>A limited supply originally sold by NoneRev. Each unit is labeled with a serial number. Once sold out, owners can re-sell them to other users.</div>
                    </div>
                </div>
            </div>

            <div class="right-content divider-left">
                {#if featured}
                    <a href="/upgrades/nonebux" class="btn-medium btn-primary">Buy Nonebux</a>
                {:else}
                    <div id="SortOptions">
                        <form>
                            Sort By:
                            <select name="sort" value={sort} onchange={e => router.go(url(category, e.currentTarget.value, q))}>
                                <option value="featured">Relevance</option>
                                <option value="recent">Recently Updated</option>
                                <option value="price-low">Price (Low to High)</option>
                                <option value="price-high">Price (High to Low)</option>
                            </select>
                        </form>
                    </div>
                {/if}

                <h2>{heading}</h2>
                <div class="clear"></div>

                {#if error}
                    <div class="no-results">{error}</div>
                {:else if !data}
                    <div class="no-results">Loading...</div>
                {:else if data.items.length === 0}
                    <div class="no-results">No items found. Try another category or search.</div>
                {:else}
                    <div class="catalog-grid" class:featured>
                        {#each data.items as item}
                            {@render card(item)}
                        {/each}
                    </div>
                {/if}

                {#if featured}
                    <div class="see-all-featured">
                        <a href={url("all")} class="assetTypeFilter">See all items</a>
                    </div>
                {:else if data && data.totalPages > 1}
                    <div class="PagingContainerDivTop">
                        {#if page > 1}
                            <a href={url(category, sort, q, page - 1)}>&lsaquo; Previous</a>
                        {:else}
                            <span class="pager-disabled">&lsaquo; Previous</span>
                        {/if}
                        &nbsp; Page
                        <form onsubmit={jump}>
                            <input type="text" name="page" class="Paging_Input" value={page} aria-label="Page">
                        </form>
                        of {data.totalPages} &nbsp;
                        {#if page < data.totalPages}
                            <a href={url(category, sort, q, page + 1)}>Next &rsaquo;</a>
                        {:else}
                            <span class="pager-disabled">Next &rsaquo;</span>
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="clear"></div>
        </div>
    </div>
</main>
