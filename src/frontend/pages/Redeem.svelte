<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";

    let pin = $state("");
    let busy = $state(false);
    let error = $state("");
    let credited = $state(0);

    const n = (v: number) => Number(v).toLocaleString("en-US");

    const redeem = async (e: Event) => {
        e.preventDefault();
        if (busy || pin.trim() === "") {
            return;
        }
        busy = true;
        error = "";
        credited = 0;
        try {
            const d = await api("/membership/redeem", {
                code: pin
            });
            credited = d.amount;
            session.set(d.user);
            pin = "";
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
    <div id="RedeemPage">
        <h1>Redeem NoneRev cards</h1>
        <div id="RedeemContainer">
            {#if !session.me}
                <div id="HowToUse">How to Use</div>
                <p class="redeem-login">You must be logged in to Redeem NoneRev Cards. <a href="/login">Login now</a> to redeem and start playing!</p>
            {:else}
                <div id="Instructions">
                    <div id="HowToUse">How to Use</div>
                    <img class="redeem-cards" src="/img/redeem/cards.png" alt="Back of a NoneRev card and a NoneRev gift card, with the PIN area marked">
                    <div class="redeem-steps">
                        <div>Cards are handed out on the <a href="/discord">Discord</a> and by the admins. Scratch off the silver strip on the back of your NoneRev card.</div>
                        <div>Enter the PIN in the section to the right.</div>
                        <div>Dashes do not matter.</div>
                        <div>The NONEBUX on the card goes straight to your account!</div>
                    </div>
                    <div class="redeem-footnote">Each card can only be redeemed once. Spend your NONEBUX on Builders Club and on items in the catalog.</div>
                </div>
                <div id="CodeInput">
                    <div class="redeem-badge">Enter Your PIN</div>
                    <form class="redeem-form" onsubmit={redeem}>
                        <input id="pin" type="text" maxlength="19" autocomplete="off" spellcheck="false" aria-label="PIN" bind:value={pin}>
                        <button type="submit" class="btn-small btn-primary" class:disabled={busy || pin.trim() === ""} disabled={busy || pin.trim() === ""}>Redeem</button>
                    </form>
                    <div class="redeem-balance"><b>Your Balance:</b> <span>N${n(session.me.currency)}</span></div>
                    <div class="redeem-help">Need a NoneRev card? Cards are handed out on our <a href="/discord">Discord</a> and by the admins.</div>
                </div>
                {#if credited > 0}
                    <div class="redeem-result redeem-result-success" role="status">
                        <img src="/img/redeem/thumbs-up.svg" alt="">
                        <span>{n(credited)} NONEBUX has been credited to your account!</span>
                    </div>
                {:else if error}
                    <div class="redeem-result redeem-result-error" role="alert">
                        <img src="/img/redeem/thumbs-down.svg" alt="">
                        <span>{error}</span>
                    </div>
                {/if}
            {/if}
        </div>
        <div id="MoreInfo">
            <p class="GameCardPromo">Get NoneRev credit and spend it on:</p>
            <div class="redeem-product">
                <span class="redeem-tile redeem-tile-nonebux"></span>
                <span class="BigLinks">NONEBUX</span>
            </div>
            <div class="redeem-product">
                <span class="redeem-tile redeem-tile-bc"></span>
                <span class="BigLinks"><a href="/premium/membership">Classic Builders Club</a></span>
            </div>
            <div class="redeem-product">
                <span class="redeem-tile redeem-tile-tbc"></span>
                <span class="BigLinks"><a href="/premium/membership">Turbo Builders Club</a></span>
            </div>
            <div class="redeem-product">
                <span class="redeem-tile redeem-tile-obc"></span>
                <span class="BigLinks"><a href="/premium/membership">Outrageous Builders Club</a></span>
            </div>
        </div>
    </div>
</div>
</main>
