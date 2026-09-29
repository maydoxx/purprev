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

    let data = $state<any>(null);
    let paying = $state(false);
    let done = $state(false);
    let error = $state("");
    let agreed = $state(false);

    api("/membership").then(d => data = d).catch(err => error = err.message);

    const price = $derived(data ? Number(data.tiers.find((t: any) => t.id === tier)?.[period] ?? 0) : 0);
    const n = (v: number) => Number(v).toLocaleString("en-US");

    // same tier keeps going from when it would have ended
    const renews = $derived.by(() => {
        const days = period === "annual" ? 365 : 30;
        const base = session.me && session.me.membership === tier && session.me.membership_expires > Date.now() / 1000 ? session.me.membership_expires * 1000 : Date.now();
        return new Date(base + days * 86400000).toLocaleDateString("en-US");
    });

    const buy = async () => {
        paying = true;
        error = "";
        try {
            await api("/membership/buy", {
                tier,
                period
            });
            await session.refresh();
            done = true;
        } catch (err: any) {
            error = err.message;
        }
        paying = false;
    };
</script>

<svelte:head>
    <title>Secure Payment - NoneRev</title>
    <link rel="stylesheet" href="/css/membership.css">
</svelte:head>

<main class="rbx-content">
<div class="bc-body">
    <div id="BCPageContainer">
        <div class="header">
            <span><h1>Secure Payment with NoneRev</h1></span>
        </div>

        <div class="checkout-steps">
            <span class="on">1</span><i></i><span class:on={done}>2</span><i></i><span class:on={done}>3</span>
        </div>

        {#if error}
            <div class="notice error">{error}</div>
        {/if}

        {#if done}
            <div class="notice">You are now a {labels[tier]} member. Enjoy your daily NONEBUX. <a href="/user?id={session.me?.id}">See your profile</a> or <a href="/premium/membership">go back</a>.</div>
        {:else}
            <div class="checkout-order">
                <img src="/img/bc/{tier.toLowerCase()}.png" alt={tier}>
                <h2>{labels[tier]}</h2>
                <p>{period === "annual" ? "Annually" : "Monthly"}</p>
                <p>Renews On: {renews}</p>
                <div class="checkout-summary">
                    <div><span>{labels[tier]}</span><span>N${n(price)}</span></div>
                    <div class="total"><span>Total Due:</span><span>N${n(price)}</span></div>
                </div>
            </div>

            <div class="checkout-pay">
                <p>Select payment type:</p>
                <label><input type="radio" name="pay" bind:group={agreed} value={true}> <span class="coin">N$</span> NONEBUX balance ({n(session.me?.currency ?? 0)})</label>
                <a class="btn-medium btn-primary" class:disabled={!agreed || paying || !data} href="/premium/membership" onclick={e => { e.preventDefault(); if (agreed && !paying && data) buy(); }}>{paying ? "Please wait…" : "Continue"}</a>
            </div>
        {/if}
    </div>
</div>
</main>
