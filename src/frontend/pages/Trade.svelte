<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const me = session.me!;
    const MAX_ITEMS = 4;
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
    const phrases: Record<string, string> = {
        pending: "has been opened.",
        completed: "was completed!",
        declined: "was declined.",
        cancelled: "was cancelled.",
        expired: "has expired.",
        countered: "was countered."
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
    const clubs: Record<string, string> = {
        BC: "Builders Club",
        TBC: "Turbo Builders Club",
        OBC: "Outrageous Builders Club"
    };
    const categoryOptions: [string, string][] = [
        ["all", "All"],
        ["hats", "Hats"],
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
    const firstPage = $derived(Math.max(1, Number(router.query.page) || 1));
    const mode = $derived(view > 0 ? "view" : withId > 0 || counter > 0 ? "window" : "list");

    let error = $state("");
    let busy = $state(false);
    let feedback = $state("");
    let confirm = $state<{
        title: string;
        text: string;
        yes: string;
        no: string;
        run: () => void;
    } | null>(null);

    let list = $state<any>(null);
    let listPage = $state(1);
    let loadingMore = $state(false);
    let total = $state(0);

    let trade = $state<any>(null);
    let tradeMissing = $state(false);
    let club = $state("");

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

    const showList = $derived(mode === "list" || mode === "view" || (mode === "window" && windowDone && !partner));
    const notice = $derived(["accept", "decline", "sent"].some(k => router.query[k]) ? feedback : "");
    const isLimited = (item: any) => item.is_limited || item.is_limited_unique;

    $effect(() => {
        if (!showList) return;
        list = null;
        total = 0;
        listPage = firstPage;
        api(`/trade?type=${type}&page=${firstPage}`).then(async d => {
            list = Array.isArray(d.trades) ? d : {
                trades: [],
                page: 1,
                totalPages: 1,
                inboundCount: 0
            };
            total = await countOf(list);
        }).catch(err => {
            error = err.message;
        });
    });

    $effect(() => {
        if (mode !== "view") return;
        trade = null;
        tradeMissing = false;
        club = "";
        api(`/trade/${view}`).then(d => {
            const ok = d.id && (d.sender_id === me.id || d.receiver_id === me.id);
            trade = ok ? d : null;
            tradeMissing = !ok;
            if (!ok) return;
            const other = d.sender_id === me.id ? d.receiver_id : d.sender_id;
            api(`/user/profile/${other}`).then(p => {
                if (trade?.id === d.id) club = p.membership in clubs ? p.membership : "";
            }).catch(() => {});
        }).catch(() => {
            tradeMissing = true;
        });
    });

    const countOf = async (d: any) => {
        if (type === "inbound") return Number(d.inboundCount) || 0;
        if (d.totalPages <= 1) return d.trades.length;
        const onLast = d.page >= d.totalPages;
        const other = await api(`/trade?type=${type}&page=${onLast ? 1 : d.totalPages}`).catch(() => null);
        if (!other) return 0;
        const [full, last] = onLast ? [other.trades.length, d.trades.length] : [d.trades.length, other.trades.length];
        return (d.totalPages - 1) * full + last;
    };

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

    const loadMore = async () => {
        loadingMore = true;
        try {
            const d = await api(`/trade?type=${type}&page=${listPage + 1}`);
            list = {
                ...d,
                trades: [...list.trades, ...d.trades]
            };
            listPage = d.page;
        } catch (err: any) {
            error = err.message;
        }
        loadingMore = false;
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
    const current = (owner: "mine" | "partner") => Math.min(filter[owner].page, pages(owner));
    const visible = (owner: "mine" | "partner") => {
        const p = current(owner);
        return filtered(owner).slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
    };
    const flip = (owner: "mine" | "partner", to: number) => {
        filter[owner].page = Math.min(pages(owner), Math.max(1, Math.floor(to) || 1));
    };

    const askSend = () => {
        if (!offer.length || !request.length) {
            error = "Choose at least one item on each side.";
            return;
        }
        error = "";
        confirm = {
            title: "Send Request",
            text: "Are you sure you want to send a trade request?",
            yes: "OK",
            no: "Cancel",
            run: send
        };
    };

    const send = async () => {
        busy = true;
        try {
            await api("/trade", {
                receiver_id: partner.id,
                offer_items: offer,
                request_items: request,
                ...(counter > 0 ? { counter_of: counter } : {})
            });
            feedback = "Your trade request has been sent!";
            router.go("/trade?type=outbound&sent=1");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const ask = (action: string, next: string, name: string) => {
        const accept = action === "accept";
        confirm = {
            title: accept ? "Accept Request" : "Decline Request",
            text: `Are you sure you want to ${accept ? "accept" : "decline"} this Trade?`,
            yes: "Yes",
            no: "No",
            run: () => act(action, next, name)
        };
    };

    const act = async (action: string, next: string, name: string) => {
        busy = true;
        try {
            await api(`/trade/${trade.id}/${action}`, {});
            feedback = action === "accept"
                ? `You have accepted ${short(name)}'s trade request. The trade is now being processed by our system.`
                : action === "decline" ? `You have declined ${short(name)}'s trade request.` : "";
            router.go(`/trade?type=${next}&${action}=1`);
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const answer = (yes: boolean) => {
        const run = confirm?.run;
        confirm = null;
        if (yes && run) run();
    };

    const close = () => router.go(`/trade?type=${type}`);

    const short = (name: string) => name.length > 10 ? name.slice(0, 10) + "..." : name;

    const date = (t: number) => {
        const d = new Date(t * 1000);
        return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    };
    const expires = (at: number) => {
        const left = at - Date.now() / 1000;
        const days = Math.floor(left / 86400);
        const hours = Math.floor(left / 3600);
        if (days > 1) return `in ${days} days.`;
        if (hours > 1) return `in ${hours} hours.`;
        return "soon.";
    };
    const status = (row: any) => {
        if (row.status !== "pending") return statuses[row.status] ?? row.status;
        return row.sender_id === me.id ? `Pending approval from ${row.receiver_name}` : "Pending approval from you";
    };
    const exchangeDetails = (row: any, isSender: boolean) => {
        const gave = isSender ? row.items?.offer ?? [] : row.items?.request ?? [];
        const received = isSender ? row.items?.request ?? [] : row.items?.offer ?? [];
        const tense = row.status === "pending" ? "give" : row.status === "completed" ? "gave" : "would give";
        const receiveTense = row.status === "pending" ? "receive" : row.status === "completed" ? "received" : "would receive";
        return {
            gave: `${tense[0].toUpperCase()}${tense.slice(1)}: ${gave.map((item: any) => item.name).join(", ") || "Nothing"}`,
            received: `${receiveTense[0].toUpperCase()}${receiveTense.slice(1)}: ${received.map((item: any) => item.name).join(", ") || "Nothing"}`
        };
    };
    const headers = (s: string) => s === "pending"
        ? ["ITEMS YOU WILL GIVE", "ITEMS YOU WILL RECEIVE"]
        : s === "completed" ? ["ITEMS YOU GAVE", "ITEMS YOU RECEIVED"] : ["ITEMS YOU WOULD HAVE GIVEN", "ITEMS YOU WOULD HAVE RECEIVED"];
    const thumb = (item: any) => item.thumbnail || "/img/pending.png";
    const overlay = (item: any) => item.is_limited_unique ? "/img/catalog/overlay-limited-unique.png" : item.is_limited ? "/img/catalog/overlay-limited.png" : "";
    const headshot = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const fallback = (e: Event) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = "/img/pending.png";
    };
</script>

<svelte:head>
    <title>Trade - NoneRev</title>
    <link rel="stylesheet" href="/css/notifications.css">
    <link rel="stylesheet" href="/css/trade.css">
</svelte:head>

{#snippet worth(n: number)}
    <span class="trade-value">Value: <img src="/img/nonebux-green.png" alt="N$"><b>{n.toLocaleString()}</b></span>
{/snippet}

{#snippet offerRow(title: string, items: any[])}
    <div class="trade-request-head">
        <h3>{title}</h3>
        {@render worth(value(items))}
    </div>
    <div class="trade-request-items">
        {#each { length: Math.max(5, items.length) } as _, i}
            {@const item = items[i]}
            {#if item}
                <a class="trade-request-item" href="/catalog/item?id={item.id}">
                    <span>{item.name}</span>
                    <img src={thumb(item)} alt={item.name} onerror={fallback}>
                    {#if overlay(item)}
                        <img class="trade-limited-overlay" src={overlay(item)} alt={item.is_limited_unique ? "Limited U" : "Limited"}>
                    {/if}
                </a>
            {:else}
                <div class="trade-request-item"></div>
            {/if}
        {/each}
    </div>
{/snippet}

{#snippet offerBlock(side: "offer" | "request", title: string, items: any[])}
    {@const ids = side === "offer" ? offer : request}
    <div class="trade-offer-head">
        <h3>{title}<span class="money-tip" title={side === "offer" ? "Pick up to 4 of your Limited items to give." : "Pick up to 4 of their Limited items to ask for."}>?</span></h3>
        {@render worth(value(ids.map(id => find(items, id))))}
    </div>
    <div class="trade-slots">
        {#each { length: Math.max(MAX_ITEMS, ids.length) } as _, i}
            {@const item = ids[i] ? find(items, ids[i]) : null}
            {#if item}
                <button type="button" class="trade-slot" title={item.name} onclick={() => toggle(side, item.id)}>
                    <img src={thumb(item)} alt={item.name} onerror={fallback}>
                </button>
            {:else}
                <div class="trade-slot"></div>
            {/if}
        {/each}
    </div>
{/snippet}

{#snippet inventory(owner: "mine" | "partner", title: string, empty: string)}
    {@const side = owner === "mine" ? "offer" : "request"}
    {@const ids = owner === "mine" ? offer : request}
    <section class="trade-inventory">
        <div class="trade-inventory-head">
            <h3>{title}</h3>
            <label>Category:
                <select bind:value={filter[owner].category} onchange={() => filter[owner].page = 1}>
                    {#each categoryOptions as [value, text]}
                        <option {value}>{text}</option>
                    {/each}
                </select>
            </label>
        </div>
        <div class="trade-inventory-grid">
            {#each visible(owner) as item (item.id)}
                {@const picked = ids.includes(item.id)}
                <div class="trade-tile-outer">
                    <button type="button" class="trade-tile" class:selected={picked} onclick={() => toggle(side, item.id)}>
                        <span class="trade-tile-card">
                            <span class="trade-tile-name">{item.name}</span>
                            <img class="trade-tile-thumb" src={thumb(item)} alt={item.name} onerror={fallback}>
                            {#if overlay(item)}
                                <img class="trade-limited-overlay" src={overlay(item)} alt={item.is_limited_unique ? "Limited U" : "Limited"}>
                            {/if}
                            <span class="trade-tile-info">
                                <span><span class="trade-tile-label">Orig. Price:</span> <span class="trade-tile-data">N$ {Number(item.price ?? 0).toLocaleString()}</span></span>
                                {#if item.serial_number}
                                    <span><span class="trade-tile-label">Serial #:</span> {item.serial_number} / {item.limited_stock ?? "-"}</span>
                                {/if}
                            </span>
                            <span class="trade-tile-action" class:disabled={picked}>{side === "offer" ? "Add to Offer" : "Request"}</span>
                        </span>
                    </button>
                </div>
            {/each}
            {#if filtered(owner).length === 0}
                <div class="trade-inventory-empty">{empty}</div>
            {/if}
        </div>
        {#if pages(owner) > 1}
            <div class="trade-pager">
                <button type="button" class="trade-pager-prev" aria-label="Previous page" disabled={current(owner) <= 1} onclick={() => flip(owner, current(owner) - 1)}></button>
                <span>Page <input type="text" inputmode="numeric" value={current(owner)} onchange={e => flip(owner, Number(e.currentTarget.value))}> of {pages(owner)}</span>
                <button type="button" class="trade-pager-next" aria-label="Next page" disabled={current(owner) >= pages(owner)} onclick={() => flip(owner, current(owner) + 1)}></button>
            </div>
        {/if}
    </section>
{/snippet}

<main class="money-page trade-page">
    {#if mode === "window" && partner}
        <div class="trade-window">
            <div class="trade-window-top">
                <div><strong>TRADING</strong> with <a href="/user?id={partner.id}">{partner.username}</a></div>
                <a class="trade-exit" href="/trade">Exit Trading<span></span></a>
            </div>

            <div class="trade-offer-panel">
                {@render offerBlock("offer", "Your Offer", mine)}
                <img class="trade-offer-divider" src="/img/trade/trade-divider.png" alt="">
                {@render offerBlock("request", "Your Request", theirs)}
                <button class="trade-send" type="button" disabled={busy} onclick={askSend}>Send Request</button>
            </div>
            {#if error}
                <div class="trade-window-error" role="alert">{error}</div>
            {/if}

            <div class="trade-inventories">
                {@render inventory("mine", "Your Inventory", "You do not have any Limited items in this category.")}
                <div class="trade-inventory-divider"></div>
                {@render inventory("partner", `${partner.username}'s Inventory`, `${partner.username} does not have any Limited items in this category.`)}
            </div>
        </div>

    {:else if showList}
        <ul class="money-tabs">
            <li><a href="/my/money">My Transactions</a></li>
            <li><a href="/my/money?tab=summary">Summary</a></li>
            <li><a href="/my/money?tab=currency">Trade Currency</a></li>
            <li class="selected"><a href="/trade">Trade Items</a></li>
            <li><a href="/my/money?tab=promotion">Promotion</a></li>
        </ul>
        <a class="money-buy money-btn-medium money-btn-green" href="/upgrades/nonebux">Buy NONEBUX</a>

        {#if notice}
            <div class="money-status" role="status">{notice}</div>
        {/if}
        {#if error || (mode === "view" && tradeMissing)}
            <div class="money-error" role="alert">{error || "Trade not found."}</div>
        {/if}

        <div class="money-filters">
            <label for="trade-type">Trade Type:</label>
            <select id="trade-type" value={type} onchange={e => router.go("/trade?type=" + e.currentTarget.value)}>
                {#each Object.entries(types) as [key, text]}
                    {@const n = key === type ? total : key === "inbound" ? Number(list?.inboundCount) || 0 : 0}
                    <option value={key}>{text}{n > 0 ? ` (${n})` : ""}</option>
                {/each}
            </select>
            <a href="/my/friends" title="Open another user's profile, click the three-dot menu, then choose Trade Items.">How do I send a trade?</a>
        </div>

        <table class="money-table trade-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Expires</th>
                    <th>Trade Partner</th>
                    <th>Exchange</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {#if !list}
                    <tr class="money-loading"><td colspan="6"><span></span><span></span><span></span></td></tr>
                {:else if list.trades.length === 0}
                    <tr><td class="money-empty" colspan="6">You have no {types[type].toLowerCase()} trade requests.</td></tr>
                {:else}
                    {#each list.trades as row (row.id)}
                        {@const isSender = row.sender_id === me.id}
                        {@const otherId = isSender ? row.receiver_id : row.sender_id}
                        {@const exchange = exchangeDetails(row, isSender)}
                        <tr>
                            <td>{date(row.created_at)}</td>
                            <td>{row.status === "pending" ? date(row.expires_at) : ""}</td>
                            <td class="money-member">
                                <a href="/user?id={otherId}"><img src={headshot(otherId)} alt="" onerror={fallback}></a>
                                <span>{isSender ? row.receiver_name : row.sender_name}</span>
                            </td>
                            <td class="trade-history-exchange">
                                <span title={exchange.gave}>{exchange.gave}</span>
                                <span title={exchange.received}>{exchange.received}</span>
                            </td>
                            <td>{status(row)}</td>
                            <td><a class="trade-view-link" href="/trade?type={type}&view={row.id}">View Details</a></td>
                        </tr>
                    {/each}
                    {#if listPage < list.totalPages}
                        <tr class="money-more">
                            <td colspan="5"><button class="money-btn-control small" type="button" disabled={loadingMore} onclick={loadMore}>More Records</button></td>
                        </tr>
                    {/if}
                {/if}
            </tbody>
        </table>
    {/if}

    {#if (mode === "view" && trade) || confirm}
        <div class="trade-backdrop"></div>
    {/if}

    {#if confirm}
        <div class="trade-modal trade-confirm" role="dialog" aria-label={confirm.title}>
            <div class="trade-modal-title">{confirm.title}</div>
            <div class="trade-modal-body">
                <p>{confirm.text}</p>
                <div class="trade-modal-buttons">
                    <button class="money-btn-large money-btn-purple" type="button" onclick={() => answer(true)}>{confirm.yes}</button>
                    <button class="money-btn-large money-btn-gray" type="button" onclick={() => answer(false)}>{confirm.no}</button>
                </div>
            </div>
        </div>
    {:else if mode === "view" && trade}
        {@const isSender = trade.sender_id === me.id}
        {@const otherId = isSender ? trade.receiver_id : trade.sender_id}
        {@const otherName = isSender ? trade.receiver_name : trade.sender_name}
        {@const [giveTitle, receiveTitle] = headers(trade.status)}
        <div class="trade-modal trade-request" role="dialog" aria-label="Trade Request">
            <div class="trade-modal-id">Trade Id: #{trade.id}</div>
            <div class="trade-modal-title">Trade Request</div>
            <button class="trade-close" type="button" aria-label="Close" onclick={close}></button>
            <div class="trade-modal-body">
                <div class="trade-request-partner">
                    <div class="trade-request-avatar">
                        <img src={pic(otherId)} alt={otherName} onerror={fallback}>
                        {#if club}
                            <span class="trade-club trade-club-{club.toLowerCase()}" title={clubs[club]}></span>
                        {/if}
                    </div>
                    <p class="trade-request-text">Trade with <a href="/user?id={otherId}" title={otherName}>{short(otherName)}</a> {phrases[trade.status] ?? ""}</p>
                    {#if trade.status === "pending"}
                        <p class="trade-request-expires">Expires {expires(trade.expires_at)}</p>
                    {/if}
                </div>
                <div class="trade-request-offers">
                    {@render offerRow(giveTitle, isSender ? trade.offer : trade.request)}
                    <div class="trade-request-divider"></div>
                    {@render offerRow(receiveTitle, isSender ? trade.request : trade.offer)}
                </div>
                <div class="trade-modal-buttons">
                    {#if trade.status !== "pending"}
                        <button class="money-btn-large money-btn-purple" type="button" onclick={close}>OK</button>
                    {:else if isSender}
                        <button class="money-btn-large money-btn-gray" type="button" disabled={busy} onclick={() => ask("cancel", "inactive", otherName)}>Cancel Trade</button>
                    {:else}
                        <button class="money-btn-large money-btn-purple" type="button" disabled={busy} onclick={() => ask("accept", "completed", otherName)}>Accept</button>
                        <a class="money-btn-large money-btn-purple" href="/trade?with={trade.sender_id}&counter={trade.id}">Counter</a>
                        <button class="money-btn-large money-btn-gray" type="button" disabled={busy} onclick={() => ask("decline", "inactive", otherName)}>Decline</button>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</main>
