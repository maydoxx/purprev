<script lang="ts">
    const packages = [
        {
            amount: 400,
            price: "4.95",
            bonus: 50
        },
        {
            amount: 800,
            price: "9.95",
            bonus: 200
        },
        {
            amount: 2000,
            price: "24.95",
            bonus: 750
        },
        {
            amount: 4500,
            price: "49.95",
            bonus: 1500
        },
        {
            amount: 10000,
            price: "99.95",
            bonus: 5000
        },
        {
            amount: 22500,
            price: "199.95",
            bonus: 12500
        }
    ];

    let notice = $state("");

    const n = (v: number) => v.toLocaleString("en-US");

    const unavailable = (e: Event) => {
        e.preventDefault();
        notice = "Nonebux checkout is not available yet. No purchase was made.";
    };
</script>

<svelte:head>
    <title>NONEBUX - NoneRev</title>
    <link rel="stylesheet" href="/css/nonebux.css">
</svelte:head>

<main class="rbx-content nonebux-page">
    <div id="NonebuxContainer" class="nonebux-container">
        <div class="nonebux-header">
            <h1>Buy NONEBUX</h1>
            <h3>™</h3>
        </div>
        <ul class="nonebux-grid">
            <li class="cell nonebux-cell-header">
                <div class="cell-content">
                    <div class="nonebux-header-icon">
                        <span class="icon-nonebux"></span>
                    </div>
                    <p class="nonebux-header-desc">
                        <span>NONEBUX is the virtual currency used in many of our online games.</span>
                        <span>You can also use NONEBUX for finding a great look for your avatar.</span>
                        <span>Get cool gear to take into multiplayer battles.</span>
                        <span>Buy Limited items to sell and trade. You’ll need NONEBUX to make it all happen. What are you waiting for?</span>
                    </p>
                </div>
            </li>
        </ul>
        {#if notice}
            <div class="nonebux-notice" role="status">
                <span>{notice}</span>
                <button type="button" aria-label="Dismiss message" onclick={() => notice = ""}>×</button>
            </div>
        {/if}
        <ul class="nonebux-grid">
            {#each packages as pack}
                <li class="cell col-grid-4">
                    <div class="cell-content">
                        <div class="nonebux-title">
                            <h1>{n(pack.amount)}</h1>
                            <h2>NONEBUX</h2>
                        </div>
                        <a href="/upgrades/paymentmethods?ap={pack.amount}" class="btn-primary-md nonebux-product-price btn-full-width nonebux-buy" onclick={unavailable}>Buy for ${pack.price}</a>
                        <div class="nonebux-bonus-nbc">
                            Want to get <span class="nonebux-bonus">{n(pack.bonus)} Bonus NONEBUX</span> ?
                        </div>
                        <a href="/premium/membership" class="text-name">Join Builders Club</a>
                    </div>
                </li>
            {/each}
        </ul>
        <div class="xsmall nonebux-footer">
            Prices for Turbo and Outrageous Builders Club are the same as for regular Builders Club. All sales are final. Please see our <a href="/info/tos" class="text-name xsmall">Terms &amp; Conditions</a> for more information.
        </div>
    </div>
</main>
