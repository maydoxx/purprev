<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";
    import NotFound from "./NotFound.svelte";

    const wearable = ["Hat", "Face", "Shirt", "Pants", "T-Shirt"];

    const id = $derived(Number(router.query.id) || 0);

    let item = $state<any>(null);
    let missing = $state(false);
    let status = $state("");
    let statusError = $state(false);
    let busy = $state(false);
    let shareLabel = $state("Share");

    const load = async () => {
        try {
            const d = await api(`/catalog/${id}`);
            item = d.id ? d : null;
            missing = !item;
        } catch {
            missing = true;
        }
    };

    $effect(() => {
        item = null;
        missing = false;
        status = "";
        if (id > 0) load();
        else missing = true;
    });

    const limited = $derived(item && (item.is_limited || item.is_limited_unique));
    const limitedUnique = $derived(item && item.is_limited_unique);
    const remaining = $derived(limitedUnique && item.limited_stock !== null ? Math.max(0, item.limited_stock - item.limited_sold) : null);
    const soldOut = $derived(limitedUnique && remaining !== null && remaining <= 0);
    const canWear = $derived(item && wearable.includes(item.category) && !!item.asset_id);
    const balance = $derived(session.me?.currency ?? 0);
    const sales = $derived(item ? Number(limitedUnique ? item.limited_sold : item.sales ?? 0) : 0);

    const post = async (path: string, body: unknown, working: string) => {
        busy = true;
        statusError = false;
        status = working;
        try {
            await api(path, body);
            status = "";
            await Promise.all([load(), session.refresh()]);
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        busy = false;
    };

    const buy = () => post("/catalog/purchase", {
        itemId: id
    }, "Working...");

    const wear = () => post("/user/avatar/wear", {
        itemId: id,
        wear: !item.wearing
    }, "Updating your avatar...");

    const share = async () => {
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: location.href
            }).catch(() => {});
            return;
        }
        await navigator.clipboard.writeText(location.href);
        shareLabel = "Link Copied";
        setTimeout(() => shareLabel = "Share", 1400);
    };

    const date = (t: number) => t > 0 ? new Date(t * 1000).toLocaleDateString("en-US") : "N/A";
    const ago = (t: number) => {
        if (!(t > 0)) return "N/A";
        const diff = Math.max(0, Date.now() / 1000 - t);
        const units: [number, string][] = [
            [31536000, "year"],
            [2592000, "month"],
            [604800, "week"],
            [86400, "day"],
            [3600, "hour"],
            [60, "minute"]
        ];
        for (const [secs, name] of units) {
            if (diff >= secs) {
                const n = Math.floor(diff / secs);
                return `${n} ${name}${n === 1 ? "" : "s"} ago`;
            }
        }
        return "just now";
    };
    const n = (v: any) => Number(v ?? 0).toLocaleString();
</script>

<svelte:head>
    <title>{item ? item.name : "Catalog"} - NoneRev</title>
    <link rel="stylesheet" href="/css/catalog-item.css">
</svelte:head>

