<script lang="ts">
    import { api } from "../api";
    import UserAd from "../UserAd.svelte";
    import { router } from "../router.svelte";
    import { n, ago, itemUrl, thumb, isLimited, isNew, soldOut } from "../catalog";

    const titles: Record<string, string> = {
        all: "All Categories",
        featured: "Featured",
        "featured-hats": "Featured Hats",
        "featured-gear": "Featured Gear",
        "featured-faces": "Featured Faces",
        "featured-packages": "Featured Packages",
        collectibles: "Collectibles",
        "collectible-faces": "Collectible Faces",
        "collectible-hats": "Collectible Hats",
        "collectible-gear": "Collectible Gear",
        clothing: "Clothing",
        hats: "Hats",
        shirts: "Shirts",
        "t-shirts": "T-Shirts",
        pants: "Pants",
        packages: "Packages",
        bodyparts: "Body Parts",
        heads: "Heads",
        faces: "Faces",
        gear: "Gear"
    };
    const parents: Record<string, string> = {
        hats: "clothing",
        shirts: "clothing",
        "t-shirts": "clothing",
        pants: "clothing",
        packages: "clothing",
        heads: "bodyparts",
        faces: "bodyparts"
    };
    const sorts: [string, string][] = [
        ["relevance", "Relevance"],
        ["favorited", "Most Favorited"],
        ["bestselling", "Bestselling"],
        ["recent", "Recently updated"],
        ["price-high", "Price (High to Low)"],
        ["price-low", "Price (Low to High)"]
    ];
    const currencies: [string, string][] = [
        ["all", "All Currency"],
        ["nonebux", "Nonebux"],
        ["tix", "Tix"],
        ["free", "Free"]
    ];
    const searchCategories: [string, string][] = [
        ["all", "All Categories"],
        ["featured", "Featured"],
        ["collectibles", "Collectibles"],
        ["clothing", "Clothing"],
        ["bodyparts", "Body Parts"],
        ["gear", "Gear"]
    ];
    const gearTypes = ["All Gear", "Melee Weapon", "Ranged Weapon", "Explosive", "Power Up", "Navigation Enhancer", "Musical Instrument", "Social Item", "Building Tool", "Personal Transport"];
    const genres = ["Building", "Horror", "Town and City", "Military", "Comedy", "Medieval", "Adventure", "Sci-Fi", "Naval", "FPS", "RPG", "Sports", "Fighting", "Western"];

    type Filters = {
        category: string;
        sort: string;
        q: string;
        page: number;
        creator: string;
        currency: string;
        unavailable: boolean;
        genres: string[];
    };

    const landing = $derived(!router.query.category && !router.query.q && !router.query.sort && !router.query.page && !router.query.creator && !router.query.currency && !router.query.genre);
    const filters = $derived<Filters>({
        category: router.query.category! in titles ? router.query.category! : "all",
        sort: sorts.some(([s]) => s === router.query.sort) ? router.query.sort! : "relevance",
        q: (router.query.q ?? "").trim(),
        page: Math.max(1, Number(router.query.page) || 1),
        creator: (router.query.creator ?? "").trim(),
        currency: currencies.some(([c]) => c === router.query.currency) ? router.query.currency! : "all",
        unavailable: router.query.unavailable === "1",
        genres: genres.filter(g => (router.query.genre ?? "").split(",").includes(g))
    });
    const topOf = (c: string) => parents[c] ?? (c.startsWith("featured") ? "featured" : c.startsWith("collectible") ? "collectibles" : c);
    const topCategory = $derived(topOf(filters.category));

    // reassigned when the legend is toggled
    let legendOpen = $derived(router.query.legend !== "0");

    let data = $state<any>(null);
    let home = $state<any>(null);
    let error = $state("");

    $effect(() => {
        error = "";
        if (landing) {
            home = null;
            api("/catalog/landing").then(d => {
                home = d;
            }).catch(err => {
                error = err.message;
            });
            return;
        }
        data = null;
        const params = new URLSearchParams({
            q: filters.q,
            category: filters.category,
            sort: filters.sort,
            page: String(filters.page),
            creator: filters.creator,
            currency: filters.currency,
            unavailable: filters.unavailable ? "1" : "0",
            genre: filters.genres.join(",")
        });
        api("/catalog?" + params).then(d => {
            data = Array.isArray(d.items) ? d : {
                items: [],
                total: 0,
                totalPages: 1,
                perPage: 42
            };
        }).catch(err => {
            error = err.message;
        });
    });

    const url = (changes: Partial<Filters>, keep = true) => {
        const f: Filters = keep ? {
            ...filters,
            page: 1,
            ...changes
        } : {
            category: "all",
            sort: "relevance",
            q: "",
            page: 1,
            creator: "",
            currency: "all",
            unavailable: false,
            genres: [],
            ...changes
        };
        const params = new URLSearchParams({
            category: f.category
        });
        if (f.q !== "") {
            params.set("q", f.q);
        }
        if (f.sort !== "relevance") {
            params.set("sort", f.sort);
        }
        if (f.creator !== "") {
            params.set("creator", f.creator);
        }
        if (f.currency !== "all") {
            params.set("currency", f.currency);
        }
        if (f.unavailable) {
            params.set("unavailable", "1");
        }
        if (f.genres.length > 0) {
            params.set("genre", f.genres.join(","));
        }
        if (f.page > 1) {
            params.set("page", String(f.page));
        }
        if (!legendOpen) {
            params.set("legend", "0");
        }
        return "/catalog?" + params;
    };

    const pickGenre = (genre: string, on: boolean) => router.go(url({
        genres: genres.filter(g => g === genre ? on : filters.genres.includes(g))
    }));

    const search = (e: SubmitEvent) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget as HTMLFormElement);
        router.go(url({
            category: String(f.get("category")),
            q: String(f.get("q")).trim()
        }, false));
    };

    const creatorSearch = (e: SubmitEvent) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget as HTMLFormElement);
        router.go(url({
            creator: String(f.get("creator")).trim()
        }));
    };

    const jump = (e: SubmitEvent) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget as HTMLFormElement);
        router.go(url({
            page: Math.max(1, Number(f.get("page")) || 1)
        }));
    };

    const overlay = (item: any, big: boolean) => {
        if (item.is_limited_unique) {
            return big ? "/img/catalog/overlay-limited-unique.png" : "/img/catalog/overlay-limited-unique-small.png";
        }
        if (item.is_limited) {
            return big ? "/img/catalog/overlay-limited-big.png" : "/img/catalog/overlay-limited.png";
        }
        return "";
    };
    const heading = $derived(filters.q !== "" ? `Results for "${filters.q}" in ${titles[filters.category]}` : titles[filters.category]);
    const showingFrom = $derived(data ? (data.total === 0 ? 0 : (data.page - 1) * data.perPage + 1) : 0);
    const showingTo = $derived(data ? Math.min(data.total, data.page * data.perPage) : 0);
