<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";
    import NotFound from "./NotFound.svelte";

    const wearable = ["Hat", "Face", "Shirt", "Pants", "T-Shirt"];

    const id = $derived(Number(router.query.id) || 0);

    let item = $state<any>(null);
    let missing = $state(false);
    let status = $state("");
    let statusError = $state(false);
    let busy = $state(false);
    let favoriting = $state(false);
    let recommended = $state<any[]>([]);
    let range = $state(180);

    const load = async () => {
        const currentId = id;
        try {
            const d = await api(`/catalog/${currentId}`);
            if (id !== currentId) return;
            item = d.id ? d : null;
            missing = !item;
        } catch {
            if (id !== currentId) return;
            missing = true;
        }
    };

    $effect(() => {
        item = null;
        missing = false;
        status = "";
        if (id > 0) load();
        else missing = true;
    });

    const limited = $derived(item && (item.is_limited || item.is_limited_unique));
    const limitedUnique = $derived(item && item.is_limited_unique);
    const remaining = $derived(limitedUnique && item.limited_stock !== null ? Math.max(0, item.limited_stock - item.limited_sold) : null);
    const soldOut = $derived(limitedUnique && remaining !== null && remaining <= 0);
    const canWear = $derived(item && wearable.includes(item.category) && !!item.asset_id);
    const sales = $derived(item ? Number(limitedUnique ? item.limited_sold : item.sales ?? 0) : 0);

    const post = async (path: string, body: unknown, working: string) => {
        busy = true;
        statusError = false;
        status = working;
        try {
            await api(path, body);
            status = "";
            await Promise.all([load(), session.refresh()]);
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        busy = false;
    };

    const buy = (currency: "nonebux" | "tix") => post("/catalog/purchase", {
        itemId: id,
        currency
    }, "Working...");

    const wear = () => post("/user/avatar/wear", {
        itemId: id,
        wear: !item.wearing
    }, "Updating your avatar...");

    const favorite = async () => {
        if (!session.me) { router.go("/login"); return; }
        favoriting = true;
        try {
            const d = await api(`/catalog/${id}/favorite`, {});
            item.favorited = d.favorited;
            item.favorites = d.favorites;
        } catch (err: any) { statusError = true; status = err.message; }
        favoriting = false;
    };

    $effect(() => {
        const currentId = id;
        recommended = [];
        api("/catalog?category=all&sort=recent").then(d => {
            if (id === currentId) recommended = (d.items || []).filter((v: any) => v.id !== currentId).slice(0, 7);
        }).catch(() => {});
    });

    const dates = $derived(Array.from({ length: 13 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - Math.round(range * (1 - i / 12)));
        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    }));
    const itemType = $derived(item?.category === "Hat" ? "Accessory | Hat" : item?.category);
    const n = (v: any) => Number(v ?? 0).toLocaleString("en-US");
</script>

<svelte:head>
    <title>{item ? item.name : "Catalog"} - NoneRev</title>
    <link rel="stylesheet" href="/css/catalog-item.css">
</svelte:head>

