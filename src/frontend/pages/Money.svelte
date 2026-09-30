<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";

    let tixAmount = $state(10);
    let busy = $state(false);
    let message = $state("");
    let error = $state(false);

    const available = $derived(Math.floor((session.me?.tix ?? 0) / 10) * 10);
    const valid = $derived(Number.isSafeInteger(tixAmount) && tixAmount >= 10 && tixAmount % 10 === 0 && tixAmount <= (session.me?.tix ?? 0));

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

<svelte:head><title>My Money - NoneRev</title><link rel="stylesheet" href="/css/notifications.css"></svelte:head>

<main class="rbx-content money-page">
    <h1>My Money</h1>
    <div class="money-balances">
        <section><span class="icon-nav-robux" aria-hidden="true"></span><div><h2>Nonebux</h2><strong>{(session.me?.currency ?? 0).toLocaleString()}</strong></div></section>
        <section><span class="icon-nav-tix" aria-hidden="true"></span><div><h2>Tix</h2><strong>{(session.me?.tix ?? 0).toLocaleString()}</strong></div></section>
    </div>
    <section class="money-exchange">
        <div class="money-exchange-heading">
            <h2>Currency Exchange</h2>
            <span class="money-exchange-rate">10 Tix = 1 Nonebux</span>
        </div>
        <form onsubmit={exchange}>
            <label for="money-tix-amount">Tix to exchange</label>
            <div class="money-exchange-controls">
                <input id="money-tix-amount" type="number" min="10" max="2000000000" step="10" bind:value={tixAmount} disabled={busy}>
                <span class="money-exchange-arrow" aria-hidden="true">→</span>
                <output>{Number.isSafeInteger(tixAmount) && tixAmount >= 10 && tixAmount % 10 === 0 ? (tixAmount / 10).toLocaleString() : "0"} Nonebux</output>
                <button type="submit" disabled={!valid || busy}>{busy ? "Exchanging..." : "Exchange"}</button>
            </div>
            <p class="money-exchange-hint">Enter a multiple of 10. You can exchange up to {available.toLocaleString()} Tix.</p>
        </form>
        {#if message}<p class="money-exchange-message" class:error role="status">{message}</p>{/if}
    </section>
    <p class="money-daily-note">Log in each UTC day to receive 10 Tix and 5 Nonebux. You can also spend Tix on eligible items in the <a href="/catalog">Catalog</a>.</p>
</main>