</script>

<svelte:head>
    <title>Catalog - NoneRev</title>
    <link rel="stylesheet" href="/css/catalog.css">
</svelte:head>

{#snippet card(item: any, big: boolean)}
    <div class="CatalogItemOuter" class:BigOuter={big} class:SmallOuter={!big}>
        <div class="SmallCatalogItemView" class:BigView={big} class:SmallView={!big}>
            <div class="CatalogItemInner" class:BigInner={big} class:SmallInner={!big}>
                <div class="roblox-item-image" class:image-large={big} class:image-small={!big}>
                    <div class="item-image-wrapper">
                        <a href={itemUrl(item)}>
                            <img title={item.name} alt={item.name} class="original-image" src={thumb(item)}>
                            {#if item.bc_only}
                                <img src="/img/catalog/legend-bc.png" alt="Builders Club" class="bc-overlay">
                            {/if}
                            {#if overlay(item, big)}
                                <img src={overlay(item, big)} alt={item.is_limited_unique ? "Limited Unique" : "Limited"} class="limited-overlay">
                            {/if}
                            {#if isNew(item)}
                                <img src="/img/catalog/overlay-new.png" alt="New" class="new-overlay">
                            {/if}
                        </a>
                    </div>
                </div>
                <div class="textDisplay">
                    <div class="CatalogItemName">
                        <a class="name" href={itemUrl(item)} title={item.name}>{item.name}</a>
                    </div>
                    {#if isLimited(item)}
                        {#if item.price !== null}
                            <div class="robux-price">
                                <span class="SalesText">was </span>
                                <span class="robux">{n(item.price)}</span>
                            </div>
                        {/if}
                        <div class="PrivateSales">
                            <span class="SalesText">now </span>
                            {#if item.best_price !== null}
                                <span class="robux">{n(item.best_price)}</span>
                            {:else}
                                <span class="NoPrivateSellersText">No Resellers</span>
                            {/if}
                        </div>
                    {:else if soldOut(item)}
                        <div>
                            <span class="NotAPrice">Sold Out</span>
                        </div>
                    {:else if item.price === null && item.tix_price === null}
                        <div>
                            <span class="NotAPrice">Off Sale</span>
                        </div>
                    {:else if item.price !== null && Number(item.price) === 0}
                        <div>
                            <span class="NotAPrice">Free</span>
                        </div>
                    {:else}
                        <div class="robux-price">
                            {#if item.price !== null}
                                <span class="robux">{n(item.price)}</span>
                            {/if}
                            {#if item.tix_price !== null}
                                <span class="tickets">{n(item.tix_price)}</span>
                            {/if}
                        </div>
                    {/if}
                </div>
                <div class="CatalogHoverContent">
                    <div>
                        <span class="CatalogItemInfoLabel">Creator:</span>
                        <span class="HoverInfo"><a href="/user?id={item.creator_id ?? 0}">{item.creator_name ?? "NoneRev"}</a></span>
                    </div>
                    <div>
                        <span class="CatalogItemInfoLabel">Updated:</span>
                        <span class="HoverInfo">{ago(item.updated_at)}</span>
                    </div>
                    <div>
                        <span class="CatalogItemInfoLabel">Sales:</span>
                        <span class="HoverInfo">{n(item.sales)}</span>
                    </div>
                    <div>
                        <span class="CatalogItemInfoLabel">Favorited:</span>
                        <span class="HoverInfo">{n(item.favorites)} times</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/snippet}

{#snippet dropdown()}
    <ul id="dropdownUl" class="clearfix">
        <li class="subcategories">
            <a href={url({ category: "featured" }, false)} class="assetTypeFilter">Featured</a>
            <ul class="slideOut">
                <li class="slideHeader"><span>Featured Types</span></li>
                <li><a href={url({ category: "featured" }, false)} class="assetTypeFilter">All Featured Items</a></li>
                <li><a href={url({ category: "featured-hats" }, false)} class="assetTypeFilter">Featured Hats</a></li>
                <li><a href={url({ category: "featured-gear" }, false)} class="assetTypeFilter">Featured Gear</a></li>
                <li><a href={url({ category: "featured-faces" }, false)} class="assetTypeFilter">Featured Faces</a></li>
                <li><a href={url({ category: "featured-packages" }, false)} class="assetTypeFilter">Featured Packages</a></li>
            </ul>
        </li>
        <li class="subcategories">
            <a href={url({ category: "collectibles" }, false)} class="assetTypeFilter collectiblesLink">Collectibles</a>
            <ul class="slideOut">
                <li class="slideHeader"><span>Collectible Types</span></li>
                <li><a href={url({ category: "collectibles" }, false)} class="assetTypeFilter">All Collectibles</a></li>
                <li><a href={url({ category: "collectible-faces" }, false)} class="assetTypeFilter">Collectible Faces</a></li>
                <li><a href={url({ category: "collectible-hats" }, false)} class="assetTypeFilter">Collectible Hats</a></li>
                <li><a href={url({ category: "collectible-gear" }, false)} class="assetTypeFilter">Collectible Gear</a></li>
            </ul>
        </li>
        <li class="slideHeader DropdownDivider divider-bottom"></li>
        <li>
            <a href={url({ category: "all" }, false)} class="assetTypeFilter">All Categories</a>
        </li>
        <li class="subcategories">
            <a href={url({ category: "clothing" }, false)} class="assetTypeFilter">Clothing</a>
            <ul class="slideOut">
                <li class="slideHeader"><span>Clothing Types</span></li>
                <li><a href={url({ category: "clothing" }, false)} class="assetTypeFilter">All Clothing</a></li>
                <li><a href={url({ category: "hats" }, false)} class="assetTypeFilter">Hats</a></li>
                <li><a href={url({ category: "shirts" }, false)} class="assetTypeFilter">Shirts</a></li>
                <li><a href={url({ category: "t-shirts" }, false)} class="assetTypeFilter">T-Shirts</a></li>
                <li><a href={url({ category: "pants" }, false)} class="assetTypeFilter">Pants</a></li>
                <li><a href={url({ category: "packages" }, false)} class="assetTypeFilter">Packages</a></li>
            </ul>
        </li>
        <li class="subcategories">
            <a href={url({ category: "bodyparts" }, false)} class="assetTypeFilter">Body Parts</a>
            <ul class="slideOut">
                <li class="slideHeader"><span>Body Part Types</span></li>
                <li><a href={url({ category: "bodyparts" }, false)} class="assetTypeFilter">All Body Parts</a></li>
                <li><a href={url({ category: "heads" }, false)} class="assetTypeFilter">Heads</a></li>
                <li><a href={url({ category: "faces" }, false)} class="assetTypeFilter">Faces</a></li>
                <li><a href={url({ category: "packages" }, false)} class="assetTypeFilter">Packages</a></li>
            </ul>
        </li>
        <li class="subcategories">
            <a href={url({ category: "gear" }, false)} class="assetTypeFilter">Gear</a>
            <ul class="slideOut gear-slide-out">
                <li class="slideHeader"><span>Gear Categories</span></li>
                {#each gearTypes as type}
                    <li><a href={url({ category: "gear" }, false)} class="gearFilter">{type}</a></li>
                {/each}
            </ul>
        </li>
    </ul>
{/snippet}

{#snippet legend()}
    <details id="legend" class:divider-top={!landing} open={legendOpen} ontoggle={e => legendOpen = e.currentTarget.open}>
        <summary class="header" id="legendheader">
            <h3>Legend</h3>
        </summary>
        <div id="legendcontent">
            <img src="/img/catalog/legend-bc.png" alt="Builders Club">
            <div class="legendText"><b>Builders Club Only</b><br>Only purchasable by Builders Club members.</div>
            <img src="/img/catalog/legend-limited.png" alt="Limited">
            <div class="legendText"><b>Limited Items</b><br>Owners of these discontinued items can re-sell them to other users at any price.</div>
            <img src="/img/catalog/legend-limited-unique.png" alt="Limited Unique">
            <div class="legendText"><b>Limited Unique Items</b><br>A limited supply originally sold by NoneRev. Each unit is labeled with a serial number. Once sold out, owners can re-sell them to other users.</div>
        </div>
    </details>
{/snippet}

<main class="rbx-content catalog-page">
    <UserAd size="banner" class="user-ad-top" />
    <UserAd size="skyscraper" class="user-ad-side" />
    <div class="catalog-body">
        <div id="catalog">
            <div class="header">
                <div class="header-title">
                    <h1><a href="/catalog" id="CatalogLink">Catalog</a></h1>
                </div>
                <form class="CatalogSearchBar" onsubmit={search}>
                    <input id="keywordTextbox" name="q" type="text" class="text-box text-box-small" value={filters.q} maxlength="100">
                    <div class="category-select-wrap">
                        <select id="categoriesForKeyword" name="category" value={landing ? "all" : topCategory}>
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
                <div id="dropdown">
                    {@render dropdown()}
                </div>
                {#if !landing}
                    <div class="filters-header">
                        <h2>Filters</h2>
                    </div>
                    <div class="filters">
                        <div class="filter-title">Category</div>
                        <ul>
                            {#each searchCategories as [value, label]}
                                <li><a href={url({ category: value })} class="assetTypeFilter" class:selected={topCategory === value}>{label}</a></li>
                            {/each}
                        </ul>
                        {#if topCategory !== "featured"}
                            <div class="filter-title">Genre</div>
                            <ul class="genre-filter">
                                <li><a href={url({ genres: [] })} class="all-genres" class:selected={filters.genres.length === 0}>All Genres</a></li>
                                {#each genres as genre, i}
                                    <li>
                                        <input type="checkbox" id="genre-{i}" checked={filters.genres.includes(genre)} onchange={e => pickGenre(genre, e.currentTarget.checked)}>
                                        <label for="genre-{i}">{genre}</label>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                        <div class="filter-title">Creators</div>
                        <ul>
                            <li><a href={url({ creator: "" })} class="creatorFilter" class:selected={filters.creator === ""}>All Creators</a></li>
                            <li><a href={url({ creator: "NONEREV" })} class="creatorFilter" class:selected={filters.creator === "NONEREV"}>NoneRev</a></li>
                            {#if filters.creator !== "" && filters.creator !== "NONEREV"}
                                <li><a href={url({ creator: filters.creator })} class="creatorFilter selected">{filters.creator}</a></li>
                            {/if}
                            <li>
                                <form class="creatorForm" onsubmit={creatorSearch}>
                                    <input id="creatorTextbox" name="creator" type="text" placeholder="Name" class="text-box text-box-small" value={filters.creator}>
                                    <button type="submit" id="submitCreatorButton" class="btn-control btn-control-small">Go</button>
                                </form>
                            </li>
                        </ul>
                        <div class="filter-title">Currency / Price</div>
                        <ul class="separatorForLegend">
                            {#each currencies as [value, label]}
                                <li><a href={url({ currency: value })} class="priceFilter" class:selected={filters.currency === value}>{label}</a></li>
                            {/each}
                            <li class="NotForSale">
                                <input type="checkbox" id="includeNotForSaleCheckbox" checked={filters.unavailable} onchange={e => router.go(url({ unavailable: e.currentTarget.checked }))}>
                                <label for="includeNotForSaleCheckbox">Show unavailable items</label>
                            </li>
                        </ul>
                    </div>
                {/if}
                {@render legend()}
            </div>

            <div class="right-content divider-left">
                {#if landing}
                    <a href="/upgrades/nonebux" class="btn-medium btn-primary">Buy NONEBUX</a>
                    <h2>Featured Items on NoneRev</h2>
                    <div class="clear"></div>
                    {#if error}
                        <div class="no-results">{error}</div>
                    {:else if !home}
                        <div class="no-results">Loading...</div>
                    {:else}
                        {#each home.featured.slice(0, 4) as item (item.id)}
                            {@render card(item, true)}
                        {/each}
                        <div class="clear"></div>
                        {#each home.featured.slice(4) as item (item.id)}
                            {@render card(item, false)}
                        {/each}
                        {#if home.featured.length === 0}
                            <div class="no-results">No featured items yet.</div>
                        {/if}
                        <div class="see-all-featured">
                            <a href={url({ category: "featured" }, false)} class="assetTypeFilter">See all featured items</a>
                        </div>
                    {/if}
                {:else}
                    <a href={url({ category: filters.category })} class="breadCrumbFilter bolded selected">{heading}</a>
                    <div id="secondRow">
                        <div class="showing">
                            {#if data}
                                <span>Showing <span>{n(showingFrom)}</span> - <span>{n(showingTo)}</span> of <span>{n(data.total)}</span> results</span>
                            {/if}
                        </div>
                        <div id="SortOptions">
                            Sort by:
                            <select id="SortMain" value={filters.sort} onchange={e => router.go(url({ sort: e.currentTarget.value }))}>
                                {#each sorts as [value, label]}
                                    <option {value}>{label}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="clear"></div>
                    </div>
                    {#if error}
                        <div class="no-results">{error}</div>
                    {:else if !data}
                        <div class="no-results">Loading...</div>
                    {:else if data.items.length === 0}
                        <div class="no-results">No results found. Try another category or search.</div>
                    {:else}
                        {#each data.items as item (item.id)}
                            {@render card(item, false)}
                        {/each}
                        <form class="PagingContainerDivTop" onsubmit={jump}>
                            {#if filters.page > 1}
                                <a class="pager previous" href={url({ page: filters.page - 1 })} aria-label="Previous page"></a>
                            {:else}
                                <span class="pager previous disabled"></span>
                            {/if}
                            <span class="page text">
                                Page
                                <input class="Paging_Input" name="page" type="text" value={filters.page} aria-label="Page">
                                of {n(data.totalPages)}
                            </span>
                            {#if filters.page < data.totalPages}
                                <a class="pager next" href={url({ page: filters.page + 1 })} aria-label="Next page"></a>
                            {:else}
                                <span class="pager next" class:disabled={filters.page > 1}></span>
                            {/if}
                        </form>
                    {/if}
                {/if}
            </div>
            <div class="clear"></div>
        </div>
    </div>
</main>
