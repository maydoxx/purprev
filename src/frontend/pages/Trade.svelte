<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const me = session.me!;
    const MAX_ITEMS = 8;
    const PAGE_SIZE = 14;
    const types: Record<string, string> = {
        inbound: "Inbound",
        outbound: "Outbound",
        completed: "Completed",
        inactive: "Inactive"
    };
    const statuses: Record<string, string> = {
        pending: "Pending",
        completed: "Completed",
        declined: "Declined",
        cancelled: "Cancelled",
        expired: "Expired",
        countered: "Countered"
    };
    const slugs: Record<string, string> = {
        Hat: "hats",
        Face: "faces",
        "T-Shirt": "t-shirts",
        Shirt: "shirts",
        Pants: "pants",
        Gear: "gear",
        Package: "packages"
    };
    const categoryOptions: [string, string][] = [
        ["all", "All Items"],
        ["hats", "Accessory | Hats"],
        ["faces", "Faces"],
        ["gear", "Gear"],
        ["shirts", "Shirts"],
        ["t-shirts", "T-Shirts"],
        ["pants", "Pants"],
        ["packages", "Packages"]
    ];

    const view = $derived(Number(router.query.view) || 0);
    const counter = $derived(Number(router.query.counter) || 0);
    const withId = $derived(Number(router.query.with) || 0);
    const type = $derived(router.query.type! in types ? router.query.type! : "inbound");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const mode = $derived(view > 0 ? "view" : withId > 0 || counter > 0 ? "window" : "list");

    let error = $state("");
    let helpOpen = $state(false);
    let busy = $state(false);

    let list = $state<any>(null);

    let trade = $state<any>(null);
    let tradeMissing = $state(false);

    let partner = $state<any>(null);
    let windowDone = $state(false);
    let mine = $state<any[]>([]);
    let theirs = $state<any[]>([]);
    let offer = $state<number[]>([]);
    let request = $state<number[]>([]);
    let filter = $state({
        mine: {
            page: 1,
            category: "all"
        },
        partner: {
            page: 1,
            category: "all"
        }
    });

    const showList = $derived(mode === "list" || (mode === "window" && windowDone && !partner));
    const isLimited = (item: any) => item.is_limited || item.is_limited_unique;

    $effect(() => {
        if (!showList) return;
        list = null;
        api(`/trade?type=${type}&page=${page}`).then(d => {
            list = Array.isArray(d.trades) ? d : {
                trades: [],
                totalPages: 1,
                inboundCount: 0
            };
        }).catch(err => {
            error = err.message;
        });
    });

    $effect(() => {
        if (mode !== "view") return;
        trade = null;
        tradeMissing = false;
        api(`/trade/${view}`).then(d => {
            const ok = d.id && (d.sender_id === me.id || d.receiver_id === me.id);
            trade = ok ? d : null;
            tradeMissing = !ok;
        }).catch(() => {
            tradeMissing = true;
        });
    });

    $effect(() => {
        if (mode !== "window") return;
        error = "";
        partner = null;
        windowDone = false;
        mine = [];
        theirs = [];
        offer = [];
        request = [];
        openWindow(withId, counter);
    });

    const openWindow = async (partnerId: number, counterId: number) => {
        if (counterId > 0) {
            const t = await api(`/trade/${counterId}`).catch(() => null);
            if (t && t.id && t.status === "pending" && t.receiver_id === me.id) {
                partnerId = t.sender_id;
                offer = t.request.map((i: any) => i.id);
                request = t.offer.map((i: any) => i.id);
            } else {
                error = "That trade can no longer be countered.";
            }
        }

        if (partnerId === me.id) {
            error = "You cannot trade with yourself.";
            windowDone = true;
            return;
        }

        if (partnerId > 0) {
            // TODO: no route for both limited inventories yet, expects {mine, theirs}
            const [p, inv] = await Promise.all([
                api(`/user/profile/${partnerId}`).catch(() => null),
                api(`/trade?with=${partnerId}`).catch(() => ({}))
            ]);
            if (p && p.username) {
                partner = {
                    id: partnerId,
                    username: p.username
                };
            }
            mine = Array.isArray(inv.mine) ? inv.mine.filter(isLimited) : [];
            theirs = Array.isArray(inv.theirs) ? inv.theirs.filter(isLimited) : [];
        }
        windowDone = true;
    };

    const toggle = (side: "offer" | "request", id: number) => {
        const ids = side === "offer" ? offer : request;
        const next = ids.includes(id) ? ids.filter(x => x !== id) : ids.length < MAX_ITEMS ? [...ids, id] : ids;
        if (side === "offer") offer = next;
        else request = next;
    };

    const find = (items: any[], id: number) => items.find(i => i.id === id);
    const value = (items: any[]) => items.reduce((sum, i) => sum + Math.max(0, Number(i?.price ?? 0)), 0);
    const slug = (item: any) => slugs[item.category] ?? "all";

    const filtered = (owner: "mine" | "partner") => {
        const items = owner === "mine" ? mine : theirs;
        const cat = filter[owner].category;
        return items.filter(i => cat === "all" || slug(i) === cat);
    };
    const pages = (owner: "mine" | "partner") => Math.max(1, Math.ceil(filtered(owner).length / PAGE_SIZE));
    const visible = (owner: "mine" | "partner") => {
        const p = Math.min(filter[owner].page, pages(owner));
        return filtered(owner).slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
    };
    const flip = (owner: "mine" | "partner", dir: number) => {
        filter[owner].page = Math.min(pages(owner), Math.max(1, filter[owner].page + dir));
    };

    const send = async () => {
        if (!offer.length || !request.length) {
            alert("Choose at least one item on each side.");
            return;
        }
        busy = true;
        try {
            await api("/trade", {
                receiver_id: partner.id,
                offer_items: offer,
                request_items: request,
                ...(counter > 0 ? { counter_of: counter } : {})
            });
            router.go("/trade?type=outbound&sent=1");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const act = async (action: string, next: string) => {
        busy = true;
        try {
            await api(`/trade/${trade.id}/${action}`, {});
            router.go(`/trade?type=${next}&${action}=1`);
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const date = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    const label = (s: string) => statuses[s] ?? s;
    const money = (v: number) => "N$" + v.toLocaleString();
    const thumb = (item: any) => item.thumbnail || "/img/pending.png";
    const overlay = (item: any) => item.is_limited_unique ? "/img/catalog/overlay-limited-unique.png" : item.is_limited ? "/img/catalog/overlay-limited.png" : "";
    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const fallback = (e: Event) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = "/img/pending.png";
    };
</script>

<svelte:head>
    <title>Trade - NoneRev</title>
    <link rel="stylesheet" href="/css/trade.css">
</svelte:head>

{#snippet thumbs(item: any)}
    <span>{item.name}</span>
    <img class="trade-item-thumb" src={thumb(item)} alt={item.name} onerror={fallback}>
    {#if overlay(item)}
        <img class="trade-limited-overlay" src={overlay(item)} alt={item.is_limited_unique ? "Limited U" : "Limited"}>
    {/if}
{/snippet}

{#snippet section(title: string, items: any[])}
    <div class="trade-request-section">
        <div class="trade-request-section-head">
            <strong>{title}</strong>
            <span>Value: <b>{money(value(items))}</b></span>
        </div>
        <div class="trade-request-grid">
            {#each items as item}
                <a class="trade-request-item" href="/catalog/item?id={item.id}">
                    {@render thumbs(item)}
                </a>
            {/each}
        </div>
    </div>
{/snippet}

{#snippet slots(side: "offer" | "request", items: any[])}
    {@const ids = side === "offer" ? offer : request}
    <div class="trade-slot-grid">
        {#each { length: MAX_ITEMS } as _, i}
            {@const item = ids[i] ? find(items, ids[i]) : null}
            <button type="button" class="trade-slot" class:filled={item} onclick={() => item && toggle(side, item.id)}>
                {#if item}
                    <img src={thumb(item)} alt={item.name}>
                    <span>{item.name}</span>
                {/if}
            </button>
        {/each}
    </div>
{/snippet}

{#snippet inventory(owner: "mine" | "partner", title: string, empty: string)}
    {@const side = owner === "mine" ? "offer" : "request"}
    {@const ids = owner === "mine" ? offer : request}
    <section class="trade-inventory-section" class:trade-partner-inventory={owner === "partner"}>
        <div class="trade-inventory-head">
            <strong>{title}</strong>
            <label>Category:
                <select class="trade-category-filter" bind:value={filter[owner].category} onchange={() => filter[owner].page = 1}>
                    {#each categoryOptions as [value, text]}
                        <option {value}>{text}</option>
                    {/each}
                </select>
            </label>
        </div>
        <div class="trade-inventory-grid">
            {#each visible(owner) as item (item.id)}
                <button type="button" class="trade-inventory-item" class:selected={ids.includes(item.id)} onclick={() => toggle(side, item.id)}>
                    {@render thumbs(item)}
                </button>
            {/each}
        </div>
        {#if filtered(owner).length === 0}
            <div class="trade-inventory-empty" style="display: block">{empty}</div>
        {/if}
        <div class="trade-page-controls">
            <button type="button" disabled={filter[owner].page <= 1} onclick={() => flip(owner, -1)}>◀</button>
            <span>Page {Math.min(filter[owner].page, pages(owner))}</span>
            <button type="button" disabled={filter[owner].page >= pages(owner)} onclick={() => flip(owner, 1)}>▶</button>
        </div>
    </section>
{/snippet}

<main class="trade-legacy">
    {#if error}
        <div class="trade-alert">{error}</div>
    {/if}

    {#if mode === "view"}
        {#if tradeMissing}
            <div class="trade-empty-panel">Trade not found.</div>
        {:else if trade}
            {@const isSender = trade.sender_id === me.id}
            {@const otherId = isSender ? trade.receiver_id : trade.sender_id}
            {@const otherName = isSender ? trade.receiver_name : trade.sender_name}
            {@const give = isSender ? trade.offer : trade.request}
            {@const receive = isSender ? trade.request : trade.offer}
            {@const days = Math.max(0, Math.ceil(Math.max(0, trade.expires_at - Date.now() / 1000) / 86400))}
            <section class="trade-request-view">
                <div class="trade-request-title">Trade Request</div>
                <div class="trade-request-body">
                    <aside class="trade-request-partner">
                        <img src={pic(otherId)} alt={otherName} onerror={fallback}>
                        <div>Trade with <a href="/user?id={otherId}">{otherName}</a> has been opened.</div>
                        {#if trade.status === "pending"}
                            <p>Expires in {days} day{days === 1 ? "" : "s"}.</p>
                        {:else}
                            <p>{label(trade.status)}</p>
                        {/if}
                    </aside>

                    <div class="trade-request-items-wrap">
                        {@render section("ITEMS YOU WILL GIVE", give)}
                        <div class="trade-swap-mark">↕</div>
                        {@render section("ITEMS YOU WILL RECEIVE", receive)}

                        {#if trade.status === "pending"}
                            <div class="trade-request-actions">
                                {#if !isSender}
                                    <button class="trade-action-blue" type="button" disabled={busy} onclick={() => act("accept", "completed")}>Accept</button>
                                    <a class="trade-action-blue" href="/trade?with={trade.sender_id}&counter={trade.id}">Counter</a>
                                    <button class="trade-action-gray" type="button" disabled={busy} onclick={() => act("decline", "inactive")}>Decline</button>
                                {:else}
                                    <button class="trade-action-gray" type="button" disabled={busy} onclick={() => act("cancel", "inactive")}>Cancel Trade</button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
                <div class="trade-request-back"><a href="/trade">Back to Trades</a></div>
            </section>
        {/if}

    {:else if partner}
        <section class="trade-window">
            <div class="trade-window-topline">
                <div><strong>TRADING</strong> with <a href="/user?id={partner.id}">{partner.username}</a></div>
                <a class="trade-exit" href="/trade">Exit Trading <span>×</span></a>
            </div>

            <form onsubmit={e => { e.preventDefault(); send(); }}>
                <div class="trade-window-layout">
                    <aside class="trade-offer-panel">
                        <div class="trade-offer-block">
                            <div class="trade-offer-head"><strong>Your Offer</strong><span>Value: <b>{money(value(offer.map(id => find(mine, id))))}</b></span></div>
                            {@render slots("offer", mine)}
                        </div>
                        <div class="trade-offer-block trade-request-block">
                            <div class="trade-offer-head"><strong>Your Request</strong><span>Value: <b>{money(value(request.map(id => find(theirs, id))))}</b></span></div>
                            {@render slots("request", theirs)}
                        </div>
                        <button class="trade-send-request" type="submit" disabled={busy}>Send Request</button>
                    </aside>

                    <div class="trade-inventory-side">
                        {@render inventory("mine", "Your Inventory", "You do not have any Limited items in this category.")}
                        {@render inventory("partner", `${partner.username}'s Inventory`, `${partner.username} does not have any Limited items in this category.`)}
                    </div>
                </div>
            </form>
        </section>

    {:else if showList}
        <section class="trade-list-page">
            <div class="trade-money-tabs">
                <span>Offers</span>
                <span>Summary</span>
                <span class="active">Trade Items</span>
                <span>Promotion</span>
                <span>My Transactions</span>
            </div>

            <div class="trade-type-row">
                <label>Trade Type:
                    <select value={type} onchange={e => router.go("/trade?type=" + e.currentTarget.value)}>
                        {#each Object.entries(types) as [key, text]}
                            <option value={key}>{text}{key === "inbound" && list ? ` (${list.inboundCount ?? 0})` : ""}</option>
                        {/each}
                    </select>
                </label>
                <a href="#trade-help" onclick={e => { e.preventDefault(); helpOpen = !helpOpen; }}>How do I send a trade?</a>
            </div>
            <div id="trade-help" class="trade-help" class:show={helpOpen}>Open another user's profile, click the three-dot menu, then choose <strong>Trade Items</strong>.</div>

            <table class="trade-list-table">
                <thead><tr><th>Date</th><th>Expires</th><th>Trade Partner</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                    {#if !list}
                        <tr><td colspan="5" class="trade-no-rows">Loading...</td></tr>
                    {:else if list.trades.length === 0}
                        <tr><td colspan="5" class="trade-no-rows">There are no {types[type].toLowerCase()} trades.</td></tr>
                    {:else}
                        {#each list.trades as row}
                            {@const isSender = row.sender_id === me.id}
                            <tr>
                                <td>{date(row.created_at)}</td>
                                <td>{row.status === "pending" ? date(row.expires_at) : "—"}</td>
                                <td><a href="/user?id={isSender ? row.receiver_id : row.sender_id}">{isSender ? row.receiver_name : row.sender_name}</a></td>
                                <td>{label(row.status)}</td>
                                <td><a href="/trade?view={row.id}">View</a></td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>

            {#if list && list.totalPages > 1}
                <div class="trade-list-pagination">
                    {#if page > 1}<a href="/trade?type={type}&page={page - 1}">◀</a>{:else}<span>◀</span>{/if}
                    <span>Page {page} of {list.totalPages}</span>
                    {#if page < list.totalPages}<a href="/trade?type={type}&page={page + 1}">▶</a>{:else}<span>▶</span>{/if}
                </div>
            {/if}
        </section>
    {/if}
</main>