{#if missing}
    <NotFound />
{:else}
<main class="rbx-content catalog-item-shell">
{#if item}
    <div class="catalog-item-page">
        <header class="catalog-item-heading">
            <h1>{item.name}</h1>
            <div class="catalog-item-type">NoneRev {item.category}</div>
        </header>

        <div class="catalog-item-layout">
            <section class="catalog-item-picture-column">
                <div class="catalog-item-picture-wrap">
                    <img class="catalog-item-picture" src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                    {#if limited}
                        <img class="catalog-item-limited-overlay" src={limitedUnique ? "/img/catalog/overlay-limited-unique.png" : "/img/catalog/overlay-limited.png"} alt={limitedUnique ? "Limited U" : "Limited"}>
                    {/if}
                </div>
            </section>

            <section class="catalog-item-information">
                <div class="catalog-creator-block">
                    <a class="catalog-creator-avatar" href="/user?id={item.creator_id ?? 0}">
                        <img src="/api/user/getProfilePicture?userId={item.creator_id ?? 0}&type=full" alt={item.creator_name ?? "NoneRev"}>
                    </a>
                    <div class="catalog-creator-meta">
                        <div><span>Creator:</span> <a href="/user?id={item.creator_id ?? 0}">{item.creator_name ?? "NoneRev"}</a></div>
                        <div><span>Created:</span> {date(item.created_at)}</div>
                        <div><span>Updated:</span> {ago(item.updated_at)}</div>
                    </div>
                </div>

                <div class="catalog-item-description" style="white-space: pre-line">{item.description || "No description available."}</div>

                {#if limited}
                    <div class="catalog-limited-details">
                        <strong>{limitedUnique ? "Limited U" : "Limited"}</strong>
                        <span>Tradeable</span>
                        {#if limitedUnique}
                            <span>{n(item.limited_sold)} of {n(item.limited_stock)} sold</span>
                            {#if !soldOut}
                                <span>{n(remaining)} remaining</span>
                            {:else}
                                <span>Sold Out</span>
                            {/if}
                        {/if}
                        {#if item.serial_number != null}
                            <span class="catalog-item-serial">Your serial: #{n(item.serial_number)} of {n(item.limited_stock)}</span>
                        {/if}
                    </div>
                {/if}

                <div class="catalog-item-report">Report Abuse</div>

                <div class="catalog-item-rule"></div>

                <div class="catalog-item-genre-label">Genres:</div>
                <a class="catalog-item-genre" href="/catalog?category=all"><span class="catalog-genre-cube">◆</span> All</a>

                {#if session.me && session.me.admin > 0}
                    <div class="catalog-item-admin-link"><a href="/admi/catalog?edit={item.id}">Edit item</a></div>
                {/if}
            </section>

            <aside class="catalog-item-actions">
                <div class="catalog-buy-box">
                    <div class="catalog-buy-price">
                        {#if item.price === null}
                            <span class="catalog-buy-label">Price:</span> <strong>Off Sale</strong>
                        {:else if Number(item.price) === 0}
                            <span class="catalog-buy-label">Price:</span> <strong class="catalog-buy-green">Free</strong>
                        {:else}
                            <span class="catalog-buy-label">Price:</span> <span class="robux">{n(item.price)}</span>
                        {/if}
                    </div>

                    <div class="catalog-buy-action">
                        {#if !session.me}
                            <a class="catalog-buy-button catalog-login-button" href="/login">Log In to Buy</a>
                        {:else if item.owned}
                            <div class="catalog-owned-label">Item Owned</div>
                            {#if canWear}
                                <button type="button" class="catalog-buy-button" class:catalog-remove-button={item.wearing} disabled={busy} onclick={wear}>{item.wearing ? "Remove" : "Wear Item"}</button>
                            {:else if !item.asset_id}
                                <div class="catalog-action-note">No wearable model is attached.</div>
                            {/if}
                        {:else if soldOut}
                            <button type="button" class="catalog-buy-button catalog-disabled-button" disabled>Sold Out</button>
                        {:else if item.price === null}
                            <button type="button" class="catalog-buy-button catalog-disabled-button" disabled>Off Sale</button>
                        {:else}
                            <button type="button" class="catalog-buy-button" disabled={busy || balance < Number(item.price)} onclick={buy}>
                                {Number(item.price) === 0 ? "Get Item" : "Buy with N$"}
                            </button>
                            {#if balance < Number(item.price)}
                                <div class="catalog-action-error">You need {n(Number(item.price) - balance)} more.</div>
                            {/if}
                        {/if}
                    </div>

                    <div class="catalog-sold-count">({n(sales)} Sold)</div>
                </div>

                <div class="catalog-item-status" class:error={statusError}>{status}</div>

                <button type="button" class="catalog-share-button" onclick={share}><span>+</span> {shareLabel}</button>
            </aside>
        </div>
    </div>
{/if}
</main>
{/if}
