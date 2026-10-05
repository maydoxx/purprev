<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import Sidebar from "./develop/Sidebar.svelte";

    let ads = $state<any[]>([]);
    let loaded = $state(false);
    let bidding = $state(0);
    let bid = $state<number | null>(null);
    let currency = $state("nonebux");
    let error = $state("");
    let busy = $state(false);

    const running = $derived(ads.filter(a => a.running).length);

    const load = () => api("/ads/mine").then(d => {
        ads = d.list;
    }).catch(err => error = err.message).finally(() => loaded = true);

    load();

    const open = (id: number) => {
        bidding = bidding === id ? 0 : id;
        bid = null;
        currency = "nonebux";
        error = "";
    };

    const run = async (e: Event, ad: any) => {
        e.preventDefault();
        error = "";
        const amount = Number(bid ?? 0);
        if (!Number.isSafeInteger(amount) || amount < 1) {
            error = "Enter a bid of at least 1.";
            return;
        }
        busy = true;
        try {
            await api(`/ads/run/${ad.id}`, {
                bid: amount,
                currency
            });
            bidding = 0;
            await Promise.all([load(), session.refresh()]);
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const money = (n: number, cur: string) => `${n.toLocaleString()} ${cur === "tix" ? "Tix" : "Nonebux"}`;

    const spent = (t: any) => [
        t.nonebux ? money(t.nonebux, "nonebux") : "",
        t.tix ? money(t.tix, "tix") : ""
    ].filter(Boolean).join(", ") || "0";

    const ends = (t: number) => new Date(t * 1000).toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
</script>

<svelte:head>
    <title>Develop - User Ads - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
    <link rel="stylesheet" href="/css/ads.css">
</svelte:head>

<main class="develop-page">
    <div class="develop-container">
        <div class="develop-tabs">
            <a class="develop-tab active" href="/develop">My Creations</a>
        </div>
        <div class="develop-sheet">
            <div class="develop-creations">
                <Sidebar />
                <section class="develop-content">
                    <a class="develop-btn" href="/my/create-user-ad">Create New Ad</a>
                    <div class="develop-header">
                        <h2 class="develop-heading">User Ads</h2>
                        <span class="develop-count">{running} of {ads.length.toLocaleString()} ad{ads.length === 1 ? "" : "s"} running</span>
                    </div>
                    {#if loaded && ads.length === 0}
                        <div class="develop-empty">You haven't created any ads yet. Upload one and it will show up here once a moderator approves it.</div>
                    {/if}
                    {#if error && !bidding}
                        <div class="develop-error">{error}</div>
                    {/if}
                    <div class="develop-list">
                        {#each ads as ad (ad.id)}
                            <div class="develop-item user-ad-item">
                                <div class="develop-thumb develop-thumb-fit">
                                    <a href={ad.image} target="_blank" title="{ad.width} x {ad.height}">
                                        <img src={ad.image} alt={ad.name}>
                                    </a>
                                </div>
                                <div class="develop-info develop-info-wide">
                                    <span class="develop-name">{ad.name}</span>
                                    <span class="user-ad-for">
                                        for
                                        <a href={ad.target.url}>{ad.target.name || "something that was deleted"}</a>
                                    </span>
                                    <div class="user-ad-stats">
                                        <div>
                                            <span>Impressions:</span>
                                            <b>{(ad.run?.impressions ?? 0).toLocaleString()}</b>
                                        </div>
                                        <div>
                                            <span>Clicks:</span>
                                            <b>{(ad.run?.clicks ?? 0).toLocaleString()}</b>
                                        </div>
                                        <div>
                                            <span>CTR:</span>
                                            <b>{(ad.run?.ctr ?? 0).toFixed(2)}%</b>
                                        </div>
                                        <div>
                                            <span>Bid:</span>
                                            <b>{ad.run ? money(ad.run.bid, ad.run.currency) : "0"}</b>
                                        </div>
                                        <div>
                                            <span>Total Impr:</span>
                                            <b>{ad.totals.impressions.toLocaleString()}</b>
                                        </div>
                                        <div>
                                            <span>Total Clicks:</span>
                                            <b>{ad.totals.clicks.toLocaleString()}</b>
                                        </div>
                                        <div>
                                            <span>Total CTR:</span>
                                            <b>{ad.totals.ctr.toFixed(2)}%</b>
                                        </div>
                                        <div>
                                            <span>Total Bid:</span>
                                            <b>{spent(ad.totals)}</b>
                                        </div>
                                    </div>
                                    <div class="develop-meta">
                                        {#if ad.status === "pending"}
                                            <span class="user-ad-state">Waiting for approval</span>
                                        {:else if ad.status === "rejected"}
                                            <span class="user-ad-state rejected">Rejected by a moderator</span>
                                        {:else}
                                            <span class="develop-status" class:off={!ad.running}>{ad.running ? "Running" : "Not Running"}</span>
                                            {#if ad.running}
                                                <span>Ends: {ends(ad.run.ends_at)}</span>
                                            {/if}
                                        {/if}
                                    </div>
                                    {#if bidding === ad.id}
                                        <form class="user-ad-bid" onsubmit={e => run(e, ad)}>
                                            <label for="bid-{ad.id}">Bid:</label>
                                            <input id="bid-{ad.id}" type="number" min="1" step="1" disabled={busy} bind:value={bid}>
                                            <select disabled={busy} bind:value={currency}>
                                                <option value="nonebux">Nonebux</option>
                                                <option value="tix">Tix</option>
                                            </select>
                                            <button class="develop-btn" type="submit" disabled={busy}>Run</button>
                                            <button class="develop-btn develop-btn-negative" type="button" disabled={busy} onclick={() => open(0)}>Cancel</button>
                                            <span class="user-ad-balance">
                                                Runs for 24 hours. You have {money(session.me?.currency ?? 0, "nonebux")} and {money(session.me?.tix ?? 0, "tix")}.
                                            </span>
                                            {#if error}
                                                <span class="develop-error">{error}</span>
                                            {/if}
                                        </form>
                                    {/if}
                                </div>
                                <div class="develop-item-actions">
                                    {#if ad.status === "approved" && !ad.running}
                                        <button class="develop-control" type="button" onclick={() => open(ad.id)}>Run Ad</button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
            </div>
        </div>
    </div>
</main>
