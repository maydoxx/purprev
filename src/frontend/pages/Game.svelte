<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const id = $derived(Number(router.query.id) || 0);

    let game = $state<any>(null);
    let missing = $state(false);
    let passes = $state<any[]>([]);
    let badges = $state<any[]>([]);
    let tab = $state(location.hash === "#store" ? "store" : location.hash === "#servers" ? "servers" : "about");
    let storeMsg = $state("");
    let storeOk = $state(false);
    let buying = $state(0);

    const list = (d: any, key: string) => Array.isArray(d) ? d : Array.isArray(d?.[key]) ? d[key] : [];

    $effect(() => {
        game = null;
        missing = false;
        if (!id) {
            missing = true;
            return;
        }
        api(`/games/${id}`).then(d => {
            if (d && d.id) {
                game = d;
            } else {
                missing = true;
            }
        }).catch(() => {
            missing = true;
        });
        api(`/games/${id}/passes`).then(d => {
            passes = list(d, "passes");
        }).catch(() => {});
        api(`/games/${id}/badges`).then(d => {
            badges = list(d, "badges");
        }).catch(() => {});
    });

    const buy = async (pass: any) => {
        buying = pass.id;
        storeMsg = "";
        try {
            await api(`/games/passes/${pass.id}/purchase`, {});
            storeOk = true;
            storeMsg = `You bought ${pass.name}.`;
            await session.refresh();
        } catch (err: any) {
            storeOk = false;
            storeMsg = err.message;
        }
        buying = 0;
    };

    const compact = (n: number) => {
        n = Number(n) || 0;
        if (n >= 1000000) return (Math.round(n / 100000) / 10) + "M+";
        if (n >= 1000) return (Math.round(n / 100) / 10) + "K+";
        return n.toLocaleString();
    };

    const date = (v: any) => {
        if (!v) return "N/A";
        const d = typeof v === "number" ? new Date(v * 1000) : new Date(v);
        return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US");
    };

    const thumbnail = $derived(game?.thumbnail || "/img/DefaultThumb.png");
    const up = $derived(Number(game?.up_votes ?? game?.likes) || 0);
    const down = $derived(Number(game?.down_votes ?? game?.dislikes) || 0);
    const ratio = $derived(up + down > 0 ? Math.round(up / (up + down) * 100) : 0);
</script>

<svelte:head>
    <title>{game ? game.title : missing ? "Game Not Found" : "Game"} - NoneRev</title>
    <link rel="stylesheet" href="/css/games.css">
</svelte:head>