{#if missing}
    <NotFound />
{:else}
<main class="rbx-content catalog-item-shell">
{#if item}
    <div class="catalog-item-page">
        <section class="catalog-item-hero">
            <div class="catalog-item-preview">
                <div class="catalog-item-picture-wrap">
                    <img class="catalog-item-picture" src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                    {#if limited}
                        <span class="catalog-item-limited-label" class:unique={limitedUnique}>{limitedUnique ? "LIMITED U" : "LIMITED"}</span>
                    {/if}
                </div>
                <button type="button" class="catalog-item-favorites" class:active={item.favorited} disabled={favoriting} aria-label={item.favorited ? "Remove from favorites" : "Add to favorites"} aria-pressed={!!item.favorited} onclick={favorite}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.5 3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.3-6.6-3.5-6.6 3.5 1.3-7.3-5.4-5.2 7.4-1.1z"/></svg>
                    <span>{n(item.favorites)}</span>
                </button>
            </div>
            <div class="catalog-item-information">
                <header class="catalog-item-heading">
                    <h1>{item.name}</h1>
                    <div class="catalog-item-creator">By <a href="/user?id={item.creator_id}">{item.creator_name || "NoneRev"}</a></div>
                </header>
                <div class="catalog-item-purchase-row">
                    <span class="catalog-field-label">{limited ? "Best Price" : "Price"}</span>
                    <div class="catalog-item-price-details">
                        {#if item.price === null && item.tix_price === null}<span class="catalog-offsale">Off Sale</span>{/if}
                        {#if item.price !== null}<span class="catalog-price">{#if Number(item.price) === 0}Free{:else}<span class="catalog-currency" aria-label="Nonebux"></span>{n(item.price)}{/if}</span>{/if}
                        {#if item.tix_price !== null}<span class="catalog-price catalog-tix-price">{n(item.tix_price)} Tix</span>{/if}
                        {#if limited}<span class="catalog-reseller-link">See more <a href="#resellers">Resellers</a></span>{/if}
                    </div>
                    <div class="catalog-item-buy">
                        {#if item.bc_only}<div class="catalog-bc-only"><img src="/img/catalog/legend-bc.png" alt=""> Builders Club Only</div>{/if}
                        {#if item.owned}
                            {#if canWear}<button class="catalog-buy-button" type="button" disabled={busy} onclick={wear}>{item.wearing ? "Remove" : "Wear Item"}</button>
                            {:else}<span class="catalog-owned-label">Item Owned</span>{/if}
                        {:else if soldOut}<button class="catalog-buy-button" disabled>Sold Out</button>
                        {:else if item.price === null && item.tix_price === null}<button class="catalog-buy-button" disabled>Off Sale</button>
                        {:else if !session.me}<a class="catalog-buy-button" href="/login">Buy</a>
                        {:else if item.bc_only && session.me.membership === "None"}<button class="catalog-buy-button" disabled title="Builders Club members only">Buy</button>
                        {:else}<div class="catalog-buy-options">{#if item.price !== null}<button type="button" class="catalog-buy-button" disabled={busy} onclick={() => buy("nonebux")}>Buy</button>{/if}{#if item.tix_price !== null}<button type="button" class="catalog-buy-button catalog-buy-tix" disabled={busy} onclick={() => buy("tix")}>Buy</button>{/if}</div>{/if}
                    </div>
                </div>
                <dl class="catalog-item-fields">
                    <dt>Type</dt><dd>{itemType}</dd>
                    <dt>Genres</dt><dd><a href="/catalog?category=all">All</a></dd>
                    <dt>Description</dt><dd class="catalog-item-description">{item.description || "No description available."}</dd>
                    {#if limitedUnique}<dt>Remaining</dt><dd>{n(remaining)} of {n(item.limited_stock)}</dd>{/if}
                    {#if item.serial_number != null}<dt>Your Serial</dt><dd>#{n(item.serial_number)}</dd>{/if}
                </dl>
                {#if status}<p class="catalog-item-status" class:error={statusError} role="status">{status}</p>{/if}
                {#if session.me && session.me.admin > 0}<a class="catalog-item-admin-link" href="/admi/catalog?edit={item.id}">Edit item</a>{/if}
            </div>
        </section>
        {#if limited}
            <section class="catalog-price-section" id="price-chart">
                <h2>Price Chart</h2>
                <div class="catalog-price-panel">
                    <div class="catalog-chart-controls">
                        <div class="catalog-chart-legend"><span><i class="price-key"></i>Recent Average Price</span><span><i class="volume-key"></i>Volume</span></div>
                        <select aria-label="Price chart range" bind:value={range}><option value={30}>30 Days</option><option value={90}>90 Days</option><option value={180}>180 Days</option></select>
                    </div>
                    <div class="catalog-chart-area"><span>No price history available.</span></div>
                    <div class="catalog-chart-dates">{#each dates as label}<span>{label}</span>{/each}</div>
                    <div class="catalog-chart-volume"></div>
                    <dl class="catalog-chart-summary"><div><dt>Quantity Sold</dt><dd>{n(sales)}</dd></div><div><dt>Original Price</dt><dd>{"N/A"}</dd></div><div><dt>Average Price</dt><dd>N/A</dd></div></dl>
                </div>
            </section>
            <section class="catalog-resellers-section" id="resellers">
                <h2>Resellers</h2>
                <div class="catalog-resellers-panel"><p>No resellers are available.</p></div>
            </section>
        {/if}
        {#if recommended.length}
            <section class="catalog-recommendations-section">
                <h2>Recommended Items</h2>
                <ul class="catalog-recommendations">
                    {#each recommended as rec (rec.id)}
                        <li class="catalog-recommended-card">
                            <a href="/catalog/item?id={rec.id}"><img src={rec.thumbnail || "/img/pending.png"} alt={rec.name}><div class="catalog-recommended-name" title={rec.name}>{rec.name}</div></a>
                            <div class="catalog-recommended-creator">By <a href="/user?id={rec.creator_id}">{rec.creator_name || "NoneRev"}</a></div>
                            <div class="catalog-recommended-price">{#if rec.price !== null}<span class="catalog-currency" aria-label="Nonebux"></span>{Number(rec.price) === 0 ? "Free" : n(rec.price)}{/if}{#if rec.tix_price !== null}<span class="catalog-tix-label">{n(rec.tix_price)} Tix</span>{/if}{#if rec.price === null && rec.tix_price === null}<span class="catalog-offsale">Off Sale</span>{/if}</div>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}
    </div>
{/if}
</main>
{/if}
