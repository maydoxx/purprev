<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const tab = $derived(["summary", "currency", "promotion"].includes(router.query.tab ?? "") ? router.query.tab! : "transactions");
    const transactionTypes: Record<string, string> = {
        purchases: "Purchases",
        sales: "Sales",
        trades: "Trades",
        "daily-rewards": "Daily Rewards"
    };
    const periods = ["Past Day", "Past Week", "Past Month", "Past Year"];
    const categories = ["Sale of Goods", "Currency Exchange", "Daily Rewards"];
    const ticks = [0.8, 0.6, 0.4, 0.2, 0];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let transactionType = $state("purchases");
    let transactions = $state<any>(null);
    let failed = $state(false);
    let loadingMore = $state(false);

    let period = $state("Past Day");

    let promoUrl = $state("");
    let promoPeriod = $state("Hourly");

    let tixAmount = $state(10);
    let busy = $state(false);
    let message = $state("");
    let error = $state(false);

    const available = $derived(Math.floor((session.me?.tix ?? 0) / 10) * 10);
    const valid = $derived(Number.isSafeInteger(tixAmount) && tixAmount >= 10 && tixAmount % 10 === 0 && tixAmount <= (session.me?.tix ?? 0));

    const promoLink = $derived.by(() => {
        try {
            const url = new URL(promoUrl.trim());
            if (url.host !== location.host) return "";
            url.searchParams.set("ref", String(session.me?.id ?? ""));
            return url.href;
        } catch {
            return "";
        }
    });

    const promoTimes = $derived.by(() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return Array.from({ length: 8 }, (_, i) => {
            const back = 7 - i;
            if (promoPeriod === "Monthly") {
                const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
                return `${months[d.getMonth()]} ${d.getFullYear()}`;
            }
            const d = new Date(now.getTime() - back * (promoPeriod === "Daily" ? 86400000 : 8 * 3600000));
            return promoPeriod === "Daily" ? `${months[d.getMonth()]} ${d.getDate()}` : `${months[d.getMonth()]} ${d.getDate()} ${pad(d.getHours())}:00`;
        });
    });

    $effect(() => {
        if (tab !== "transactions") return;
        const type = transactionType;
        transactions = null;
        failed = false;
        api(`/money/transactions?type=${type}&page=1`).then(d => {
            if (type !== transactionType) return;
            transactions = Array.isArray(d.transactions) ? d : {
                transactions: [],
                page: 1,
                totalPages: 1
            };
        }).catch(() => {
            if (type !== transactionType) return;
            failed = true;
            transactions = {
                transactions: [],
                page: 1,
                totalPages: 1
            };
        });
    });

    const loadMore = async () => {
        loadingMore = true;
        try {
            const d = await api(`/money/transactions?type=${transactionType}&page=${transactions.page + 1}`);
            transactions = {
                ...d,
                transactions: [...transactions.transactions, ...d.transactions]
            };
        } catch {
            failed = true;
        }
        loadingMore = false;
    };

    const date = (t: number) => {
        const d = new Date(Number(t) * 1000);
        return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    };
    const headshot = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const fallback = (e: Event) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = "/img/pending.png";
    };

    const exchange = async (event: SubmitEvent) => {
        event.preventDefault();
        if (!valid || busy) return;
        busy = true;
        error = false;
        message = "";
        try {
            const amount = tixAmount;
            await api("/money/exchange", { tix: amount });
            await session.refresh();
            message = `Exchanged ${amount.toLocaleString()} Tix for ${(amount / 10).toLocaleString()} Nonebux.`;
            tixAmount = 10;
        } catch (err: any) {
            error = true;
            message = err.message || "The exchange could not be completed.";
        } finally {
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>My Money - NoneRev</title>
    <link rel="stylesheet" href="/css/notifications.css">
</svelte:head>

{#snippet chart(title: string, legend: string, unit: string)}
    <div class="money-chart">
        <h3>{title}<span class="money-tip" title="{title} from your promotion links">?</span></h3>
        <div class="money-chart-body">
            {#if unit}
                <span class="money-chart-unit">{unit}</span>
            {/if}
            <div class="money-chart-plot">
                {#each ticks as tick}
                    <span class="money-chart-tick" style="top: {(1 - tick) * 100}%"><span>{tick.toFixed(1)}</span></span>
                {/each}
            </div>
            <div class="money-chart-legend"><span></span>{legend}</div>
            <div class="money-chart-times">
                {#each promoTimes as time}
                    <span>{time}</span>
                {/each}
            </div>
        </div>
    </div>
{/snippet}

<main class="money-page">
    <ul class="money-tabs">
        <li class:selected={tab === "transactions"}><a href="/my/money">My Transactions</a></li>
        <li class:selected={tab === "summary"}><a href="/my/money?tab=summary">Summary</a></li>
        <li class:selected={tab === "currency"}><a href="/my/money?tab=currency">Trade Currency</a></li>
        <li><a href="/trade">Trade Items</a></li>
        <li class:selected={tab === "promotion"}><a href="/my/money?tab=promotion">Promotion</a></li>
    </ul>
    <a class="money-buy money-btn-medium money-btn-green" href="/upgrades/nonebux">Buy NONEBUX</a>

    {#if tab === "transactions"}
        <div class="money-filters">
            <label for="money-transaction-type">Transaction Type:</label>
            <select id="money-transaction-type" bind:value={transactionType}>
                {#each Object.entries(transactionTypes) as [value, text]}
                    <option {value}>{text}</option>
                {/each}
            </select>
        </div>
        <table class="money-table money-transactions">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Description</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                {#if !transactions}
                    <tr class="money-loading"><td colspan="4"><span></span><span></span><span></span></td></tr>
                {:else if transactions.transactions.length === 0}
                    <tr>
                        <td class="money-empty" colspan="4">
                            {#if failed}
                                No records found.
                            {:else if transactionType === "purchases"}
                                You have not purchased any items! Browse the <a href="/catalog">Catalog</a> to buy items.
                            {:else if transactionType === "sales"}
                                You have not sold any items!
                            {:else}
                                No records found.
                            {/if}
                        </td>
                    </tr>
                {:else}
                    {#each transactions.transactions as row (row.id)}
                        {@const amount = Number(row.amount) || 0}
                        <tr>
                            <td>{date(row.created_at)}</td>
                            <td class="money-member" title={row.member_name}>
                                {#if row.member_type === "system"}
                                    <a href="/home"><img class="money-square" src="/img/noneRevSmall.png" alt=""></a>
                                {:else if row.member_type === "group"}
                                    <a href="/groups?id={row.member_id}"><img class="money-square" src={row.member_icon || "/img/pending.png"} alt="" onerror={fallback}></a>
                                {:else}
                                    <a href="/user?id={row.member_id}"><img src={headshot(row.member_id)} alt="" onerror={fallback}></a>
                                {/if}
                                <span>{row.member_name}</span>
                            </td>
                            <td>
                                {row.description}
                                {#if row.item_id}
                                    <a href="/catalog/item?id={row.item_id}">{row.item_name}</a>
                                {/if}
                            </td>
                            <td class="money-amount">
                                {#if amount}
                                    <img src={row.currency === "tix" ? "/img/tix-gold.png" : "/img/nonebux-green.png"} alt={row.currency === "tix" ? "Tix" : "N$"}><strong>{Math.abs(amount).toLocaleString()}</strong>
                                {:else}
                                    0
                                {/if}
                            </td>
                        </tr>
                    {/each}
                    {#if transactions.page < transactions.totalPages}
                        <tr class="money-more">
                            <td colspan="4"><button class="money-btn-control small" type="button" disabled={loadingMore} onclick={loadMore}>More Records</button></td>
                        </tr>
                    {/if}
                {/if}
            </tbody>
        </table>
    {:else if tab === "summary"}
        <div class="money-summary">
            <div class="money-filters">
                <label for="money-period">Time Period:</label>
                <select id="money-period" bind:value={period}>
                    {#each periods as p}
                        <option value={p}>{p}</option>
                    {/each}
                </select>
            </div>
            <h2><img src="/img/nonebux-green.png" alt="">NONEBUX</h2>
            <table class="money-table">
                <thead>
                    <tr>
                        <th>Categories</th>
                        <th>Credit</th>
                    </tr>
                </thead>
                <tbody>
                    {#each categories as category}
                        <tr>
                            <td>{category}</td>
                            <td></td>
                        </tr>
                    {/each}
                    <tr class="money-total">
                        <td colspan="2">TOTAL<img src="/img/nonebux-green.png" alt="N$"><strong>0</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
    {:else if tab === "currency"}
        <div class="money-currency">
            <div class="money-currency-menu">
                <button class="money-btn-medium money-btn-green" type="submit" form="money-exchange" disabled={!valid || busy}>{busy ? "Exchanging..." : "Exchange"}</button>
            </div>
            <form id="money-exchange" class="money-currency-form" onsubmit={exchange}>
                <div class="money-currency-box">
                    <label for="money-tix-amount">Tix to exchange</label>
                    <input id="money-tix-amount" type="number" min="10" max="2000000000" step="10" bind:value={tixAmount} disabled={busy}>
                    <span class="money-currency-arrow" aria-hidden="true">→</span>
                    <output>{Number.isSafeInteger(tixAmount) && tixAmount >= 10 && tixAmount % 10 === 0 ? (tixAmount / 10).toLocaleString() : "0"} Nonebux</output>
                    <p>Enter a multiple of 10. You can exchange up to {available.toLocaleString()} Tix.</p>
                    {#if message}
                        <div class={error ? "money-error" : "money-status"} role="status">{message}</div>
                    {/if}
                    <p>Log in each UTC day to receive 10 Tix and 5 Nonebux. You can also spend Tix on eligible items in the <a href="/catalog">Catalog</a>.</p>
                </div>
            </form>
            <dl class="money-currency-market">
                <div class="wide">
                    <dt>Rate:</dt>
                    <dd>10 Tix = 1 Nonebux</dd>
                </div>
                <div>
                    <dt>Available Tix:</dt>
                    <dd>{(session.me?.tix ?? 0).toLocaleString()}</dd>
                </div>
                <div>
                    <dt>Available Nonebux:</dt>
                    <dd>{(session.me?.currency ?? 0).toLocaleString()}</dd>
                </div>
            </dl>
        </div>
    {:else}
        <div class="money-promotion">
            <p>You can create promotional links with this link generator:</p>
            <label for="money-promo-url">NoneRev url:</label>
            <input id="money-promo-url" type="text" spellcheck="false" bind:value={promoUrl}>
            <strong>Promotion link:</strong>
            <p class="money-promotion-link">
                {#if promoLink}
                    <a href={promoLink}>{promoLink}</a>
                {:else}
                    Please link to a page on {location.host}!
                {/if}
            </p>
            <div class="money-promotion-periods">
                {#each ["Hourly", "Daily", "Monthly"] as p}
                    <button type="button" class:selected={promoPeriod === p} onclick={() => promoPeriod = p}>{p}</button>
                {/each}
            </div>
            {@render chart("New Visitors", "Visitors", "")}
            {@render chart("Signups", "Signups", "")}
            {@render chart("Promotional Revenue", "Revenue", "N$")}
            <table class="money-table money-promotion-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>New Visitors</th>
                        <th>Signups</th>
                        <th>Promotional Revenue (N$)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td class="money-empty" colspan="4">No records found.</td></tr>
                </tbody>
            </table>
        </div>
    {/if}
</main>