{#snippet tabLink(key: string, label: string)}
    <li class="nav-item" role="presentation">
        <button class="nav-link" class:active={tab === key} type="button" role="tab" onclick={() => tab = key}>{label}</button>
    </li>
{/snippet}

<main class="game-detail-page">
    <div class="game-detail-shell">
        {#if missing}
            <div class="game-detail-empty section-2016">
                <h2>Game not found</h2>
                <p>The game you are looking for does not exist.</p>
                <a class="btn-2016-blue" href="/games">Back to Games</a>
            </div>
        {:else if game}
            <section class="game-hero-2016">
                <div class="game-media-column">
                    <div class="carousel slide game-carousel-2016">
                        <div class="carousel-inner">
                            <div class="carousel-item active">
                                <img class="game-carousel-image" src={thumbnail} alt={game.title}>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="game-actions-column">
                    <h1 class="game-name-2016" title={game.title}>{game.title}</h1>
                    <h4 class="game-creator-2016"><span>By</span> <a href="/user?id={game.creator_id}">{game.creator_name || "Unknown"}</a></h4>

                    <div class="game-play-area">
                        {#if !session.me}
                            <a class="btn-play-2016" href="/login">Play</a>
                        {:else}
                            <!-- TODO: launcher, needs the rcc manager -->
                            <button type="button" class="btn-play-2016" disabled>Play</button>
                            <p class="text-center mt-2">Playing is not available yet.</p>
                        {/if}
                    </div>

                    <ul class="share-rate-favorite-2016">
                        <li class="favorite-2016" title="Favorites">
                            <span class="favorite-star">★</span>
                            <span>{compact(game.favorites)}</span>
                        </li>
                        <li class="voting-panel-2016">
                            <div class="vote-counts-2016">
                                <span>👍 {compact(up)}</span>
                                <span>{compact(down)} 👎</span>
                            </div>
                            <div class="vote-track-2016" title="{ratio}% positive">
                                <div class="vote-fill-2016" style="width: {ratio}%;"></div>
                            </div>
                        </li>
                    </ul>
                </div>
            </section>

            <section class="game-tabs-2016">
                <ul class="nav nav-tabs game-tab-list-2016" role="tablist">
                    {@render tabLink("about", "About")}
                    {@render tabLink("store", "Store")}
                    {@render tabLink("servers", "Servers")}
                </ul>

                <div class="tab-content game-tab-content-2016">
                    <div class="tab-pane fade" class:show={tab === "about"} class:active={tab === "about"} id="about" role="tabpanel">
                        <div class="section-2016 game-about-2016">
                            <h3>Description</h3>
                            <p class="game-description-2016" style="white-space: pre-line">{game.description?.trim() || "No description available."}</p>

                            <ul class="game-stats-2016">
                                <li><p class="stat-title">Active</p><p class="stat-value">0</p></li>
                                <li><p class="stat-title">Visits</p><p class="stat-value">{compact(game.visits)}</p></li>
                                <li><p class="stat-title">Created</p><p class="stat-value">{date(game.created_at)}</p></li>
                                <li><p class="stat-title">Updated</p><p class="stat-value">{date(game.updated_at)}</p></li>
                                <li><p class="stat-title">Max Players</p><p class="stat-value">{(Number(game.max_players) || 50).toLocaleString()}</p></li>
                                <li><p class="stat-title">Genre</p><p class="stat-value"><a href="/games">{game.genre || "All"}</a></p></li>
                            </ul>

                            <div class="game-stat-footer-2016">
                                <span>This game is copylocked</span>
                                <a href="/discord">Report Abuse</a>
                            </div>
                        </div>

                        <div class="section-2016 game-badges-2016">
                            <h3>Badges</h3>
                            {#if badges.length === 0}
                                <p class="game-store-empty">This game has no badges.</p>
                            {:else}
                                <div class="game-badge-grid">
                                    {#each badges as b (b.id)}
                                        <div class="game-badge-card" class:disabled={b.disabled}>
                                            <img src={b.icon || "/img/pending.png"} alt={b.name}>
                                            <div>
                                                <strong>{b.name}</strong>
                                                <p>{b.description || ""}</p>
                                                <span>{b.disabled ? "Disabled" : `Won by ${(Number(b.awarded) || 0).toLocaleString()} players`}</span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="tab-pane fade" class:show={tab === "store"} class:active={tab === "store"} id="store" role="tabpanel">
                        <div class="section-2016">
                            <h3>Store</h3>
                            {#if storeMsg}
                                <div class="game-store-alert" class:success={storeOk} class:error={!storeOk}>{storeMsg}</div>
                            {/if}
                            {#if passes.length === 0}
                                <p class="game-store-empty">This game has no passes for sale.</p>
                            {:else}
                                <div class="game-pass-grid">
                                    {#each passes as pass (pass.id)}
                                        <div class="game-pass-card">
                                            <img src={pass.icon || "/img/pending.png"} alt={pass.name}>
                                            <div class="game-pass-card-body">
                                                <strong title={pass.name}>{pass.name}</strong>
                                                <p>{pass.description || ""}</p>
                                                <div class="game-pass-buy-row">
                                                    <span>{(Number(pass.price) || 0).toLocaleString()} Nonebux</span>
                                                    {#if pass.owned}
                                                        <button type="button" class="btn-2016-gray" disabled>Owned</button>
                                                    {:else if !session.me}
                                                        <a class="btn-2016-blue" href="/login">Buy</a>
                                                    {:else}
                                                        <button type="button" class="btn-2016-blue" disabled={buying === pass.id} onclick={() => buy(pass)}>Buy</button>
                                                    {/if}
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="tab-pane fade" class:show={tab === "servers"} class:active={tab === "servers"} id="servers" role="tabpanel">
                        <div class="section-2016 servers-2016">
                            <div class="servers-banner-2016">
                                <span>Play this game with friends and other people you invite.</span>
                                <button class="btn-2016-gray" type="button" disabled>Create VIP Server</button>
                            </div>
                            <div class="server-list-empty-2016">
                                <h3>Servers</h3>
                                <p>No servers are running right now.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        {/if}
    </div>
</main>
