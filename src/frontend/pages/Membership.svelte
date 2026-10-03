<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let data = $state<any>(null);
    let error = $state("");

    api("/membership").then(d => data = d).catch(err => error = err.message);

    const n = (v: number) => Number(v).toLocaleString("en-US");
    const names: Record<string, string> = {
        BC: "Classic",
        TBC: "Turbo",
        OBC: "Outrageous"
    };

    const tier = (id: string) => data?.tiers.find((t: any) => t.id === id);
    const price = (id: string, period: string) => data ? "N$" + n(tier(id)?.[period] ?? 0) : "…";
    const money = (v: number | undefined) => v === undefined ? "…" : "N$" + n(v);
    const count = (v: number | undefined, bang = false) => v === undefined ? "…" : v === 0 ? "No" : n(v) + (bang && v >= 100 ? "!" : "");
    const percent = (v: number | undefined) => v === undefined ? "…" : v + "%";

    const pick = (id: string, period: string) => {
        if (!session.me) {
            router.go("/login");
            return;
        }
        router.go(`/upgrades/paymentmethods?tier=${id}&period=${period}`);
    };

    const until = (t: number) => new Date(t * 1000).toLocaleDateString("en-US");

    const big = $derived<[string, string, string, string, string, boolean][]>([
        ["Daily NONEBUX", money(data?.free.stipend), money(tier("BC")?.stipend), money(tier("TBC")?.stipend), money(tier("OBC")?.stipend), true],
        ["Active Places", count(data?.free.places), count(tier("BC")?.places), count(tier("TBC")?.places), count(tier("OBC")?.places, true), true],
        ["Join Groups", count(data?.free.joinGroups), count(tier("BC")?.joinGroups), count(tier("TBC")?.joinGroups), count(tier("OBC")?.joinGroups, true), false],
        ["Create Groups", count(data?.free.createGroups), count(tier("BC")?.createGroups), count(tier("TBC")?.createGroups), count(tier("OBC")?.createGroups, true), false],
        ["Signing Bonus*", "No", money(data?.signingBonus), money(data?.signingBonus), money(data?.signingBonus), false],
        ["Paid Access", percent(data?.free.paidAccess), percent(tier("BC")?.paidAccess), percent(tier("TBC")?.paidAccess), percent(tier("OBC")?.paidAccess), false]
    ]);
    const small = ["Ad Free", "Sell Stuff", "Virtual Hat", "Bonus Gear", "BC Beta Features", "Trade System"];
</script>

<svelte:head>
    <title>Upgrade - NoneRev</title>
    <link rel="stylesheet" href="/css/membership.css">
</svelte:head>

