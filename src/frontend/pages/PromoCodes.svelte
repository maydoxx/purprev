<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let code = $state(router.query.code ?? "");
    let busy = $state(false);
    let error = $state("");
    let result = $state<any>(null);

    const n = (v: number) => Number(v).toLocaleString("en-US");

    const redeem = async (e: Event) => {
        e.preventDefault();
        if (busy || code.trim() === "") {
            return;
        }
        busy = true;
        error = "";
        result = null;
        try {
            const d = await api("/promocodes/redeem", {
                code
            });
            result = d;
            session.set(d.user);
            code = "";
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };
</script>

<svelte:head>
    <title>NoneRev.com</title>
    <link rel="stylesheet" href="/css/membership.css">
</svelte:head>

<main class="rbx-content">
<div class="bc-body">
    <div id="RedeemPage" class="promo-page">
        <h1>Redeem NoneRev Promotions</h1>
        <div id="RedeemContainer">
            {#if !session.me}
                <div id="HowToUse">How to Use</div>
                <p class="redeem-login">You must be logged in to redeem promo codes. <a href="/login">Login now</a> to redeem and start playing!</p>
            {:else}
                <div id="Instructions">
                    <div id="HowToUse">How to Use</div>
                    <div class="redeem-steps">
                        <div>Got a NoneRev promo code from an event, a giveaway or the <a href="/discord">Discord</a>?</div>
                        <div>This is where you claim your stuff. Enter the code in the section to the right.</div>
                    </div>
                    <div class="redeem-footnote">Promo codes can expire or only work for a short time. Each code works once per account.</div>
                </div>
                <div id="CodeInput">
                    <div class="redeem-badge">Enter Your Code</div>
                    <form class="redeem-form" onsubmit={redeem}>
                        <input id="pin" type="text" maxlength="60" autocomplete="off" spellcheck="false" aria-label="Promo code" bind:value={code}>
                        <button type="submit" class="btn-small btn-primary" class:disabled={busy || code.trim() === ""} disabled={busy || code.trim() === ""}>Redeem</button>
                    </form>
                    <div class="redeem-help">Have a NoneRev card instead? <a href="/redeem">Redeem it here</a>.</div>
                </div>
                {#if result}
                    <div class="redeem-result redeem-result-success" role="status">
                        <img src="/img/redeem/thumbs-up.svg" alt="">
                        <div class="promo-result">
                            <div class="promo-result-title">You redeemed {result.code}!</div>
                            {#if result.items.length}
                                <ul class="promo-items">
                                    {#each result.items as item (item.id)}
                                        <li>
                                            <a href="/catalog/item?id={item.id}">
                                                <img src={item.thumbnail || "/img/pending.png"} alt="">
                                                <span>{item.name}</span>
                                            </a>
                                            {#if item.owned}
                                                <span class="promo-owned">You already had this</span>
                                            {/if}
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                            {#if result.nonebux > 0}
                                <div class="promo-currency">{n(result.nonebux)} NONEBUX has been credited to your account!</div>
                            {/if}
                            {#if result.tix > 0}
                                <div class="promo-currency">{n(result.tix)} Tix have been credited to your account!</div>
                            {/if}
                        </div>
                    </div>
                {:else if error}
                    <div class="redeem-result redeem-result-error" role="alert">
                        <img src="/img/redeem/thumbs-down.svg" alt="">
                        <span>{error}</span>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>
</main>
