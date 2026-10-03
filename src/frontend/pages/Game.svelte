<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";
    import GameCard from "../GameCard.svelte";
    import Comments from "../Comments.svelte";

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

    const openVipForm = () => {
        tab = "servers";
        vipForm = true;
    };

    const inviteVip = async (e: Event, vipId: number) => {
        e.preventDefault();
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
        if (n >= 1000000) {
            return (Math.round(n / 100000) / 10) + "M+";
        }
        if (n >= 1000) {
            return (Math.round(n / 100) / 10) + "K+";
        }
        return n.toLocaleString();
    };

    const date = (v: any) => {
        if (!v) {
            return "N/A";
        }
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
        if (favoriting) {
            return;
        }
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
        if (voting) {
            return;
        }
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
    <li role="presentation">
        <button type="button" role="tab" class:active={tab === key} aria-selected={tab === key} onclick={() => tab = key}>{label}</button>
    </li>
{/snippet}

<main class="game-page">
    <div class="game-container">
        {#if missing}
            <div class="game-sheet game-missing">
                <h2>Game not found</h2>
                <p>The game you are looking for does not exist.</p>
                <a class="game-btn game-btn-secondary" href="/games">Back to Games</a>
            </div>
        {:else if game}
            <div class="game-hero">
                <div class="game-media">
                    <img src={thumbnail} alt={game.title}>
                </div>

                <div class="game-actions">
                    <div class="game-title">
                        <h2 title={game.title}>{game.title}</h2>
                        <div class="game-creator">
                            <span>By</span>
                            <a href="/user?id={game.creator_id}">{game.creator_name || "Unknown"}</a>
                        </div>
                    </div>

                    <div class="game-play">
                        {#if !session.me}
                            <a class="game-btn-play" href="/login">Play</a>
                        {:else if isApp}
                            <button id="MobileVisitButton" type="button" class="game-btn-play" onclick={() => location.href = `/games/start?placeid=${id}`}>Play</button>
                        {:else if isAndroid}
                            <a class="game-btn-play" href="/api/setup/download?os=android">Play</a>
                            <p class="game-play-hint">Playing on a phone needs the NoneRev app. This gets you the apk.</p>
                        {:else if isPhone}
                            <a class="game-btn-play" href="/download">Play</a>
                            <p class="game-play-hint">Playing on a phone needs the NoneRev app, which is Android only for now.</p>
                        {:else}
                            <button id="MultiplayerVisitButton" type="button" class="game-btn-play" onclick={() => play()}>Play</button>
                            <p id="launcher-hint" class="game-play-hint" hidden={!launching}>
                                Nothing happened?
                                <a href="/setup/download">Download the NoneRev launcher</a>, run it once, then press Play again.
                            </p>
                        {/if}
                    </div>

                    <div class="game-rate">
                        <button type="button" class="game-favorite" class:active={game.favorited} onclick={favorite} disabled={favoriting} aria-pressed={!!game.favorited} title={game.favorited ? "Remove from favorites" : "Add to favorites"}>
                            <span class="game-icon-favorite"></span>
                            <span>{compact(game.favorites)}</span>
                        </button>
                        <div class="game-votes">
                            <div class="game-vote-buttons">
                                <button type="button" class="game-vote up" class:active={game.my_vote === 1} onclick={() => vote("up")} disabled={voting} aria-pressed={game.my_vote === 1} aria-label={`Like, ${compact(up)} likes`}>
                                    <span class="game-icon-like"></span>
                                    <span>{compact(up)}</span>
                                </button>
                                <button type="button" class="game-vote down" class:active={game.my_vote === -1} onclick={() => vote("down")} disabled={voting} aria-pressed={game.my_vote === -1} aria-label={`Dislike, ${compact(down)} dislikes`}>
                                    <span class="game-icon-dislike"></span>
                                    <span>{compact(down)}</span>
                                </button>
                            </div>
                            <div class="game-vote-track" class:neutral={up + down === 0} title={up + down === 0 ? "No votes yet" : `${ratio}% positive`}>
                                <div class="game-vote-fill" style="width: {ratio}%;"></div>
                            </div>
                        </div>
                        <button type="button" class="game-share" onclick={share}>{linkCopied ? "Link copied" : "Share game"}</button>
                    </div>
                </div>
            </div>

            <div class="game-tabs">
                <ul class="game-tab-list" role="tablist">
                    {@render tabLink("about", "About")}
                    {@render tabLink("store", "Store")}
                    {@render tabLink("leaderboards", "Leaderboards")}
                    {@render tabLink("servers", "Servers")}
                </ul>

                {#if tab === "about"}
                    <div class="game-pane" id="about" role="tabpanel">
                        <div class="game-section">
                            <h3>Description</h3>
                            <div class="game-sheet">
                                <p class="game-description">{game.description?.trim() || "No description available."}</p>

                                <ul class="game-stats">
                                    <li>
                                        <p class="game-stat-label">Playing</p>
                                        <p class="game-stat-value">{compact(game.playing)}</p>
                                    </li>
                                    <li>
                                        <p class="game-stat-label">Visits</p>
                                        <p class="game-stat-value">{compact(game.visits)}</p>
                                    </li>
                                    <li>
                                        <p class="game-stat-label">Created</p>
                                        <p class="game-stat-value">{date(game.created_at)}</p>
                                    </li>
                                    <li>
                                        <p class="game-stat-label">Updated</p>
                                        <p class="game-stat-value">{date(game.updated_at)}</p>
                                    </li>
                                    <li>
                                        <p class="game-stat-label">Max Players</p>
                                        <p class="game-stat-value">{(Number(game.max_players) || 50).toLocaleString()}</p>
                                    </li>
                                    <li>
                                        <p class="game-stat-label">Genre</p>
                                        <p class="game-stat-genre">
                                            <a href="/games">{game.genre || "All"}</a>
                                        </p>
                                    </li>
                                    <li>
                                        <p class="game-stat-label">Allowed Gear</p>
                                        <p class="game-stat-value">
                                            {#if game.allowed_gear}
                                                {game.allowed_gear}
                                            {:else}
                                                <span class="game-icon-nogear" title="No gear allowed"></span>
                                            {/if}
                                        </p>
                                    </li>
                                </ul>

                                <div class="game-about-footer">
                                    <span>This game is copylocked</span>
                                    <a href="/discord">Report Abuse</a>
                                </div>
                            </div>
                        </div>

                        <div class="game-section">
                            <h3>VIP Servers</h3>
                            <div class="game-sheet game-banner">
                                <p>
                                    Play this game with friends and other people you invite.
                                    <br>
                                    See all your VIP servers in the
                                    <button type="button" class="game-inline-link" onclick={() => tab = "servers"}>Servers</button>
                                    tab.
                                </p>
                                {#if session.me}
                                    <button class="game-btn game-btn-secondary" type="button" onclick={openVipForm}>Create VIP Server</button>
                                {:else}
                                    <a class="game-btn game-btn-secondary" href="/login">Create VIP Server</a>
                                {/if}
                            </div>
                        </div>

                        {#if badges.length > 0}
                            <div class="game-section badge-container">
                                <h3>Game Badges</h3>
                                <ul class="badge-list">
                                    {#each badges as b, i (b.id)}
                                        <li class="section-row badge-row" class:badge-see-more-row={i >= BADGES_SHOWN && !allBadges} class:badge-disabled={Number(b.enabled) === 0}>
                                            <div class="badge-image">
                                                <img src={b.icon || "/img/pending.png"} alt={b.name}>
                                            </div>
                                            <div class="badge-content">
                                                <div class="badge-data-container">
                                                    <div class="badge-name">{b.name}</div>
                                                    <p class="para-overflow">{b.description || ""}</p>
                                                </div>
                                                <ul class="badge-stats-container">
                                                    <li>
                                                        <div class="text-label">Rarity</div>
                                                        <div class="badge-stats-info">{rarity(b)}</div>
                                                    </li>
                                                    <li>
                                                        <div class="text-label">Won Yesterday</div>
                                                        <div class="badge-stats-info">{Number(b.won_yesterday) || 0}</div>
                                                    </li>
                                                    <li>
                                                        <div class="text-label">Won Ever</div>
                                                        <div class="badge-stats-info">{Number(b.awarded_count) || 0}</div>
                                                    </li>
                                                </ul>
                                            </div>
                                        </li>
                                    {/each}
                                    {#if badges.length > BADGES_SHOWN && !allBadges}
                                        <li>
                                            <button type="button" class="btn-full-width btn-control-sm" id="badges-see-more" onclick={() => allBadges = true}>See More</button>
                                        </li>
                                    {/if}
                                </ul>
                            </div>
                        {/if}

                        <div class="game-section">
                            <Comments kind="game" target={id} />
                        </div>

                        {#if recommended.length > 0}
                            <div class="game-section">
                                <h3>Recommended Games</h3>
                                <ul class="game-recommended">
                                    {#each recommended as item (item.id)}
                                        <GameCard game={item} />
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                    </div>
                {:else if tab === "store"}
                    <div class="game-pane" id="store" role="tabpanel">
                        <div class="game-section">
                            <h3>Store</h3>
                            {#if storeMsg}
                                <div class="game-alert" class:success={storeOk}>{storeMsg}</div>
                            {/if}
                            {#if passes.length === 0}
                                <div class="game-sheet">
                                    <p class="game-empty">This game has no passes for sale.</p>
                                </div>
                            {:else}
                                <ul class="game-passes">
                                    {#each passes as pass (pass.id)}
                                        <li>
                                            <img src={pass.icon || "/img/pending.png"} alt={pass.name}>
                                            <div class="game-pass-body">
                                                <strong title={pass.name}>{pass.name}</strong>
                                                <p>{pass.description || ""}</p>
                                                <div class="game-pass-buy">
                                                    <span class="game-pass-price">
                                                        <span class="game-icon-nonebux" aria-label="Nonebux"></span>
                                                        {(Number(pass.price) || 0).toLocaleString()}
                                                    </span>
                                                    {#if pass.owned}
                                                        <button type="button" class="game-btn game-btn-control" disabled>Owned</button>
                                                    {:else if !session.me}
                                                        <a class="game-btn game-btn-buy" href="/login">Buy</a>
                                                    {:else}
                                                        <button type="button" class="game-btn game-btn-buy" disabled={buying === pass.id} onclick={() => buy(pass)}>Buy</button>
                                                    {/if}
                                                </div>
                                            </div>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                    </div>
                {:else if tab === "leaderboards"}
                    <div class="game-pane" id="leaderboards" role="tabpanel">
                        <div class="game-section">
                            <h3>Most Plays</h3>
                            <div class="game-sheet">
                                {#if leaderboard.length}
                                    <ol class="game-leaderboard">
                                        {#each leaderboard as player, i (player.id)}
                                            <li>
                                                <span>{i + 1}</span>
                                                <a href="/user?id={player.id}">{player.username}</a>
                                                <strong>{player.plays.toLocaleString()}</strong>
                                            </li>
                                        {/each}
                                    </ol>
                                {:else}
                                    <p class="game-empty">No one has played this game yet.</p>
                                {/if}
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="game-pane" id="servers" role="tabpanel">
                        <div class="game-section">
                            <h3>VIP Servers</h3>
                            <div class="game-sheet">
                                <div class="game-banner">
                                    <p>Play this game with friends and other people you invite.</p>
                                    {#if session.me}
                                        <button class="game-btn game-btn-control" type="button" onclick={() => vipForm = !vipForm}>Create VIP Server</button>
                                    {/if}
                                </div>
                                {#if vipForm}
                                    <form class="game-vip-create" onsubmit={createVip}>
                                        <label for="vip-name">Server name</label>
                                        <input id="vip-name" class="game-input" type="text" maxlength="60" bind:value={vipName} required>
                                        <button class="game-btn game-btn-secondary" type="submit" disabled={vipBusy}>Create</button>
                                    </form>
                                {/if}
                                {#if vipMessage}
                                    <p class="game-vip-message" role="status">{vipMessage}</p>
                                {/if}
                                {#if session.me}
                                    <div class="game-vip-list">
                                        {#if vipServers.length === 0}
                                            <p class="game-empty">You have no VIP servers for this game.</p>
                                        {/if}
                                        {#each vipServers as vip (vip.id)}
                                            <div class="game-vip-row">
                                                <strong>{vip.name}</strong>
                                                <span>Owned by {vip.owner_name}</span>
                                                {#if vip.owner_id === session.me.id}
                                                    <form onsubmit={e => inviteVip(e, vip.id)}>
                                                        <input class="game-input" type="text" placeholder="Username to invite" aria-label="Username to invite" bind:value={vipInvite[vip.id]} required>
                                                        <button class="game-btn game-btn-secondary" type="submit" disabled={vipBusy}>Invite</button>
                                                    </form>
                                                    <button class="game-btn game-btn-control" type="button" disabled={vipBusy} onclick={() => deleteVip(vip.id)}>Delete</button>
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

                        <div class="game-section">
                            <h3>Public Servers</h3>
                            <div class="game-sheet">
                                {#if servers.length === 0}
                                    <p class="game-empty">No servers are running right now.</p>
                                {:else}
                                    <ul class="game-servers">
                                        {#each servers as server (server.jobId)}
                                            <li>
                                                <span>{server.players} playing · {server.ready ? "Ready" : "Starting"}</span>
                                                <button class="game-btn game-btn-control" type="button" disabled={!server.ready} onclick={() => play(server.jobId)}>Join</button>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</main>
