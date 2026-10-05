<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    const tier = $derived(["BC", "TBC", "OBC"].includes(router.query.tier ?? "") ? router.query.tier! : "BC");
    const period = $derived(router.query.period === "annual" ? "annual" : "monthly");

    const labels: Record<string, string> = {
        BC: "Builders Club",
        TBC: "Turbo Builders Club",
        OBC: "Outrageous Builders Club"
    };

    const titles = ["Secure Payment with NoneRev", "Redeem Credit", "Success"];

    let data = $state<any>(null);
    let step = $state(1);
    let method = $state("");
    let paying = $state(false);
    let error = $state("");
    let pin = $state("");
    let redeeming = $state(false);
    let pinError = $state("");

    api("/membership").then(d => data = d).catch(err => error = err.message);

    const price = $derived(data ? Number(data.tiers.find((t: any) => t.id === tier)?.[period] ?? 0) : 0);
    const balance = $derived(session.me?.currency ?? 0);
    const left = $derived(balance - price);
    const n = (v: number) => Number(v).toLocaleString("en-US");
    const term = $derived(period === "annual" ? "Annually" : "Monthly");

    const renews = $derived.by(() => {
        const days = period === "annual" ? 365 : 30;
        const base = session.me && session.me.membership === tier && session.me.membership_expires > Date.now() / 1000 ? session.me.membership_expires * 1000 : Date.now();
        return new Date(base + days * 86400000).toLocaleDateString("en-US");
    });

    const redeem = async (e: Event) => {
        e.preventDefault();
        if (redeeming || pin.trim() === "") {
            return;
        }
        redeeming = true;
        pinError = "";
        try {
            const d = await api("/membership/redeem", {
                code: pin
            });
            session.set(d.user);
            pin = "";
        } catch (err: any) {
            pinError = err.message;
        }
        redeeming = false;
    };

    const buy = async () => {
        paying = true;
        error = "";
        try {
            await api("/membership/buy", {
                tier,
                period
            });
            await session.refresh();
            step = 3;
        } catch (err: any) {
            error = err.message;
        }
        paying = false;
    };
</script>

<svelte:head>
    <title>NoneRev.com</title>
    <link rel="stylesheet" href="/css/membership.css">
</svelte:head>

<main class="rbx-content">
<div class="bc-body">
    <div id="PaymentPage">
        <h1>{titles[step - 1]}</h1>
        <img class="checkout-lock" src="/img/checkout/lock.svg" alt="lock">

        <div class="checkout-steps">
            <span class:on={step === 1}>1</span><i></i><span class:on={step === 2}>2</span><i></i><span class:on={step === 3}>3</span>
        </div>

        {#if step === 3}
            <div class="checkout-done">
                <div class="checkout-done-product">
                    <div class="checkout-done-name">{labels[tier]}</div>
                    <img src="/img/bc/{tier.toLowerCase()}.png" alt={tier}>
                    <div>{term}</div>
                    <div class="checkout-done-price">N${n(price)}</div>
                </div>
                <div class="checkout-done-text">
                    <h2>Thank you for your purchase!</h2>
                    <p class="checkout-done-first">Your new membership is already active on your account. We hope you find your time at NoneRev to be both safe and fun. If there is ever anything we can do to make your experience even better, please let us know.</p>
                    <p>Please visit our <a href="/discord">Discord</a> if you are experiencing any issues or have any questions.</p>
                    <p>Thanks again,<br>The NoneRev team</p>
                </div>
            </div>
        {:else}
            <div class="checkout-body" class:checkout-first={step === 1}>
                <div class="checkout-order">
                    <img src="/img/bc/{tier.toLowerCase()}.png" alt={tier}>
                    <div class="checkout-product">
                        <h2>{labels[tier]}</h2>
                        {#if step === 1}
                            <p>{term}</p>
                            <p>Renews On: {renews}</p>
                        {:else}
                            <p>N${n(price)}</p>
                        {/if}
                    </div>
                    {#if step === 1}
                        <div class="checkout-summary">
                            <div><span>{labels[tier]}</span><span>N${n(price)}</span></div>
                            <div class="total"><span>Total Due:</span><span>N${n(price)}</span></div>
                        </div>
                    {/if}
                </div>

                <div class="checkout-pay">
                    {#if step === 1}
                        <p class="checkout-pay-title">Select payment type:</p>
                        <label class="payment-row">
                            <input type="radio" name="pay" value="nonebux" bind:group={method}>
                            <span class="payment-logo"><img src="/img/nonebux-green.png" alt="Nonebux"></span>
                            NONEBUX balance ({n(balance)})
                        </label>
                        <button type="button" class="btn-checkout" disabled={!method || !data} onclick={() => step = 2}>Continue</button>
                        {#if error}
                            <div class="checkout-pin-error">{error}</div>
                        {/if}
                    {:else}
                        <p class="checkout-pay-title checkout-pay-redeem">Redeem cards in the section below.</p>
                        <img class="checkout-cards" src="/img/redeem/card-tiles.png" alt="NoneRev cards">
                        <form class="checkout-pin" onsubmit={redeem}>
                            <label for="pin">Enter PIN:</label>
                            <input id="pin" type="text" maxlength="19" autocomplete="off" spellcheck="false" bind:value={pin}>
                            <button type="submit" class="btn-checkout btn-checkout-small" disabled={redeeming || pin.trim() === ""}>Redeem</button>
                        </form>
                        {#if pinError}
                            <div class="checkout-pin-error">{pinError}</div>
                        {/if}
                        <div class="checkout-credit">
                            <div><span>NONEBUX Balance</span><span class="credit">N${n(balance)}</span></div>
                            <div class="due"><span>{labels[tier]}</span><span>-N${n(price)}</span></div>
                            <div class:short={left < 0}><span>Balance</span><span class="left">{left < 0 ? "-" : ""}N${n(Math.abs(left))}</span></div>
                        </div>
                        {#if error}
                            <div class="checkout-pin-error">{error}</div>
                        {/if}
                        <button type="button" class="btn-checkout" disabled={left < 0 || paying || !data} onclick={buy}>{paying ? "Please wait…" : "Submit Order"}</button>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
</main>
