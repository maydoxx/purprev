<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const id = $derived(Number(router.query.id) || 0);

    let game = $state<any>(null);
    let missing = $state(false);
    let passes = $state<any[]>([]);
    let badges = $state<any[]>([]);
    let recommended = $state<any[]>([]);
    let leaderboard = $state<any[]>([]);
    let servers = $state<any[]>([]);
    let vipServers = $state<any[]>([]);
    let vipForm = $state(false);
    let vipName = $state("");
    let vipInvite = $state<Record<number, string>>({});
    let vipBusy = $state(false);
    let vipMessage = $state("");
    let tab = $state(location.hash === "#store" ? "store" : location.hash === "#servers" ? "servers" : location.hash === "#leaderboards" ? "leaderboards" : "about");
    let storeMsg = $state("");
    let storeOk = $state(false);
    let buying = $state(0);
    let launching = $state(false);
    let linkCopied = $state(false);

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
        api(`/games/${id}/leaderboard`).then(d => {
            leaderboard = Array.isArray(d) ? d : [];
        }).catch(() => {
            leaderboard = [];
        });
        loadServers();
        api("/games?page=1").then(d => {
            recommended = list(d, "games").filter((item: any) => Number(item.id) !== id).slice(0, 6);
        }).catch(() => {});
    });

    const isApp = /ROBLOX (Android|iOS) App/i.test(navigator.userAgent);
    const isPhone = !isApp && /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    const isAndroid = isPhone && /Android/i.test(navigator.userAgent);

    const play = async (jobId = "") => {
        try {
            const d = await api(`/games/${id}/launch${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`);
            location.href = d.url;
            launching = true;
        } catch (err: any) {
            alert(err.message);
        }
    };

    // ?join=<jobId> is a discord join, press play once
    let autoJoined = false;
    $effect(() => {
        const join = String(router.query.join ?? "");
        if (!join || autoJoined || !game || !session.me) {
            return;
        }
        autoJoined = true;
        tab = "servers";
        play(join);
    });

    const loadServers = async () => {
        servers = await api(`/games/${id}/servers`).catch(() => []);
        vipServers = session.me ? await api(`/games/${id}/vip`).catch(() => []) : [];
    };

    const createVip = async (e: Event) => {
        e.preventDefault();
        vipBusy = true;
        vipMessage = "";
        try {
            await api(`/games/${id}/vip`, {
                name: vipName.trim()
            });
            vipName = "";
            vipForm = false;
            await loadServers();
        } catch (err: any) {
            vipMessage = err.message;
        }
        vipBusy = false;
    };

    const inviteVip = async (vipId: number) => {
        vipBusy = true;
        vipMessage = "";
        try {
            await api(`/games/${id}/vip/${vipId}/invite`, {
                username: vipInvite[vipId]?.trim() || ""
            });
            vipInvite[vipId] = "";
            vipMessage = "Invitation saved.";
            await loadServers();
        } catch (err: any) {
            vipMessage = err.message;
        }
        vipBusy = false;
    };

    const deleteVip = async (vipId: number) => {
        vipBusy = true;
        try {
            await api(`/games/${id}/vip/${vipId}`, undefined, "DELETE");
            await loadServers();
        } catch (err: any) {
            vipMessage = err.message;
        }
        vipBusy = false;
    };

    const removeVipMember = async (vipId: number, userId: number) => {
        vipBusy = true;
        try {
            await api(`/games/${id}/vip/${vipId}/invite/${userId}`, undefined, "DELETE");
            await loadServers();
        } catch (err: any) {
            vipMessage = err.message;
        }
        vipBusy = false;
    };

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

    const share = async () => {
        try {
            await navigator.clipboard.writeText(location.href);
            linkCopied = true;
            setTimeout(() => linkCopied = false, 2500);
        } catch {
            linkCopied = false;
        }
    };

    const thumbnail = $derived(game?.thumbnail || "/img/DefaultThumb.png");

    let favoriting = $state(false);
    const favorite = async () => {
        if (!session.me) {
            router.go("/login");
            return;
        }
        if (favoriting) return;
        favoriting = true;
        try {
            const d = await api(`/games/${id}/favorite`, {});
            game.favorited = d.favorited;
            game.favorites = d.favorites;
        } catch (err: any) {
            alert(err.message);
        } finally {
            favoriting = false;
        }
    };
    let voting = $state(false);
    const vote = async (which: "up" | "down") => {
        if (!session.me) {
            router.go("/login");
            return;
        }
        if (voting) return;
        voting = true;
        try {
            const d = await api(`/games/${id}/vote`, {
                vote: which
            });
            game.my_vote = d.my_vote;
            game.up_votes = d.up_votes;
            game.down_votes = d.down_votes;
        } catch (err: any) {
            alert(err.message);
        } finally {
            voting = false;
        }
    };
    const up = $derived(Number(game?.up_votes) || 0);
    const down = $derived(Number(game?.down_votes) || 0);
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
                        {:else if isApp}
                            <button id="MobileVisitButton" type="button" class="btn-play-2016" onclick={() => location.href = `/games/start?placeid=${id}`}>Play</button>
                        {:else if isAndroid}
                            <a class="btn-play-2016" href="/api/setup/download?os=android">Play</a>
                            <p class="text-center mt-2">Playing on a phone needs the NoneRev app. This gets you the apk.</p>
                        {:else if isPhone}
                            <a class="btn-play-2016" href="/download">Play</a>
                            <p class="text-center mt-2">Playing on a phone needs the NoneRev app, which is Android only for now.</p>
                        {:else}
                            <button id="MultiplayerVisitButton" type="button" class="btn-play-2016" onclick={() => play()}>Play</button>
                            <p id="launcher-hint" class="text-center mt-2" hidden={!launching}>Nothing happened? <a href="/setup/download">Download the NoneRev launcher</a>, run it once, then press Play again.</p>
                        {/if}
                    </div>

                    <ul class="share-rate-favorite-2016">
                        <li class="favorite-2016" class:favorited={game.favorited} title={game.favorited ? "Remove from favorites" : "Add to favorites"}>
                            <button type="button" class="favorite-button" onclick={favorite} disabled={favoriting} aria-pressed={!!game.favorited} aria-label="Favorite">
                                <svg class="game-rating-icon favorite-star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.5 3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.3-6.6-3.5-6.6 3.5 1.3-7.3-5.4-5.2 7.4-1.1z"/></svg>
                            </button>
                            <span>{compact(game.favorites)}</span>
                        </li>
                        <li class="voting-panel-2016">
                            <div class="vote-meter-2016">
                                <div class="vote-counts-2016">
                                    <span class="vote-count-up" aria-label={`${compact(up)} likes`}>
                                        <button type="button" class="vote-button" class:active={game.my_vote === 1} onclick={() => vote("up")} disabled={voting} aria-pressed={game.my_vote === 1} aria-label="Like"><img class="game-rating-icon" src="/img/game-like.svg" alt=""></button>
                                        {compact(up)}
                                    </span>
                                    <span class="vote-count-down" aria-label={`${compact(down)} dislikes`}>
                                        {compact(down)}
                                        <button type="button" class="vote-button" class:active={game.my_vote === -1} onclick={() => vote("down")} disabled={voting} aria-pressed={game.my_vote === -1} aria-label="Dislike"><img class="game-rating-icon" src="/img/game-dislike.svg" alt=""></button>
                                    </span>
                                </div>
                                <div class="vote-track-2016" class:neutral={up + down === 0} title={up + down === 0 ? "No votes yet" : `${ratio}% positive`}>
                                    <div class="vote-fill-2016" style="width: {ratio}%;"></div>
                                </div>
                            </div>
                        </li>
                    </ul>
                    <div class="game-share-row"><button type="button" onclick={share}>{linkCopied ? "Link copied" : "Share game"}</button></div>
                </div>
            </section>

            <section class="game-tabs-2016">
                <ul class="nav nav-tabs game-tab-list-2016" role="tablist">
                    {@render tabLink("about", "About")}
                    {@render tabLink("store", "Store")}
                    {@render tabLink("leaderboards", "Leaderboards")}
                    {@render tabLink("servers", "Servers")}
                </ul>

                <div class="tab-content game-tab-content-2016">
                    <div class="tab-pane fade" class:show={tab === "about"} class:active={tab === "about"} id="about" role="tabpanel">
                        <h2 class="game-section-heading">Description</h2>
                        <div class="section-2016 game-about-2016">
                            <p class="game-description-2016" style="white-space: pre-line">{game.description?.trim() || "No description available."}</p>

                            <ul class="game-stats-2016">
                                <li><p class="stat-title">Playing</p><p class="stat-value">{compact(game.playing)}</p></li>
                                <li><p class="stat-title">Visits</p><p class="stat-value">{compact(game.visits)}</p></li>
                                <li><p class="stat-title">Created</p><p class="stat-value">{date(game.created_at)}</p></li>
                                <li><p class="stat-title">Updated</p><p class="stat-value">{date(game.updated_at)}</p></li>
                                <li><p class="stat-title">Max Players</p><p class="stat-value">{(Number(game.max_players) || 50).toLocaleString()}</p></li>
                                <li><p class="stat-title">Genre</p><p class="stat-value"><a href="/games">{game.genre || "All"}</a></p></li>
                                <li><p class="stat-title">Allowed Gear</p><p class="stat-value">{game.allowed_gear ?? "—"}</p></li>
                            </ul>

                            <div class="game-stat-footer-2016">
                                <span>This game is copylocked</span>
                                <a href="/discord">Report Abuse</a>
                            </div>
                        </div>

                        <h2 class="game-section-heading">VIP Servers</h2>
                        <div class="section-2016 game-vip-2016">
                            <p>Play this game with friends and other people you invite.<br>See all your VIP servers in the <button type="button" class="game-inline-link" onclick={() => tab = "servers"}>Servers</button> tab.</p>
                            {#if session.me}
                                <button class="btn-2016-blue" type="button" onclick={() => { tab = "servers"; vipForm = true; }}>Create VIP Server</button>
                            {:else}
                                <a class="btn-2016-blue" href="/login">Create VIP Server</a>
                            {/if}
                        </div>

                        {#if badges.length > 0}
                            <h2 class="game-section-heading">Badges</h2>
                            <div class="section-2016 game-badges-2016">
                                <div class="game-badge-grid">
                                    {#each badges as b (b.id)}
                                        <div class="game-badge-card" class:disabled={b.disabled}>
                                            <img src={b.icon || "/img/pending.png"} alt={b.name}>
                                            <div>
                                                <strong>{b.name}</strong>
                                                <p>{b.description || ""}</p>
                                                <span>{b.disabled ? "Disabled" : `Won by ${(Number(b.awarded_count) || 0).toLocaleString()} players`}</span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        {#if recommended.length > 0}
                            <h2 class="game-section-heading">Recommended Games</h2>
                            <div class="game-recommended-grid">
                                {#each recommended as item (item.id)}
                                    <a class="game-recommended-card" href="/game?id={item.id}">
                                        <img src={item.thumbnail || "/img/DefaultThumb.png"} alt="">
                                        <span class="game-recommended-title">{item.title}</span>
                                        <span class="game-recommended-playing">{compact(item.playing)} Playing</span>
                                    </a>
                                {/each}
                            </div>
                        {/if}
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

                    <div class="tab-pane fade" class:show={tab === "leaderboards"} class:active={tab === "leaderboards"} id="leaderboards" role="tabpanel">
                        <div class="section-2016 game-leaderboard-2016">
                            <h3>Most Plays</h3>
                            {#if leaderboard.length}
                                <ol>
                                    {#each leaderboard as player (player.id)}
                                        <li>
                                            <a href="/user?id={player.id}">{player.username}</a>
                                            <strong>{player.plays.toLocaleString()}</strong>
                                        </li>
                                    {/each}
                                </ol>
                            {:else}
                                <p>No one has played this game yet.</p>
                            {/if}
                        </div>
                    </div>

                    <div class="tab-pane fade" class:show={tab === "servers"} class:active={tab === "servers"} id="servers" role="tabpanel">
                        <div class="section-2016 servers-2016">
                            <div class="servers-banner-2016">
                                <span>Play this game with friends and other people you invite.</span>
                                {#if session.me}
                                    <button class="btn-2016-gray" type="button" onclick={() => vipForm = !vipForm}>Create VIP Server</button>
                                {/if}
                            </div>
                            {#if vipForm}
                                <form class="game-vip-create" onsubmit={createVip}>
                                    <label for="vip-name">Server name</label>
                                    <input id="vip-name" type="text" maxlength="60" bind:value={vipName} required>
                                    <button type="submit" disabled={vipBusy}>Create</button>
                                </form>
                            {/if}
                            {#if vipMessage}
                                <p class="game-vip-message" role="status">{vipMessage}</p>
                            {/if}
                            <div class="server-list-empty-2016">
                                <h3>Public Servers</h3>
                                {#if servers.length === 0}
                                    <p>No servers are running right now.</p>
                                {:else}
                                    <ul class="game-server-list">
                                        {#each servers as server (server.jobId)}
                                            <li>
                                                <span>{server.players} playing · {server.ready ? "Ready" : "Starting"}</span>
                                                <button type="button" disabled={!server.ready} onclick={() => play(server.jobId)}>Join</button>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                            {#if session.me}
                                <div class="game-vip-list">
                                    <h3>VIP Servers</h3>
                                    {#if vipServers.length === 0}
                                        <p>You have no VIP servers for this game.</p>
                                    {/if}
                                    {#each vipServers as vip (vip.id)}
                                        <div class="game-vip-row">
                                            <strong>{vip.name}</strong>
                                            <span>Owned by {vip.owner_name}</span>
                                            {#if vip.owner_id === session.me.id}
                                                <form onsubmit={e => { e.preventDefault(); inviteVip(vip.id); }}>
                                                    <input type="text" placeholder="Username to invite" aria-label="Username to invite" bind:value={vipInvite[vip.id]} required>
                                                    <button type="submit" disabled={vipBusy}>Invite</button>
                                                </form>
                                                <button type="button" disabled={vipBusy} onclick={() => deleteVip(vip.id)}>Delete</button>
                                                {#if vip.members?.length}
                                                    <div class="game-vip-members">
                                                        Invited:
                                                        {#each vip.members as member (member.id)}
                                                            <span>
                                                                <a href="/user?id={member.id}">{member.username}</a>
                                                                <button type="button" disabled={vipBusy} aria-label={`Remove ${member.username}`} onclick={() => removeVipMember(vip.id, member.id)}>×</button>
                                                            </span>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            {/if}
                                        </div>
                                    {/each}
                                    <p class="game-vip-note">Private play needs game-server support before these VIP servers can be joined.</p>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </section>
        {/if}
    </div>
</main>
