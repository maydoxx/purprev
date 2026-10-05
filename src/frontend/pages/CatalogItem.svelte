<script lang="ts">
    import { api } from "../api";
    import UserAd from "../UserAd.svelte";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";
    import { n, ago, shortDate, itemUrl, thumb, isLimited, remaining, soldOut, onSale, scene3d } from "../catalog";
    import NotFound from "./NotFound.svelte";
    import Comments from "../Comments.svelte";

    const wearable = ["Hat", "Face", "Shirt", "Pants", "T-Shirt"];
    const RESELLERS_PER_PAGE = 6;
    const DAY = 86400;

    const id = $derived(Number(router.query.id) || 0);

    let item = $state<any>(null);
    let resale = $state<any>(null);
    let recommended = $state<any>(null);
    let missing = $state(false);
    let status = $state("");
    let statusError = $state(false);
    let busy = $state(false);
    let favoriting = $state(false);
    let descExpanded = $state(false);
    let tab = $state<"recommendations" | "commentary">("recommendations");
    let range = $state(30);
    let resellersPage = $state(1);
    let modal = $state<"" | "sell" | "unsell" | "buy">("");
    let gearOpen = $state(false);
    let threeD = $state<"off" | "loading" | "on">("off");
    let sellPrice = $state("");
    let buying = $state<any>(null);

    const load = async () => {
        const currentId = id;
        try {
            const d = await api(`/catalog/${currentId}`);
            if (id !== currentId) {
                return;
            }
            item = d.id ? d : null;
            missing = !item;
            if (item?.resellable) {
                const r = await api(`/catalog/${currentId}/resale`);
                if (id === currentId) {
                    resale = r;
                }
            }
        } catch {
            if (id !== currentId) {
                return;
            }
            missing = true;
        }
    };

    $effect(() => {
        const currentId = id;
        item = null;
        resale = null;
        recommended = null;
        missing = false;
        status = "";
        descExpanded = false;
        tab = "recommendations";
        resellersPage = 1;
        modal = "";
        gearOpen = false;
        threeD = "off";
        if (currentId <= 0) {
            missing = true;
            return;
        }
        load();
        api(`/catalog/${currentId}/recommended`).then(d => {
            if (id === currentId) {
                recommended = d;
            }
        }).catch(() => {});
    });

    const limited = $derived(item ? isLimited(item) : false);
    const limitedUnique = $derived(item ? !!item.is_limited_unique : false);
    const canWear = $derived(item && wearable.includes(item.category) && !!item.asset_id);
    const left = $derived(item ? remaining(item) : null);
    const bcLocked = $derived(item && item.bc_only && (!session.me || session.me.membership === "None"));
    const typeLine = $derived(item ? `NoneRev ${item.category}${limited ? " / Collectible Item" : ""}${limitedUnique ? " / Limited Edition" : ""}` : "");
    const longDescription = $derived(item ? String(item.description ?? "").length > 150 : false);
    const description = $derived(item ? (longDescription && !descExpanded ? String(item.description).slice(0, 147) : item.description || "No description available.") : "");
    const listings = $derived<any[]>(resale?.listings ?? []);
    const resellerPages = $derived(Math.max(1, Math.ceil(listings.length / RESELLERS_PER_PAGE)));
    const pageListings = $derived(listings.slice((resellersPage - 1) * RESELLERS_PER_PAGE, resellersPage * RESELLERS_PER_PAGE));
    const pageBlock = $derived(Math.floor((resellersPage - 1) / 5) * 5);
    const pageNumbers = $derived(Array.from({ length: Math.min(5, resellerPages - pageBlock) }, (_, i) => pageBlock + i + 1));
    const best = $derived<any>(listings.find((l: any) => !l.mine) ?? listings[0] ?? null);
    const fee = $derived(resale?.fee ?? 0.3);
    const sellValue = $derived(/^\d+$/.test(sellPrice.trim()) ? Number(sellPrice.trim()) : NaN);
    const sellFee = $derived(Number.isFinite(sellValue) && sellValue > 0 ? Math.max(1, Math.round(sellValue * fee)) : 0);
    const sellError = $derived(sellPrice.trim() !== "" && (!Number.isFinite(sellValue) || sellValue <= 0) ? "Price must be a positive integer." : "");
    const admin = $derived(!!session.me && session.me.admin > 0);
    const gear = $derived(!!item && (admin || (item.owned && (canWear || limited))));
    const serialLabel = (serial: number) => `Serial #${n(serial)}${item.limited_stock !== null ? ` of ${n(item.limited_stock)}` : ""}`;
    const headshot = (userId: number) => `/api/user/getProfilePicture?userId=${userId}&type=headshot`;
    const bcOverlay = (membership: string) => membership === "TBC" ? "/img/catalog/overlay-tbc-small.png" : membership === "BC" || membership === "OBC" ? "/img/catalog/overlay-bc-small.png" : "";
    const bcBadge = (membership: string) => membership === "TBC" ? "/img/catalog/overlay-tbc.png" : membership === "OBC" ? "/img/catalog/overlay-obc.png" : membership === "BC" ? "/img/catalog/overlay-bc.png" : "";
    const buyLabel = (currency: "nonebux" | "tix") => currency === "tix" ? "Buy with Tix" : Number(item.price) === 0 ? "Take One" : "Buy with N$";

    const closeGear = (e: MouseEvent) => {
        if (gearOpen && !(e.target as Element).closest?.(".item-options")) {
            gearOpen = false;
        }
    };

    const post = async (path: string, body: unknown, working: string) => {
        busy = true;
        statusError = false;
        status = working;
        try {
            await api(path, body);
            status = "";
            await Promise.all([load(), session.refresh()]);
            return true;
        } catch (err: any) {
            statusError = true;
            status = err.message;
            return false;
        } finally {
            busy = false;
        }
    };

    const buy = (currency: "nonebux" | "tix") => post("/catalog/purchase", {
        itemId: id,
        currency
    }, "Working...");

    const wear = () => post("/user/avatar/wear", {
        itemId: id,
        wear: !item.wearing
    }, "Updating your avatar...");

    const openBuy = (listing: any) => {
        if (!session.me) {
            router.go("/login");
            return;
        }
        buying = listing;
        modal = "buy";
    };

    const buyResale = async () => {
        const listing = buying;
        modal = "";
        await post(`/catalog/${id}/buy-resale`, {
            listingId: listing.id,
            expectedPrice: listing.price
        }, "Processing Transaction");
    };

    const openSell = () => {
        if (!session.me) {
            router.go("/login");
            return;
        }
        sellPrice = "";
        modal = "sell";
    };

    const sell = async () => {
        if (!Number.isFinite(sellValue) || sellValue <= 0) {
            return;
        }
        modal = "";
        await post(`/catalog/${id}/sell`, {
            price: sellValue
        }, "Working...");
    };

    const unsell = async () => {
        modal = "";
        await post(`/catalog/${id}/unsell`, {}, "Working...");
    };

    const favorite = async () => {
        favoriting = true;
        try {
            const d = await api(`/catalog/${id}/favorite`, {});
            item.favorited = d.favorited;
            item.favorites = d.favorites;
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        favoriting = false;
    };

    type Day = {
        day: number;
        average: number;
        volume: number;
    };

    type DayTotal = {
        total: number;
        count: number;
    };

    const periodStats = (days: number) => {
        const p = resale?.periods.find((p: any) => p.days === days);
        if (!p) {
            return undefined;
        }
        const change = p.change !== null ? ` (${p.change >= 0 ? "+" : ""}${p.change}%)` : "";
        return `${days} Day Avg Price: ${n(p.average ?? 0)} N$${change}, Volume: ${n(p.volume)}`;
    };

    const tickLabel = (v: number, decimals: number) => v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });

    const priceAxis = (values: number[], height: number) => {
        const low = Math.min(...values);
        const high = Math.max(...values);
        let min = low - (high - low) * 0.02;
        let max = high + (high - low) * 0.02;
        if (low === high) {
            min = low - 1;
            max = high + 1;
        }
        if (min < 0 && low >= 0) {
            min = 0;
        }
        const delta = (max - min) / (0.3 * Math.sqrt(height));
        let decimals = -Math.floor(Math.log10(delta));
        const magnitude = 10 ** -decimals;
        const norm = delta / magnitude;
        let step = 10;
        if (norm < 1.5) {
            step = 1;
        } else if (norm < 3) {
            step = 2;
            if (norm > 2.25) {
                step = 2.5;
                decimals += 1;
            }
        } else if (norm < 7.5) {
            step = 5;
        }
        step *= magnitude;
        const first = Math.floor(min / step) * step;
        const ticks: number[] = [];
        do {
            ticks.push(first + ticks.length * step);
        } while (ticks[ticks.length - 1] < max);
        return {
            min: Math.min(min, ticks[0]),
            max: Math.max(max, ticks[ticks.length - 1]),
            ticks,
            decimals: Math.max(0, decimals)
        };
    };

    const dateTicks = (min: number, max: number, width: number) => {
        const day = DAY * 1000;
        const steps = [1, 2, 3, 7.5, 15, 30];
        const delta = (max - min) / day / (0.3 * Math.sqrt(width));
        let i = 0;
        while (i < steps.length - 1 && delta >= (steps[i] + steps[i + 1]) / 2) {
            i++;
        }
        const step = steps[i];
        const d = new Date(min);
        d.setUTCHours(0, 0, 0, 0);
        if (step >= 4) {
            d.setUTCDate(1);
        }
        const ticks: number[] = [];
        let carry = 0;
        do {
            const v = d.getTime();
            ticks.push(v);
            if (step < 4) {
                d.setTime(v + step * day);
            } else if (step === 30) {
                d.setUTCMonth(d.getUTCMonth() + 1);
            } else {
                // half and quarter months follow the length of the month they start in
                d.setUTCDate(1);
                const monthStart = d.getTime();
                d.setUTCMonth(d.getUTCMonth() + 1);
                d.setTime(v + carry * 3600000 + (d.getTime() - monthStart) * step / 30);
                carry = d.getUTCHours();
                d.setUTCHours(0);
            }
        } while (ticks[ticks.length - 1] < max);
        return ticks.filter(t => t >= min && t <= max);
    };

    const chart = $derived.by(() => {
        const sales: any[] = resale?.sales ?? [];
        const byDay = new Map<number, DayTotal>();
        for (const s of sales) {
            const day = Math.floor(s.sold_at / DAY);
            const d = byDay.get(day) ?? {
                total: 0,
                count: 0
            };
            d.total += s.price;
            d.count += 1;
            byDay.set(day, d);
        }
        const days: Day[] = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, d]) => ({
            day,
            average: Math.round(d.total / d.count),
            volume: d.count
        }));
        const width = 370;
        const height = 300;
        const plot = {
            left: 47,
            top: 9,
            width: 309,
            height: 267
        };
        const volume = {
            left: 47,
            top: 8,
            width: 315,
            height: 44
        };
        const ms = (day: number) => day * DAY * 1000;
        const now = Date.now();
        const min = now - ms(range);
        const last = days.length ? ms(days[days.length - 1].day) : 0;
        const max = last > min ? last : now;
        const at = (time: number) => (time - min) / (max - min);
        const shown = days.filter(d => ms(d.day) >= min);
        const earlier = days.filter(d => ms(d.day) < min);
        const traced = earlier.length ? [earlier[earlier.length - 1], ...shown] : shown;
        const axis = days.length ? priceAxis(days.map(d => d.average), height) : null;
        const x = (day: number) => plot.left + at(ms(day)) * plot.width;
        const y = (price: number) => axis ? plot.top + (axis.max - price) / (axis.max - axis.min) * plot.height : plot.top + plot.height;
        const points = shown.map(d => ({
            ...d,
            x: x(d.day),
            y: y(d.average)
        }));
        const line = traced.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.day).toFixed(1)},${y(d.average).toFixed(1)}`).join(" ");
        const yTicks = (axis ? axis.ticks : []).map(price => ({
            y: y(price),
            label: `${tickLabel(price, axis?.decimals ?? 0)} N$`
        }));
        const xTicks = dateTicks(min, max, width).map(time => {
            const d = new Date(time);
            return {
                x: plot.left + at(time) * plot.width,
                label: `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`
            };
        });
        // whole pixels, and none on the frame
        const grid = (v: number, from: number, size: number) => v > from && v < from + size ? [from + Math.floor(v - from) + 0.5] : [];
        const gridX = xTicks.flatMap(t => grid(t.x, plot.left, plot.width));
        const gridY = yTicks.flatMap(t => grid(t.y, plot.top, plot.height));
        const maxVolume = Math.max(1, ...days.map(d => d.volume)) * 1.02;
        const bars = shown.map(d => ({
            x: volume.left + at(ms(d.day)) * volume.width - 1,
            h: Math.max(2, d.volume / maxVolume * volume.height),
            volume: d.volume,
            day: d.day
        }));
        return {
            width,
            height,
            plot,
            volume,
            points,
            line,
            yTicks,
            xTicks,
            gridX,
            gridY,
            bars
        };
    });

    const dayLabel = (day: number) => new Date(day * DAY * 1000).toLocaleDateString("en-US", { timeZone: "UTC" });
</script>

<svelte:window onclick={closeGear} />

<svelte:head>
    <title>{item ? item.name : "Catalog"} - NoneRev</title>
    <link rel="stylesheet" href="/css/catalog-item.css">
</svelte:head>

{#snippet buyNow(listing: any, small: boolean)}
    {#if listing.mine}
        <button type="button" class="btn-negative" class:btn-medium={!small} class:btn-small={small} disabled={busy} onclick={() => modal = "unsell"}>Take Off Sale</button>
    {:else if item.owned}
        <span class="btn-primary btn-disabled-primary" class:btn-medium={!small} class:btn-small={small} title="You already own this item.">Buy Now</span>
    {:else}
        <button type="button" class="btn-primary PurchaseButton" class:btn-medium={!small} class:btn-small={small} disabled={busy} onclick={() => openBuy(listing)}>Buy Now</button>
    {/if}
{/snippet}

{#snippet buyButton(currency: "nonebux" | "tix")}
    <div class="buy-button" class:free={currency === "nonebux" && Number(item.price) === 0}>
        {#if item.owned}
            <span class="btn-primary btn-medium btn-disabled-primary" title="You already own this item.">{buyLabel(currency)}</span>
        {:else if !session.me}
            <a class="btn-primary btn-medium" href="/login">{buyLabel(currency)}</a>
        {:else if bcLocked}
            <span class="btn-primary btn-medium btn-disabled-primary" title="Builders Club members only">{buyLabel(currency)}</span>
        {:else}
            <button type="button" class="btn-primary btn-medium PurchaseButton" disabled={busy} onclick={() => buy(currency)}>{buyLabel(currency)}</button>
        {/if}
    </div>
{/snippet}

{#snippet pageLink(page: number, label: string)}
    {#if page === resellersPage || page < 1 || page > resellerPages}
        <span>{label}</span>
    {:else}
        <a href="#UserSalesTab" onclick={e => { e.preventDefault(); resellersPage = page; }}>{label}</a>
    {/if}
{/snippet}

{#if missing}
    <NotFound />
{:else}
    <div class="catalog-item-page">
    <main class="rbx-content">
        <UserAd size="banner" class="user-ad-top" />
        <UserAd size="skyscraper" class="user-ad-side" />
        <div class="catalog-item-body">
            {#if item}
                <div id="ItemContainer" class="text">
                    <div class="item-heading">
                        {#if gear}
                            <div class="item-options">
                                <button type="button" class="gear-button" class:open={gearOpen} aria-label="Item options" aria-expanded={gearOpen} onclick={() => gearOpen = !gearOpen}>
                                    <img src="/img/catalog/gear.png" alt="">
                                </button>
                                {#if gearOpen}
                                    <div class="gear-menu">
                                        {#if item.owned && canWear}
                                            <button type="button" disabled={busy} onclick={() => { gearOpen = false; wear(); }}>{item.wearing ? "Remove" : "Wear Item"}</button>
                                        {/if}
                                        {#if item.owned && limited}
                                            {#if resale?.listing}
                                                <button type="button" disabled={busy} onclick={() => { gearOpen = false; modal = "unsell"; }}>Take Off Sale</button>
                                            {:else}
                                                <button type="button" disabled={busy} onclick={() => { gearOpen = false; openSell(); }}>Sell</button>
                                            {/if}
                                        {/if}
                                        {#if admin}
                                            {#if item.owned && (canWear || limited)}
                                                <p class="hr"></p>
                                            {/if}
                                            <a href="/admi/catalog?edit={item.id}">Edit item</a>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                        <h1>{item.name}</h1>
                        <h3>{typeLine}</h3>
                    </div>
                    <div id="Item">
                        <div id="Details">
                            <div id="assetContainer">
                                <div id="Thumbnail">
                                    <div class="thumbnail-holder">
                                        {#if threeD !== "off"}
                                            <canvas width="320" height="320" hidden={threeD !== "on"} {@attach scene3d(`/api/catalog/${item.id}/3d`, ok => threeD = ok ? "on" : "off")}></canvas>
                                        {/if}
                                        {#if threeD !== "on"}
                                            <img src={thumb(item)} alt={item.name}>
                                        {/if}
                                    </div>
                                    {#if item.bc_only}
                                        <img src="/img/catalog/legend-bc.png" class="thumbnail-overlay bc" alt="Builders Club">
                                    {/if}
                                    {#if limitedUnique}
                                        <img src="/img/catalog/overlay-limited-unique-large.png" class="thumbnail-overlay" alt="Limited Unique">
                                    {:else if limited}
                                        <img src="/img/catalog/overlay-limited-large.png" class="thumbnail-overlay" alt="Limited">
                                    {/if}
                                    {#if item.has3d}
                                        <button type="button" class="thumb-3d" onclick={() => threeD = threeD === "off" ? "loading" : "off"}>{threeD === "off" ? "3D" : "2D"}</button>
                                    {/if}
                                </div>
                            </div>
                            <div id="Summary">
                                <div class="SummaryDetails">
                                    <div id="Creator" class="Creator">
                                        <div class="Avatar">
                                            <a href="/user?id={item.creator_id}" title={item.creator_name}><img src={headshot(item.creator_id)} alt={item.creator_name}>{#if bcBadge(item.creator_membership)}<img src={bcBadge(item.creator_membership)} class="bcOverlay" alt="Builders Club">{/if}</a>
                                        </div>
                                    </div>
                                    <div class="item-detail">
                                        <span class="stat-label">Creator:</span>
                                        <a class="stat" href="/user?id={item.creator_id}">{item.creator_name || "NoneRev"}</a>
                                        <div>
                                            <span class="stat-label">Created:</span>
                                            <span class="stat">{shortDate(item.created_at)}</span>
                                        </div>
                                        <div id="LastUpdate">
                                            <span class="stat-label">Updated:</span>
                                            <span class="stat">{ago(item.updated_at)}</span>
                                        </div>
                                    </div>
                                    <div class="DescriptionPanel">
                                        <pre class="Description body text">{description}{#if longDescription}{#if descExpanded} <a class="description-more" role="button" tabindex="0" onclick={() => descExpanded = false}>Less</a>{:else}... <a class="description-more" role="button" tabindex="0" onclick={() => descExpanded = true}>More</a>{/if}{/if}</pre>
                                    </div>
                                    <div class="ReportAbuse">
                                        <span class="AbuseButton">
                                            <a href="/abusereport?type=item&id={item.id}">Report Abuse</a>
                                        </span>
                                    </div>
                                    <div class="GearGenreContainer divider-top">
                                        <div id="GenresDiv">
                                            <div class="stat-label">Genres:</div>
                                            <div class="GenreInfo stat">
                                                <div class="AssetGenreRepeater_Container">
                                                    <div class="GamesInfoIcon All"></div>
                                                    <div>
                                                        <a href="/catalog?category=all">All</a>
                                                    </div>
                                                </div>
                                                <div class="clear"></div>
                                            </div>
                                        </div>
                                        <div class="clear"></div>
                                    </div>
                                </div>
                                <div class="BuyPriceBoxContainer">
                                    <div class="BuyPriceBox">
                                        {#if onSale(item)}
                                            {#if item.price !== null}
                                                {#if Number(item.price) === 0}
                                                    <div class="price-line free">
                                                        Price: <span class="robux-text">FREE</span>
                                                    </div>
                                                {:else}
                                                    <div class="price-line">
                                                        Price: <span class="robux">{n(item.price)}</span>
                                                    </div>
                                                {/if}
                                                {#if limitedUnique && left !== null}
                                                    <span class="Remaining">{n(left)} Remaining</span>
                                                {/if}
                                                {@render buyButton("nonebux")}
                                            {/if}
                                            {#if item.price !== null && item.tix_price !== null}
                                                <span class="RobuxAndTicketsPurchasePanel"></span>
                                            {/if}
                                            {#if item.tix_price !== null}
                                                <div class="price-line">
                                                    Price: <span class="tickets">{n(item.tix_price)}</span>
                                                </div>
                                                {#if limitedUnique && left !== null && item.price === null}
                                                    <span class="Remaining">{n(left)} Remaining</span>
                                                {/if}
                                                {@render buyButton("tix")}
                                            {/if}
                                        {:else if !limited}
                                            <div class="buy-button">
                                                <span class="btn-primary btn-medium btn-disabled-primary" title={soldOut(item) ? "This item is sold out." : "This item is no longer for sale."}>Buy with N$</span>
                                            </div>
                                        {/if}
                                        {#if limited}
                                            <div class="PrivateSalesPurchasePanel">
                                                {#if best}
                                                    <span class="Price">
                                                        Best Price: <span class="robux">{n(best.price)}</span>
                                                    </span>
                                                    {@render buyNow(best, false)}
                                                    <br>
                                                    <a class="sellers-link" href="#UserSalesTab">See all private sellers ({n(listings.length)})</a>
                                                {:else}
                                                    <span class="NoSellers">No one is currently selling this item.</span>
                                                {/if}
                                            </div>
                                        {/if}
                                        <div class="clear"></div>
                                        <div class="footnote">
                                            {#if limited}
                                                <div>( <span class="stat">{Number(item.sales ?? 0)}</span> Sold)</div>
                                            {:else}
                                                <div>(<span>{Number(item.sales ?? 0)}</span> Sold)</div>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="clear"></div>
                                    <span>
                                        <span class="FavoriteStar">{n(item.favorites)}</span>{#if session.me}<button type="button" class="favorite-toggle" disabled={favoriting} onclick={favorite}>{item.favorited ? "Unfavorite" : "Favorite"}</button>{/if}
                                    </span>
                                    {#if item.owned && item.serial_number !== null}
                                        <div class="item-status">{serialLabel(item.serial_number)}</div>
                                    {/if}
                                    {#if status}
                                        <p class="item-status" class:error={statusError} role="status">{status}</p>
                                    {/if}
                                </div>
                                <div class="clear"></div>
                            </div>
                            <div class="clear"></div>
                        </div>
                        {#if limited}
                            <div class="PrivateSales divider-top">
                                <h2>Private Sales</h2>
                                <div id="UserSalesTab">
                                    {#if !resale}
                                        <div class="empty">Loading...</div>
                                    {:else if listings.length === 0}
                                        <div class="empty">Sorry, no one is privately selling this item at the moment.</div>
                                    {:else}
                                        <table class="ItemSalesTable">
                                            <tbody>
                                                {#each pageListings as listing (listing.id)}
                                                    <tr>
                                                        <td>
                                                            <a class="seller-avatar" href="/user?id={listing.user_id}" title={listing.username}><img src={headshot(listing.user_id)} alt={listing.username}>{#if bcOverlay(listing.membership)}<img src={bcOverlay(listing.membership)} class="bcOverlay" alt="Builders Club">{/if}</a>
                                                        </td>
                                                        <td class="SellerNameAndSerial">
                                                            <p class="SellerName">
                                                                <a href="/user?id={listing.user_id}">{listing.username}</a>
                                                            </p>
                                                            <span class="robux" title="{n(listing.price)} N$">{n(listing.price)}</span>
                                                            <p class="SerialNum">{listing.serial_number !== null ? serialLabel(listing.serial_number) : "Serial N/A"}</p>
                                                        </td>
                                                        <td class="PriceBuyContainer">
                                                            {@render buyNow(listing, true)}
                                                        </td>
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    {/if}
                                    {#if resellerPages > 1}
                                        <div class="pgItemsForResale">
                                            {@render pageLink(resellersPage === 1 ? 0 : 1, "First")}&nbsp;{@render pageLink(resellersPage - 1, "Previous")}&nbsp;{#if pageBlock > 0}{@render pageLink(pageBlock, "...")}&nbsp;{/if}{#each pageNumbers as page}{@render pageLink(page, String(page))}&nbsp;{/each}{#if pageBlock + 5 < resellerPages}&nbsp;{@render pageLink(pageBlock + 6, "...")}&nbsp;{/if}{@render pageLink(resellersPage + 1, "Next")}&nbsp;{@render pageLink(resellersPage === resellerPages ? 0 : resellerPages, "Last")}&nbsp;
                                        </div>
                                    {/if}
                                </div>
                                <div class="PriceGraph divider-left">
                                    <div class="itemprice-container">
                                        <p class="header text">
                                            Recent Average Price: <span class="robux-text">{resale?.rap !== null && resale?.rap !== undefined ? `N$ ${n(resale.rap)}` : "N/A"}</span>
                                        </p>
                                        <p class="Options">
                                            {#each [30, 90, 180] as days, i}
                                                {#if i > 0}&nbsp;|&nbsp;{/if}
                                                <span id="days{days}" class:selected-text={range === days} role="button" tabindex="0" title={periodStats(days)} onclick={() => range = days}>{days} Days</span>
                                            {/each}
                                        </p>
                                        <div class="itemprice-placeholder">
                                            <svg viewBox="0 0 {chart.width} {chart.height}" role="img" aria-label="Price chart">
                                                <rect class="plot" x={chart.plot.left} y={chart.plot.top} width={chart.plot.width} height={chart.plot.height}></rect>
                                                {#each chart.gridY as y}
                                                    <line class="grid" x1={chart.plot.left} x2={chart.plot.left + chart.plot.width} y1={y} y2={y}></line>
                                                {/each}
                                                {#each chart.gridX as x}
                                                    <line class="grid" x1={x} x2={x} y1={chart.plot.top} y2={chart.plot.top + chart.plot.height}></line>
                                                {/each}
                                                {#each chart.yTicks as tick}
                                                    <text class="axis" x={chart.plot.left - 5} y={tick.y + 4} text-anchor="end">{tick.label}</text>
                                                {/each}
                                                {#each chart.xTicks as tick}
                                                    <text class="axis" x={tick.x} y={chart.height - 7} text-anchor="middle">{tick.label}</text>
                                                {/each}
                                                <clipPath id="price-plot">
                                                    <rect x={chart.plot.left} y={chart.plot.top} width={chart.plot.width} height={chart.plot.height}></rect>
                                                </clipPath>
                                                {#if chart.points.length}
                                                    <g clip-path="url(#price-plot)">
                                                        <path class="line-shadow" d={chart.line} transform="translate(0.52 2.95)"></path>
                                                        <path class="line-shadow thin" d={chart.line} transform="translate(0.39 2.22)"></path>
                                                        <path class="line" d={chart.line}></path>
                                                    </g>
                                                    {#each chart.points as p}
                                                        <circle class="dot" cx={p.x} cy={p.y} r="3">
                                                            <title>{dayLabel(p.day)}: N$ {n(p.average)} ({p.volume} sold)</title>
                                                        </circle>
                                                    {/each}
                                                {:else}
                                                    <text class="empty-text" x={chart.plot.left + chart.plot.width / 2} y={chart.plot.top + chart.plot.height / 2} text-anchor="middle">No sales in the last {range} days</text>
                                                {/if}
                                                <rect class="frame" x={chart.plot.left - 1} y={chart.plot.top - 1} width={chart.plot.width + 2} height={chart.plot.height + 2}></rect>
                                                <rect class="legend" x={chart.plot.left + 5} y={chart.plot.top + 5} width="123" height="23"></rect>
                                                <rect class="swatch-box" x={chart.plot.left + 8.5} y={chart.plot.top + 9.5} width="17" height="13"></rect>
                                                <rect class="swatch price" x={chart.plot.left + 10} y={chart.plot.top + 11} width="14" height="10"></rect>
                                                <text class="legend-text" x={chart.plot.left + 30} y={chart.plot.top + 20}>Avg Sales Price (N$)</text>
                                            </svg>
                                        </div>
                                        <div class="itemprice-volumegraph">
                                            <svg viewBox="0 0 {chart.width} 60" role="img" aria-label="Volume chart">
                                                <rect class="plot" x={chart.volume.left} y={chart.volume.top} width={chart.volume.width} height={chart.volume.height}></rect>
                                                {#each chart.bars as bar}
                                                    <rect class="bar" x={bar.x} y={chart.volume.top + chart.volume.height - bar.h} width="2" height={bar.h}>
                                                        <title>{dayLabel(bar.day)}: {bar.volume} sold</title>
                                                    </rect>
                                                {/each}
                                                <rect class="frame" x={chart.volume.left - 1} y={chart.volume.top - 1} width={chart.volume.width + 2} height={chart.volume.height + 2}></rect>
                                                <rect class="legend" x={chart.volume.left + 5} y={chart.volume.top + 5} width="65" height="23"></rect>
                                                <rect class="swatch-box" x={chart.volume.left + 8.5} y={chart.volume.top + 9.5} width="17" height="13"></rect>
                                                <rect class="swatch volume" x={chart.volume.left + 10} y={chart.volume.top + 11} width="14" height="10"></rect>
                                                <text class="legend-text" x={chart.volume.left + 30} y={chart.volume.top + 20}>Volume</text>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div class="clear"></div>
                            </div>
                        {/if}
                        <div id="Tabs">
                            <ul id="TabHeader" class="WhiteSquareTabsContainer">
                                <li class="SquareTabGray ItemTabs" class:selected={tab === "recommendations"}>
                                    <span>
                                        <a href="#RecommendationsTab" onclick={e => { e.preventDefault(); tab = "recommendations"; }}>Recommendations</a>
                                    </span>
                                </li>
                                <li class="SquareTabGray ItemTabs" class:selected={tab === "commentary"}>
                                    <span>
                                        <a href="#CommentaryTab" onclick={e => { e.preventDefault(); tab = "commentary"; }}>Commentary</a>
                                    </span>
                                </li>
                            </ul>
                            <div class="StandardPanelContainer">
                                <div id="RecommendationsTab" class="StandardPanelWhite TabContent" class:selected={tab === "recommendations"}>
                                    <div class="AssetRecommenderContainer">
                                        <div class="recommended-grid">
                                            {#each recommended?.items ?? [] as rec (rec.id)}
                                                <div class="PortraitDiv">
                                                    <div class="AssetThumbnail">
                                                        <a href={itemUrl(rec)} title={rec.name}>
                                                            <img src={thumb(rec)} alt={rec.name}>
                                                        </a>
                                                    </div>
                                                    <div class="AssetDetails">
                                                        <div class="AssetName">
                                                            <a href={itemUrl(rec)}>{rec.name}</a>
                                                        </div>
                                                        <div class="AssetCreator">
                                                            <span class="stat-label">Creator:</span>
                                                            <span class="Detail stat"><a href="/user?id={rec.creator_id}">{rec.creator_name || "NoneRev"}</a></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                </div>
                                <div id="CommentaryTab" class="StandardPanelWhite TabContent" class:selected={tab === "commentary"}>
                                    <Comments kind="item" target={id} />
                                </div>
                            </div>
                        </div>
                        {#if recommended?.others?.length}
                            <div id="FreeGames">
                                <div class="SEOLinksContainer">
                                    <span><b>Other free games and items:</b></span>
                                    <ul class="freegames">
                                        {#each recommended.others as other}
                                            <li>
                                                <a href={other.kind === "game" ? `/game?id=${other.id}` : `/catalog/item?id=${other.id}`} title={other.name}>{other.name}</a>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            </div>
                        {/if}
                    </div>
                    <div class="clear"></div>
                </div>
            {/if}
        </div>
    </main>

    {#if modal && item}
        <div class="SellItemModal" role="dialog" aria-modal="true">
            <div class="PurchaseModal">
                <div class="titleBar">
                    {#if modal === "sell"}
                        Sell Your Collectible Item
                    {:else if modal === "unsell"}
                        Take Off Sale.
                    {:else}
                        Buy Item
                    {/if}
                </div>
                <div class="PurchaseModalBody">
                    <div class="PurchaseModalMessage">
                        <div class="PurchaseModalMessageImage">
                            <img src={thumb(item)} alt={item.name}>
                        </div>
                        {#if modal === "sell" && session.me?.membership === "None"}
                            <div class="PurchaseModalMessageText centered">
                                <div>
                                    Only Builders, Turbo Builders, and Outrageous Builders Club members
                                    <br>
                                    may re-sell collectible items for Nonebux
                                </div>
                            </div>
                        {:else if modal === "sell"}
                            <div class="PurchaseModalMessageText">
                                <div class="sell-row">
                                    Sell your <b>{item.name}</b> for:
                                </div>
                                <div class="sell-row">
                                    <span class="robux"></span>
                                    <input type="text" class="text-box" inputmode="numeric" bind:value={sellPrice} aria-label="Price">
                                </div>
                                <table class="sell-summary">
                                    <tbody>
                                        <tr>
                                            <td>Price:</td>
                                            <td class="lblSellValue">
                                                {#if Number.isFinite(sellValue)}
                                                    <span class="robux">{n(sellValue)}</span>
                                                {/if}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Marketplace Fee ({Math.round(fee * 100)}%):</td>
                                            <td class="lblCommision">
                                                {#if sellFee > 0}
                                                    <span class="robux">{n(sellFee)}</span>
                                                {/if}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>You will receive:</td>
                                            <td class="lblLeftover">
                                                {#if sellFee > 0}
                                                    <span class="robux">{n(sellValue - sellFee)}</span>
                                                {/if}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                {#if sellError}
                                    <p class="error-message">{sellError}</p>
                                {/if}
                            </div>
                        {:else if modal === "unsell"}
                            <div class="PurchaseModalMessageText centered">
                                <span>Are you sure you want to take the Item off sale?</span>
                            </div>
                        {:else}
                            <div class="PurchaseModalMessageText centered">
                                Would you like to buy the <b>{item.name}</b> from <b>{buying.username}</b> for <span class="robux">{n(buying.price)}</span>?
                            </div>
                        {/if}
                    </div>
                    <div class="PurchaseModalButtonContainer">
                        {#if modal === "sell" && session.me?.membership === "None"}
                            <a href="/premium/membership" class="btn-medium btn-primary">Get BC Today</a>
                        {:else if modal === "sell"}
                            <button type="button" class="btn-medium btn-primary" disabled={!Number.isFinite(sellValue) || sellValue <= 0} onclick={sell}>Sell Now</button>
                        {:else if modal === "unsell"}
                            <button type="button" class="btn-medium btn-primary" onclick={unsell}>Take Off Sale</button>
                        {:else}
                            <button type="button" class="btn-medium btn-primary" onclick={buyResale}>Buy Now</button>
                        {/if}
                        <button type="button" class="btn-medium btn-negative" onclick={() => modal = ""}>Cancel</button>
                    </div>
                    <div class="PurchaseModalFooter footnote">
                        {#if modal === "buy" && session.me}
                            Your balance after this transaction will be <span class="robux">{n(session.me.currency - buying.price)}</span>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
    </div>
{/if}
