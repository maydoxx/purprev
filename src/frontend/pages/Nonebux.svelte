<script lang="ts">
    const packages = [
        { amount: 400, price: "4.95", bonus: 50 },
        { amount: 800, price: "9.95", bonus: 200 },
        { amount: 2000, price: "24.95", bonus: 750 },
        { amount: 4500, price: "49.95", bonus: 1500 },
        { amount: 10000, price: "99.95", bonus: 5000 },
        { amount: 22500, price: "199.95", bonus: 12500 }
    ];

    let notice = $state("");

    const unavailable = () => {
        notice = "Nonebux checkout is not available yet. No purchase was made.";
    };
</script>

<svelte:head>
    <title>Buy Nonebux - NoneRev</title>
    <link rel="stylesheet" href="/css/nonebux.css">
</svelte:head>

<main class="rbx-content nonebux-page">
    <div class="nonebux-shell">
        <h1>Buy NONEBUX<span class="nonebux-mark">™</span></h1>

        <section class="nonebux-intro" aria-label="About Nonebux">
            <div class="nonebux-intro-icon" aria-hidden="true"></div>
            <div class="nonebux-intro-copy">
                <p>NONEBUX is the virtual currency used in NoneRev games.</p>
                <p>You can also use NONEBUX to find a great look for your character.</p>
                <p>Get cool gear to take into multiplayer battles.</p>
                <p>Buy Limited items to sell and trade. You’ll need NONEBUX to make it all happen. What are you waiting for?</p>
            </div>
        </section>

        {#if notice}
            <div class="nonebux-notice" role="status">
                <span>{notice}</span>
                <button type="button" aria-label="Dismiss message" onclick={() => notice = ""}>×</button>
            </div>
        {/if}

        <div class="nonebux-grid">
            {#each packages as pack}
                <section class="nonebux-card" aria-label={`${pack.amount.toLocaleString("en-US")} Nonebux package`}>
                    <div class="nonebux-amount"><strong>{pack.amount.toLocaleString("en-US")}</strong><span>NONEBUX</span></div>
                    <button class="nonebux-buy" type="button" onclick={unavailable}>Buy for ${pack.price}</button>
                    <p>Want to get {pack.bonus.toLocaleString("en-US")} Bonus NONEBUX?</p>
                    <a class="nonebux-bonus-link" href="/upgrades/builders-club">Join Builders Club</a>
                </section>
            {/each}
        </div>

        <p class="nonebux-footnote">Package prices shown for the page preview. Checkout and Builders Club are not available yet; no payment will be taken.</p>
    </div>
</main>
