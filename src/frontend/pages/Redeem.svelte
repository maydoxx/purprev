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
        if (busy) {
            return;
        }
        busy = true;
        error = "";
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
    <title>Redeem NoneRev cards - NoneRev</title>
    <link rel="stylesheet" href="/css/membership.css">
</svelte:head>

<main class="rbx-content">
<div class="bc-body">
    <div id="RedeemPage">
        <h1>Redeem NoneRev cards</h1>
        <div id="RedeemContainer" class="divider-bottom">
            {#if !session.me}
                <span id="HowToUse">How To Use</span>
                <p>You must be logged in to Redeem NoneRev Cards. <a href="/login">Login now</a> to redeem and start playing!</p>
            {:else if credited > 0}
                <div class="redeem-success">
                    <div class="redeem-success-title">Redemption Successful!</div>
                    <img src="/img/nonebux-green.png" alt="Nonebux">
                    <div class="redeem-success-text">
                        <div><span class="redeem-amount">{n(credited)} NONEBUX</span> has been credited to your account.</div>
                        <div>Your balance is now <span class="redeem-amount">{n(session.me.currency)} NONEBUX</span>.</div>
                    </div>
                    <div class="redeem-success-buttons">
                        <a href="/upgrades/nonebux" class="btn-medium btn-primary">Spend it</a>
                        <button type="button" class="btn-medium btn-primary" onclick={() => credited = 0}>Redeem another</button>
                    </div>
                </div>
            {:else}
                <span id="HowToUse">How To Use</span>
                <ol>
                    <li>Scratch off the silver strip on the back of your NoneRev card. <span>Cards are handed out on the Discord and by the admins.</span></li>
                    <li>Enter the PIN below exactly as printed. <span>Dashes do not matter.</span></li>
                    <li>Click Redeem. <span>The NONEBUX on the card goes straight to your account.</span></li>
                </ol>
                <form class="redeem-form" onsubmit={redeem}>
                    <label for="pin">PIN</label>
                    <input id="pin" type="text" maxlength="19" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" bind:value={pin}>
                    <button type="submit" class="btn-medium btn-primary" class:disabled={busy || pin.trim() === ""} disabled={busy || pin.trim() === ""}>Redeem</button>
                </form>
                {#if error}
                    <div class="redeem-error">{error}</div>
                {/if}
            {/if}
        </div>
        <div id="MoreInfo">
            <p class="GameCardPromo">Get NoneRev credit and spend it on:</p>
            <div class="redeem-product">
                <img src="/img/nonebux-green.png" alt="Nonebux">
                <span class="BigLinks">Nonebux</span>
            </div>
            <div class="redeem-product">
                <img src="/img/bc/bc.png" alt="bc">
                <span class="BigLinks"><a href="/premium/membership">Classic Builders Club</a></span>
            </div>
            <div class="redeem-product">
                <img src="/img/bc/tbc.png" alt="tbc">
                <span class="BigLinks"><a href="/premium/membership">Turbo Builders Club</a></span>
            </div>
            <div class="redeem-product">
                <img src="/img/bc/obc.png" alt="obc">
                <span class="BigLinks"><a href="/premium/membership">Outrageous Builders Club</a></span>
            </div>
        </div>
    </div>
</div>
</main>
