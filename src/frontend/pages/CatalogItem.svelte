<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";
    import { n, ago, shortDate, itemUrl, thumb, isLimited, remaining, soldOut, onSale } from "../catalog";
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
    const typeLine = $derived(item ? `NoneRev ${item.category}${limited ? " / Collectible Item / Limited Edition" : ""}` : "");
    const longDescription = $derived(item ? String(item.description ?? "").length > 150 : false);
    const description = $derived(item ? (longDescription && !descExpanded ? String(item.description).slice(0, 147) : item.description || "No description available.") : "");
    const listings = $derived<any[]>(resale?.listings ?? []);
    const resellerPages = $derived(Math.max(1, Math.ceil(listings.length / RESELLERS_PER_PAGE)));
    const pageListings = $derived(listings.slice((resellersPage - 1) * RESELLERS_PER_PAGE, resellersPage * RESELLERS_PER_PAGE));
    const best = $derived<any>(listings.find((l: any) => !l.mine) ?? listings[0] ?? null);
    const period = $derived(resale ? resale.periods.find((p: any) => p.days === range) : null);
    const fee = $derived(resale?.fee ?? 0.3);
    const sellValue = $derived(/^\d+$/.test(sellPrice.trim()) ? Number(sellPrice.trim()) : NaN);
    const sellFee = $derived(Number.isFinite(sellValue) && sellValue > 0 ? Math.max(1, Math.round(sellValue * fee)) : 0);
    const sellError = $derived(sellPrice.trim() !== "" && (!Number.isFinite(sellValue) || sellValue <= 0) ? "Price must be a positive integer." : "");
    const serialLabel = (serial: number) => `Serial #${n(serial)}${item.limited_stock !== null ? ` of ${n(item.limited_stock)}` : ""}`;
    const headshot = (userId: number) => `/api/user/getProfilePicture?userId=${userId}&type=headshot`;
    const bcOverlay = (membership: string) => membership === "TBC" ? "/img/catalog/overlay-tbc-small.png" : membership === "BC" || membership === "OBC" ? "/img/catalog/overlay-bc-small.png" : "";

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
        if (!session.me) {
            router.go("/login");
            return;
        }
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

    const chart = $derived.by(() => {
        const sales: any[] = resale?.sales ?? [];
        const end = Math.floor(Date.now() / 1000 / DAY);
        const start = end - range + 1;
        const byDay = new Map<number, DayTotal>();
        for (const s of sales) {
            const day = Math.floor(s.sold_at / DAY);
            if (day < start) {
                continue;
            }
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
        const pad = {
            left: 44,
            right: 8,
            top: 6,
            bottom: 22
        };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const maxPrice = Math.max(1, ...days.map(d => d.average));
        const maxVolume = Math.max(1, ...days.map(d => d.volume));
        const x = (day: number) => pad.left + (day - start) / Math.max(1, range - 1) * plotW;
        const y = (price: number) => pad.top + plotH - price / maxPrice * plotH;
        const points = days.map(d => ({
            ...d,
            x: x(d.day),
            y: y(d.average)
        }));
        const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const yTicks = (points.length ? [0.25, 0.5, 0.75, 1] : []).map(f => ({
            y: pad.top + plotH - f * plotH,
            label: n(Math.round(maxPrice * f))
        }));
        const xTicks = [0, 1, 2, 3].map(i => {
            const day = start + Math.round(i * (range - 1) / 3);
            const d = new Date(day * DAY * 1000);
            return {
                x: x(day),
                label: `${d.getMonth() + 1}/${d.getDate()}`
            };
        });
        const volumeH = 60;
        const barW = Math.max(2, Math.min(10, plotW / range - 1));
        const bars = days.map(d => ({
            x: x(d.day) - barW / 2,
            h: Math.max(2, d.volume / maxVolume * (volumeH - 24)),
            volume: d.volume,
            day: d.day
        }));
        return {
            width,
            height,
            pad,
            plotW,
            plotH,
            points,
            line,
            yTicks,
            xTicks,
            volumeH,
            barW,
            bars
        };
    });

    const dayLabel = (day: number) => new Date(day * DAY * 1000).toLocaleDateString("en-US");
</script>

<svelte:head>
    <title>{item ? item.name : "Catalog"} - NoneRev</title>
    <link rel="stylesheet" href="/css/catalog-item.css">
</svelte:head>

{#snippet buyNow(listing: any, small: boolean)}
    {#if listing.mine}
        <div class="UserOwns">You own this item.</div>
    {:else if item.owned}
        <span class="btn-primary btn-disabled-primary" class:btn-medium={!small} class:btn-small={small} title="You already own this item.">Buy Now</span>
    {:else}
        <button type="button" class="btn-primary PurchaseButton" class:btn-medium={!small} class:btn-small={small} disabled={busy} onclick={() => openBuy(listing)}>Buy Now</button>
    {/if}
{/snippet}

{#if missing}
    <NotFound />
{:else}
    <div class="catalog-item-page">
    <main class="rbx-content">
        <div class="catalog-item-body">
            {#if item}
                <div id="ItemContainer" class="text">
                    <div class="item-heading">
                        <h1>{item.name}</h1>
                        <h3>{typeLine}</h3>
                    </div>
                    <div id="Item">
                        <div id="Details">
                            <div id="assetContainer">
                                <div id="Thumbnail">
                                    <div class="thumbnail-holder">
                                        <img src={thumb(item)} alt={item.name}>
                                    </div>
                                    {#if item.bc_only}
                                        <img src="/img/catalog/legend-bc.png" class="thumbnail-overlay bc" alt="Builders Club">
                                    {/if}
                                    {#if limitedUnique}
                                        <img src="/img/catalog/overlay-limited-unique-large.png" class="thumbnail-overlay" alt="Limited Unique">
                                    {:else if limited}
                                        <img src="/img/catalog/overlay-limited-large.png" class="thumbnail-overlay" alt="Limited">
                                    {/if}
                                </div>
                            </div>
                            <div id="Summary">
                                <div class="SummaryDetails">
                                    <div id="Creator" class="Creator">
                                        <div class="Avatar">
                                            <a href="/user?id={item.creator_id}" title={item.creator_name}>
                                                <img src={headshot(item.creator_id)} alt={item.creator_name}>
                                                {#if bcOverlay(item.creator_membership)}
                                                    <img src={bcOverlay(item.creator_membership)} class="bcOverlay" alt="Builders Club">
                                                {/if}
                                            </a>
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
                                            </div>
                                        </div>
                                        <div class="clear"></div>
                                    </div>
                                </div>
                                <div class="BuyPriceBoxContainer">
                                    <div class="BuyPriceBox">
                                        {#if onSale(item)}
                                            <span class="Price">
                                                Price:
                                                {#if item.price !== null}
                                                    <span class="robux">{Number(item.price) === 0 ? "Free" : n(item.price)}</span>
                                                {/if}
                                                {#if item.tix_price !== null}
                                                    <span class="tickets">{n(item.tix_price)}</span>
                                                {/if}
                                            </span>
                                            {#if limitedUnique && left !== null}
                                                <span class="Remaining">{n(left)} Remaining</span>
                                            {/if}
                                            {#if item.owned}
                                                <span class="btn-primary btn-medium btn-disabled-primary" title="You already own this item.">Buy Now</span>
                                            {:else if !session.me}
                                                <a class="btn-primary btn-medium" href="/login">Buy Now</a>
                                            {:else if bcLocked}
                                                <span class="btn-primary btn-medium btn-disabled-primary" title="Builders Club members only">Buy Now</span>
                                            {:else}
                                                {#if item.price !== null}
                                                    <button type="button" class="btn-primary btn-medium PurchaseButton" disabled={busy} onclick={() => buy("nonebux")}>Buy Now</button>
                                                {/if}
                                                {#if item.tix_price !== null}
                                                    {#if item.price !== null}
                                                        <span class="RobuxAndTicketsPurchasePanel"></span>
                                                    {/if}
                                                    <button type="button" class="btn-primary btn-medium PurchaseButton" disabled={busy} onclick={() => buy("tix")}>Buy with Tix</button>
                                                {/if}
                                            {/if}
                                        {:else if !limited}
                                            <span class="btn-primary btn-medium btn-disabled-primary" title={soldOut(item) ? "This item is sold out." : "This item is no longer for sale."}>Buy Now</span>
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
                                            <div>(<span class="stat">{n(item.sales)}</span> Sold)</div>
                                        </div>
                                    </div>
                                    <div class="clear"></div>
                                    <span>
                                        <button type="button" class="FavoriteStar" class:active={item.favorited} disabled={favoriting} aria-pressed={!!item.favorited} title={item.favorited ? "Remove from favorites" : "Add to favorites"} onclick={favorite}>{n(item.favorites)}</button>
                                    </span>
                                    {#if item.owned}
                                        <div class="owner-actions">
                                            {#if canWear}
                                                <button type="button" class="btn-neutral btn-medium" disabled={busy} onclick={wear}>{item.wearing ? "Remove" : "Wear Item"}</button>
                                            {/if}
                                            {#if limited}
                                                {#if resale?.listing}
                                                    <button type="button" class="btn-negative btn-medium" id="TakeOffSale" disabled={busy} onclick={() => modal = "unsell"}>Take Off Sale</button>
                                                {:else}
                                                    <button type="button" class="btn-neutral btn-medium PutItemUpForSaleBtn" disabled={busy} onclick={openSell}>Sell</button>
                                                {/if}
                                            {/if}
                                            {#if item.serial_number !== null}
                                                <div class="item-status">{serialLabel(item.serial_number)}</div>
                                            {/if}
                                        </div>
                                    {/if}
                                    {#if status}
                                        <p class="item-status" class:error={statusError} role="status">{status}</p>
                                    {/if}
                                    {#if session.me && session.me.admin > 0}
                                        <a class="admin-link" href="/admi/catalog?edit={item.id}">Edit item</a>
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
                                                            <a class="seller-avatar" href="/user?id={listing.user_id}" title={listing.username}>
                                                                <img src={headshot(listing.user_id)} alt={listing.username}>
                                                                {#if bcOverlay(listing.membership)}
                                                                    <img src={bcOverlay(listing.membership)} class="bcOverlay" alt="Builders Club">
                                                                {/if}
                                                            </a>
                                                        </td>
                                                        <td class="SellerNameAndSerial">
                                                            <p class="SellerName">
                                                                <a href="/user?id={listing.user_id}">{listing.username}</a>
                                                            </p>
                                                            <span class="robux" title="{n(listing.price)} N$">{n(listing.price)}</span>
                                                            {#if listing.serial_number !== null}
                                                                <p class="SerialNum">{serialLabel(listing.serial_number)}</p>
                                                            {/if}
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
                                            <a href="#UserSalesTab" disabled={resellersPage === 1 || undefined} onclick={e => { e.preventDefault(); resellersPage = 1; }}>First</a>
                                            <a href="#UserSalesTab" disabled={resellersPage === 1 || undefined} onclick={e => { e.preventDefault(); resellersPage -= 1; }}>Previous</a>
                                            <span>{resellersPage}</span>
                                            <a href="#UserSalesTab" disabled={resellersPage === resellerPages || undefined} onclick={e => { e.preventDefault(); resellersPage += 1; }}>Next</a>
                                            <a href="#UserSalesTab" disabled={resellersPage === resellerPages || undefined} onclick={e => { e.preventDefault(); resellersPage = resellerPages; }}>Last</a>
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
                                                <span id="days{days}" class:selected-text={range === days} role="button" tabindex="0" onclick={() => range = days}>{days} Days</span>
                                            {/each}
                                        </p>
                                        <div class="itemprice-placeholder">
                                            <svg viewBox="0 0 {chart.width} {chart.height}" role="img" aria-label="Price chart">
                                                <rect class="frame" x={chart.pad.left} y={chart.pad.top} width={chart.plotW} height={chart.plotH}></rect>
                                                {#each chart.yTicks as tick}
                                                    <line class="grid" x1={chart.pad.left} x2={chart.width - chart.pad.right} y1={tick.y} y2={tick.y}></line>
                                                    <text class="axis" x={chart.pad.left - 5} y={tick.y + 3} text-anchor="end">{tick.label}</text>
                                                    <text class="axis" x={chart.pad.left - 5} y={tick.y + 14} text-anchor="end">N$</text>
                                                {/each}
                                                {#each chart.xTicks as tick}
                                                    <line class="grid" x1={tick.x} x2={tick.x} y1={chart.pad.top} y2={chart.pad.top + chart.plotH}></line>
                                                    <text class="axis" x={tick.x} y={chart.height - 6} text-anchor="middle">{tick.label}</text>
                                                {/each}
                                                {#if chart.points.length}
                                                    <path class="line" d={chart.line}></path>
                                                    {#each chart.points as p}
                                                        <circle class="dot" cx={p.x} cy={p.y} r="3">
                                                            <title>{dayLabel(p.day)}: N$ {n(p.average)} ({p.volume} sold)</title>
                                                        </circle>
                                                    {/each}
                                                {:else}
                                                    <text class="empty-text" x={chart.pad.left + chart.plotW / 2} y={chart.pad.top + chart.plotH / 2} text-anchor="middle">No sales in the last {range} days</text>
                                                {/if}
                                                <rect class="legend" x={chart.pad.left + 6} y={chart.pad.top + 6} width="124" height="16"></rect>
                                                <rect class="swatch price" x={chart.pad.left + 10} y={chart.pad.top + 10} width="8" height="8"></rect>
                                                <text class="legend-text" x={chart.pad.left + 22} y={chart.pad.top + 18}>Avg Sales Price (N$)</text>
                                            </svg>
                                        </div>
                                        <div class="itemprice-volumegraph">
                                            <svg viewBox="0 0 {chart.width} {chart.volumeH}" role="img" aria-label="Volume chart">
                                                <rect class="frame" x={chart.pad.left} y="1" width={chart.plotW} height={chart.volumeH - 2}></rect>
                                                {#each chart.bars as bar}
                                                    <rect class="bar" x={bar.x} y={chart.volumeH - 2 - bar.h} width={chart.barW} height={bar.h}>
                                                        <title>{dayLabel(bar.day)}: {bar.volume} sold</title>
                                                    </rect>
                                                {/each}
                                                <rect class="legend" x={chart.pad.left + 6} y="5" width="52" height="16"></rect>
                                                <rect class="swatch volume" x={chart.pad.left + 10} y="9" width="8" height="8"></rect>
                                                <text class="legend-text" x={chart.pad.left + 22} y="17">Volume</text>
                                            </svg>
                                        </div>
                                        <div class="pricestats-wrap">
                                            <p class="pricestats">
                                                {#if period}
                                                    <span class="selected-text">
                                                        {range} Day Avg Price:
                                                        <span class="robux-text">
                                                            {period.average !== null ? `${n(period.average)} N$` : "0 N$"}
                                                            {#if period.change !== null}
                                                                (<span class:up={period.change >= 0} class:down={period.change < 0}>{period.change >= 0 ? "+" : ""}{period.change}%</span>)
                                                            {/if}
                                                        </span>
                                                        &nbsp;&nbsp; Volume: <b>{n(period.volume)}</b>
                                                    </span>
                                                {/if}
                                            </p>
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
                                        <div class="recommended-row">
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