<main class="rbx-content">
<div class="bc-body">
    <div id="BCPageContainer">
        <div class="header">
            <span><h1>Upgrade to NoneRev Builders Club</h1></span>
            {#if session.me && session.me.membership !== "None"}
                <span class="expire-text">{names[session.me.membership]} member{#if session.me.membership_expires > 0}, renews on <span class="date">{until(session.me.membership_expires)}</span>{/if}</span>
            {/if}
        </div>

        {#if error}
            <div class="notice error">{error}</div>
        {/if}

        <div class="left-column">
            <table cellspacing="0" border="0">
                <thead class="product-title">
                    <tr>
                        <td class="center-bold">
                            <h2 class="product-space">Free</h2>
                            <img data-attribute="free" src="/img/bc/free.png" alt="free">
                        </td>
                        <td class="center-bold">
                            <h2 class="product-space">Classic</h2>
                            <img data-attribute="classic" src="/img/bc/bc.png" alt="bc">
                        </td>
                        <td class="center-bold">
                            <h2 class="product-space">Turbo</h2>
                            <img data-attribute="turbo" src="/img/bc/tbc.png" alt="tbc">
                        </td>
                        <td class="center-bold">
                            <h2 class="product-space">Outrageous</h2>
                            <img data-attribute="outrageous" src="/img/bc/obc.png" alt="obc">
                        </td>
                    </tr>
                </thead>

                <tbody class="product-summary summary-big">
                    {#each big as [label, free, bc, tbc, obc, emphasis]}
                        <tr>
                            <td class="divider-top">
                                <span class="product-description">{label}</span>
                                <span class="nbc-product">{free}</span>
                            </td>
                            <td class="divider-top bc-product">{bc}</td>
                            <td class="divider-top tbc-product" class:emphasis>{tbc}</td>
                            <td class="divider-top obc-product" class:emphasis>{obc}</td>
                        </tr>
                    {/each}
                    <tr>
                        <td colspan="4">* Signing bonus is for first time membership purchase only.</td>
                    </tr>
                </tbody>

                <tbody class="product-grid">
                    {#each ["monthly", "annual"] as period}
                        <tr>
                            <td class="product-cell divider-left">
                                <div class="product-nbc divider-bottom"></div>
                            </td>
                            {#each ["BC", "TBC", "OBC"] as id}
                                <td class="product-cell divider-left">
                                    <div class="product-cell">
                                        <div class="product-text">
                                            <h3>{period === "annual" ? "Annually" : "Monthly"}</h3>
                                        </div>
                                        <a data-rank={id} data-duration={period} class="btn-medium btn-primary product-button" href="/upgrades/paymentmethods?tier={id}&period={period}" onclick={e => { e.preventDefault(); pick(id, period); }}>{price(id, period)}</a>
                                    </div>
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>

                <tbody class="product-summary summary-small">
                    {#each small as label}
                        <tr>
                            <td class="divider-top">
                                <span class="product-description">{label}</span>
                                <span class="nbc-product">No</span>
                            </td>
                            <td class="divider-top bc-product emphasis">✔</td>
                            <td class="divider-top tbc-product emphasis">✔</td>
                            <td class="divider-top obc-product emphasis">✔</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <div class="right-column">
            <div id="RightColumnWrapper">
                <div class="cell cellDivider">
                    For billing and payment questions: <a href="mailto:admin@nonerev.de">admin@nonerev.de</a>
                </div>
                <div class="cell cellDivider">
                    <h3>Buy NONEBUX</h3>
                    <p>NONEBUX is the virtual currency used in many of our online games. You can also use NONEBUX for finding a great look for your avatar. Get cool gear to take into multiplayer battles. Buy Limited items to sell and trade. You’ll need NONEBUX to make it all happen. What are you waiting for?</p>
                    <p>
                        <a href="/upgrades/nonebux" class="btn-medium btn-primary">Buy NONEBUX</a>
                    </p>
                    <h3>Buy NONEBUX with</h3>
                    <br>
                    <br>
                    <a href="/upgrades/nonebux">
                        <img src="/img/bc/rixty.png" alt="rixty">
                    </a>
                    <br>
                    <br>
                    <a href="/upgrades/nonebux">
                        <img src="/img/bc/itunes.png" alt="itunes">
                    </a>
                </div>
                <div class="cell cellDivider">
                    <h3>Game Cards</h3>
                    <a href="/redeem"><img alt="NoneRev Gamecards" src="/img/bc/gamecards.png"></a>
                    <div class="gameCardControls">
                        <div class="gameCardButton">
                            <a href="/discord" class="btn-small btn-primary">Where to Buy</a>
                        </div>
                        <div><a href="/redeem" class="redeemLink">Redeem Card</a></div>
                        <div class="clear"></div>
                    </div>
                </div>
                <div class="cell">
                    <h3>Parents</h3>
                    <p>Learn more about Builders Club and how we help <a href="/info/tos">keep kids safe.</a></p>
                    <h3>Cancellation</h3>
                    <p>Builders Club is paid up front with NONEBUX for the period you pick and you keep your privileges for the remainder of the paid period. You can see your renewal date and manage your membership on the <a href="/my/settings?tab=billing">Billing</a> tab of the Settings page.</p>
                </div>
            </div>
        </div>
    </div>
</div>
</main>
