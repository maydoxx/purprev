<script lang="ts">
    import { api } from "../api";
    import UserAd from "../UserAd.svelte";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";
    import GameCard from "../GameCard.svelte";
    import Comments from "../Comments.svelte";
    import { linkify } from "./groups/Group.svelte";

    const id = $derived(Number(router.query.id) || 0);

    let game = $state<any>(null);
    let missing = $state(false);
    let passes = $state<any[]>([]);
    let badges = $state<any[]>([]);
    let recommended = $state<any[]>([]);
    let leaderboard = $state<any[]>([]);
    let groupBoard = $state<any[]>([]);
    let playerTime = $state("week");
    let groupTime = $state("week");
    let boardMenu = $state("");
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
    let menu = $state(false);

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
        loadServers();
        api("/games?page=1").then(d => {
            recommended = list(d, "games").filter((item: any) => Number(item.id) !== id).slice(0, 7);
        }).catch(() => {});
    });

    $effect(() => {
        if (!id || tab !== "leaderboards") {
            return;
        }
        api(`/games/${id}/leaderboard?time=${playerTime}`).then(d => {
            leaderboard = list(d, "players");
        }).catch(() => {
            leaderboard = [];
        });
    });

    $effect(() => {
        if (!id || tab !== "leaderboards") {
            return;
        }
        api(`/games/${id}/leaderboard/groups?time=${groupTime}`).then(d => {
            groupBoard = list(d, "groups");
        }).catch(() => {
            groupBoard = [];
        });
    });

    const BOARD_TIMES = [
        {
            id: "day",
            title: "Today"
        },
        {
            id: "week",
            title: "Past Week"
        },
        {
            id: "month",
            title: "Past Month"
        },
        {
            id: "all",
            title: "All Time"
        }
    ];

    const boardTime = (time: string) => BOARD_TIMES.find(t => t.id === time)?.title ?? "";

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
            return Math.floor(n / 1000000) + "M+";
        }
        if (n >= 10000) {
            return Math.floor(n / 1000) + "K+";
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
    const owner = $derived(!!session.me && Number(game?.creator_id) === session.me.id);
    const headshot = (userId: number) => `/api/user/getProfilePicture?userId=${userId}&type=headshot`;

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

    const GEAR: Record<string, string> = {
        MeleeWeapon: "Melee Weapons",
        RangedWeapon: "Ranged Weapons",
        Explosive: "Explosives",
        PowerUp: "Power Ups",
        NavigationEnhancer: "Navigation Enhancers",
        MusicalInstrument: "Musical Instruments",
        SocialItem: "Social Items",
        BuildingTool: "Building Tools",
        PersonalTransport: "Personal Transport"
    };

    const gear = $derived((Array.isArray(game?.allowed_gear) ? game.allowed_gear : String(game?.allowed_gear ?? "").split(",")).filter((key: string) => key in GEAR));

    const BADGES_SHOWN = 3;
    let allBadges = $state(false);

    const rarity = (b: any) => `${(Number(b.rarity) || 0).toFixed(1)}% (${b.rarity_label || "Impossible"})`;
</script>

<svelte:head>
    <title>{game ? game.title : missing ? "Game Not Found" : "Game"} - NoneRev</title>
    <link rel="stylesheet" href="/css/games.css">
</svelte:head>

<svelte:window onclick={() => {
    menu = false;
    boardMenu = "";
}} />

{#snippet tabLink(key: string, label: string)}
    <li role="presentation">
        <button type="button" role="tab" class="game-tab" class:active={tab === key} aria-selected={tab === key} onclick={() => tab = key}>{label}</button>
    </li>
{/snippet}

{#snippet vipHeader()}
    <div class="game-header">
        <h3>VIP Servers</h3>
        <span class="game-tooltip game-vip-info">
            <span class="game-icon-moreinfo"></span>
            <span class="game-tooltip-text" role="tooltip">VIP servers let you play this game privately with friends or people you invite!</span>
        </span>
    </div>
{/snippet}

{#snippet boardHeader(key: string, title: string, time: string, pick: (time: string) => void)}
    <div class="game-board-header">
        <h3>{title}</h3>
        <div class="game-board-filter">
            <span class="game-board-time">{boardTime(time)}</span>
            <div class="game-board-pop">
                <button type="button" class="game-board-sort" aria-label="Time period" aria-expanded={boardMenu === key} onclick={e => {
                    e.stopPropagation();
                    boardMenu = boardMenu === key ? "" : key;
                }}>
                    <span class="game-icon-sorting"></span>
                </button>
                {#if boardMenu === key}
                    <div class="game-popover">
                        <ul class="game-menu-list game-board-menu">
                            {#each BOARD_TIMES as t (t.id)}
                                <li>
                                    <button type="button" onclick={() => pick(t.id)}>{t.title}</button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/snippet}

<main class="rbx-content">
    <UserAd size="banner" class="user-ad-top" />
    <UserAd size="skyscraper" class="user-ad-side" />
    <div class="game-detail">
        {#if missing}
            <div class="game-box game-missing">
                <h2>Game not found</h2>
                <p>The game you are looking for does not exist.</p>
                <a class="game-btn-secondary" href="/games">Back to Games</a>
            </div>
        {:else if game}
            <div class="game-main">
                <div class="game-thumb">
                    <img src={thumbnail} alt={game.title}>
                </div>

                <div class="game-actions">
                    {#if owner}
                        <div class="game-menu">
                            <button type="button" class="game-menu-toggle" aria-label="More" aria-expanded={menu} onclick={e => {
                                e.stopPropagation();
                                menu = !menu;
                            }}>
                                <span class="game-icon-more"></span>
                            </button>
                            {#if menu}
                                <div class="game-popover">
                                    <ul class="game-menu-list">
                                        <li>
                                            <a href="/develop/configure?id={id}">Configure Place</a>
                                        </li>
                                    </ul>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div class="game-title">
                        <h2 title={game.title}>{game.title}</h2>
                        <div class="game-creator">
                            <span>By</span>
                            <a href="/user?id={game.creator_id}">{game.creator_name || "Unknown"}</a>
                        </div>
                    </div>

                    <div class="game-play">
                        {#if !session.me}
                            <a class="game-play-btn" href="/login">Play</a>
                        {:else if isApp}
                            <button id="MobileVisitButton" type="button" class="game-play-btn" onclick={() => location.href = `/games/start?placeid=${id}`}>Play</button>
                        {:else if isAndroid}
                            <a class="game-play-btn" href="/api/setup/download?os=android">Play</a>
                            <p class="game-play-hint">Playing on a phone needs the NoneRev app. This gets you the apk.</p>
                        {:else if isPhone}
                            <a class="game-play-btn" href="/download">Play</a>
                            <p class="game-play-hint">Playing on a phone needs the NoneRev app, which is Android only for now.</p>
                        {:else}
                            <button id="MultiplayerVisitButton" type="button" class="game-play-btn" onclick={() => play()}>Play</button>
                            <p id="launcher-hint" class="game-play-hint" hidden={!launching}>
                                Nothing happened?
                                <a href="/setup/download">Download the NoneRev launcher</a>, run it once, then press Play again.
                            </p>
                        {/if}
                    </div>

                    <ul class="game-rate">
                        <li class="game-favorite game-tooltip">
                            <button type="button" class="game-favorite-btn" class:active={game.favorited} onclick={favorite} disabled={favoriting} aria-pressed={!!game.favorited}>
                                <span class="game-icon-favorite"></span>
                                <span class="game-favorite-count" title={(Number(game.favorites) || 0).toLocaleString()}>{compact(game.favorites)}</span>
                            </button>
                            <span class="game-tooltip-text" role="tooltip">{game.favorited ? "Remove from Favorites" : "Add to Favorites"}</span>
                        </li>
                        <li class="game-voting">
                            <div class="game-votes">
                                <button type="button" class="game-vote up" class:active={game.my_vote === 1} onclick={() => vote("up")} disabled={voting} aria-pressed={game.my_vote === 1} aria-label={`Like, ${compact(up)} likes`}>
                                    <span class="game-icon-like"></span>
                                    <span title={up.toLocaleString()}>{compact(up)}</span>
                                </button>
                                <button type="button" class="game-vote down" class:active={game.my_vote === -1} onclick={() => vote("down")} disabled={voting} aria-pressed={game.my_vote === -1} aria-label={`Dislike, ${compact(down)} dislikes`}>
                                    <span title={down.toLocaleString()}>{compact(down)}</span>
                                    <span class="game-icon-dislike"></span>
                                </button>
                            </div>
                            <div class="game-vote-bar" title={up + down === 0 ? "No votes yet" : `${ratio}% positive`}>
                                <div class="game-vote-background" class:votes={up + down > 0}></div>
                                <div class="game-vote-percent" style="width: {ratio}%;"></div>
                            </div>
                        </li>
                        <li class="game-share">
                            <button type="button" class="game-share-btn" onclick={share}>{linkCopied ? "Link copied" : "Share game"}</button>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="game-tabs">
                <ul class="game-tab-list" role="tablist">
                    {@render tabLink("about", "About")}
                    {@render tabLink("store", "Store")}
                    {@render tabLink("leaderboards", "Leaderboards")}
                    {@render tabLink("servers", "Servers")}
                </ul>

                <div class="game-tab-content">
                    {#if tab === "about"}
                        <div id="about" role="tabpanel">
                            <div class="game-about">
                                <h3>Description</h3>
                                <div class="game-box">
                                    <p class="game-description">{#each linkify(game.description?.trim() || "No description available.") as part}{#if part.href}<a class="game-text-link" href={part.href} target="_blank" rel="noopener">{part.text}</a>{:else}{part.text}{/if}{/each}</p>

                                    <ul class="game-stats">
                                        <li class="game-stat">
                                            <p class="game-stat-label">Visits</p>
                                            <p class="game-stat-value" title={(Number(game.visits) || 0).toLocaleString()}>{compact(game.visits)}</p>
                                        </li>
                                        <li class="game-stat">
                                            <p class="game-stat-label">Created</p>
                                            <p class="game-stat-value">{date(game.created_at)}</p>
                                        </li>
                                        <li class="game-stat">
                                            <p class="game-stat-label">Updated</p>
                                            <p class="game-stat-value">{date(game.updated_at)}</p>
                                        </li>
                                        <li class="game-stat">
                                            <p class="game-stat-label">Max Players</p>
                                            <p class="game-stat-value">{(Number(game.max_players) || 10).toLocaleString()}</p>
                                        </li>
                                        <li class="game-stat">
                                            <p class="game-stat-label">Genre</p>
                                            <p class="game-stat-value">
                                                <a href="/games?genre={encodeURIComponent(game.genre || "All")}">{game.genre || "All"}</a>
                                            </p>
                                        </li>
                                        <li class="game-stat">
                                            <p class="game-stat-label">Allowed Gear types</p>
                                            <p class="game-stat-value game-stat-gears">
                                                {#if gear.length === 0}
                                                    <span class="icon-nogear game-tooltip">
                                                        <span class="game-tooltip-text" role="tooltip">No Gear Allowed</span>
                                                    </span>
                                                {:else}
                                                    {#each gear as key (key)}
                                                        <span class="icon-{key} game-tooltip">
                                                            <span class="game-tooltip-text" role="tooltip">{GEAR[key]}</span>
                                                        </span>
                                                    {/each}
                                                {/if}
                                            </p>
                                        </li>
                                    </ul>

                                    <div class="game-stat-footer">
                                        {#if game.copylocked}
                                            <span class="game-copylocked">This game is copylocked</span>
                                        {/if}
                                        <span class="game-report">
                                            <a href="/abusereport?type=game&id={id}">Report Abuse</a>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="game-list">
                                {@render vipHeader()}
                                <div class="game-box game-vip-banner">
                                    {#if session.me}
                                        <button class="game-btn-secondary" type="button" onclick={openVipForm}>Create VIP Server</button>
                                    {:else}
                                        <a class="game-btn-secondary" href="/login">Create VIP Server</a>
                                    {/if}
                                    <span class="game-vip-text">Play this game with friends and other people you invite.</span>
                                </div>
                            </div>

                            {#if badges.length > 0}
                                <div class="game-list">
                                    <div class="game-header">
                                        <h3>Game Badges</h3>
                                    </div>
                                    <ul class="badge-list">
                                        {#each badges as b, i (b.id)}
                                            <li class="badge-row" class:badge-see-more-row={i >= BADGES_SHOWN && !allBadges} class:badge-disabled={Number(b.enabled) === 0}>
                                                <div class="badge-image">
                                                    <img src={b.icon || "/img/pending.png"} alt={b.name}>
                                                </div>
                                                <div class="badge-content">
                                                    <div class="badge-data-container">
                                                        <div class="badge-name">{b.name}</div>
                                                        <p>{b.description || ""}</p>
                                                    </div>
                                                    <ul class="badge-stats-container">
                                                        <li>
                                                            <div class="badge-stats-label">Rarity</div>
                                                            <div class="badge-stats-info">{rarity(b)}</div>
                                                        </li>
                                                        <li>
                                                            <div class="badge-stats-label">Won Yesterday</div>
                                                            <div class="badge-stats-info">{Number(b.won_yesterday) || 0}</div>
                                                        </li>
                                                        <li>
                                                            <div class="badge-stats-label">Won Ever</div>
                                                            <div class="badge-stats-info">{Number(b.awarded_count) || 0}</div>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </li>
                                        {/each}
                                        {#if badges.length > BADGES_SHOWN && !allBadges}
                                            <li>
                                                <button type="button" class="game-btn-control-sm game-btn-full" id="badges-see-more" onclick={() => allBadges = true}>See More</button>
                                            </li>
                                        {/if}
                                    </ul>
                                </div>
                            {/if}

                            {#if recommended.length > 0}
                                <div class="game-list">
                                    <div class="game-header">
                                        <h3>Recommended Games</h3>
                                    </div>
                                    <ul class="game-recommended">
                                        {#each recommended as item (item.id)}
                                            <GameCard game={item} />
                                        {/each}
                                    </ul>
                                </div>
                            {/if}

                            <div class="game-comments">
                                <Comments kind="game" target={id} />
                            </div>
                        </div>
                    {:else if tab === "store"}
                        <div id="store" class="game-pane-padded" role="tabpanel">
                            {#if storeMsg}
                                <div class="game-alert" class:success={storeOk}>{storeMsg}</div>
                            {/if}
                            {#if passes.length === 0}
                                <p class="game-off">This game does not sell any virtual items or power-ups.</p>
                            {:else}
                                <div class="game-list">
                                    <div class="game-header game-store-header">
                                        <h3>Passes for this game</h3>
                                    </div>
                                    <ul class="game-store-cards">
                                        {#each passes as pass (pass.id)}
                                            <li>
                                                <div class="game-store-card">
                                                    <img src={pass.icon || "/img/pending.png"} alt={pass.name}>
                                                    <div class="game-store-caption">
                                                        <div class="game-store-name" title={pass.description || pass.name}>{pass.name}</div>
                                                        <div class="game-store-price">
                                                            <span class="game-icon-nonebux" aria-label="Nonebux"></span>
                                                            <span class="game-store-amount">{(Number(pass.price) || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div class="game-store-footer">
                                                            {#if pass.owned}
                                                                <h5>Owned</h5>
                                                            {:else if !session.me}
                                                                <a class="game-btn-buy" href="/login">Buy</a>
                                                            {:else}
                                                                <button type="button" class="game-btn-buy" disabled={buying === pass.id} onclick={() => buy(pass)}>Buy</button>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                        </div>
                    {:else if tab === "leaderboards"}
                        <div id="leaderboards" class="game-boards" role="tabpanel">
                            <div class="game-board players">
                                {@render boardHeader("players", "Players", playerTime, time => playerTime = time)}
                                <div class="game-box game-board-items">
                                    {#if leaderboard.length}
                                        {#each leaderboard as player, i (player.id)}
                                            <div class="game-board-item">
                                                <div class="game-board-rank">{i + 1}</div>
                                                <a class="game-board-avatar" href="/user?id={player.id}">
                                                    <img src={headshot(player.id)} alt={player.username}>
                                                </a>
                                                <div class="game-board-name">
                                                    <a href="/user?id={player.id}">{player.username}</a>
                                                </div>
                                                <div class="game-board-points">{(Number(player.plays) || 0).toLocaleString()}</div>
                                            </div>
                                        {/each}
                                    {:else}
                                        <p class="game-empty">No results found.</p>
                                    {/if}
                                </div>
                            </div>
                            <div class="game-board groups">
                                {@render boardHeader("groups", "Groups", groupTime, time => groupTime = time)}
                                <div class="game-box game-board-items">
                                    {#if groupBoard.length}
                                        {#each groupBoard as group, i (group.id)}
                                            <div class="game-board-item">
                                                <div class="game-board-rank">{i + 1}</div>
                                                <a class="game-board-avatar game-board-emblem" href="/groups?id={group.id}">
                                                    <img src={group.icon || "/img/pending.png"} alt={group.name}>
                                                </a>
                                                <div class="game-board-name">
                                                    <a href="/groups?id={group.id}">{group.name}</a>
                                                </div>
                                                <div class="game-board-points">{(Number(group.plays) || 0).toLocaleString()}</div>
                                            </div>
                                        {/each}
                                    {:else}
                                        <p class="game-empty">No results found.</p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div id="servers" class="game-pane-padded" role="tabpanel">
                            <div class="game-list">
                                {@render vipHeader()}
                                <div class="game-box game-vip-banner">
                                    {#if session.me}
                                        <button class="game-btn-secondary" type="button" onclick={() => vipForm = !vipForm}>Create VIP Server</button>
                                    {/if}
                                    <span class="game-vip-text">Play this game with friends and other people you invite.</span>
                                </div>
                                {#if vipForm}
                                    <form class="game-box game-vip-create" onsubmit={createVip}>
                                        <label for="vip-name">Server name</label>
                                        <input id="vip-name" class="game-input" type="text" maxlength="60" bind:value={vipName} required>
                                        <button class="game-btn-secondary" type="submit" disabled={vipBusy}>Create</button>
                                    </form>
                                {/if}
                                {#if vipMessage}
                                    <p class="game-vip-message" role="status">{vipMessage}</p>
                                {/if}
                                {#if session.me}
                                    {#if vipServers.length === 0}
                                        <p class="game-off">No VIP Server Instances Found.</p>
                                    {/if}
                                    <ul class="game-servers">
                                        {#each vipServers as vip (vip.id)}
                                            <li class="game-box game-server">
                                                <div class="game-server-left">
                                                    <div class="game-server-name">{vip.name}</div>
                                                    <div class="game-server-status">Owned by {vip.owner_name}</div>
                                                    {#if vip.owner_id === session.me.id}
                                                        <button class="game-btn-control-xs game-btn-full" type="button" disabled={vipBusy} onclick={() => deleteVip(vip.id)}>Delete</button>
                                                    {/if}
                                                </div>
                                                <div class="game-server-right">
                                                    {#if vip.owner_id === session.me.id}
                                                        <form class="game-vip-invite" onsubmit={e => inviteVip(e, vip.id)}>
                                                            <input class="game-input" type="text" placeholder="Username to invite" aria-label="Username to invite" bind:value={vipInvite[vip.id]} required>
                                                            <button class="game-btn-secondary" type="submit" disabled={vipBusy}>Invite</button>
                                                        </form>
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
                                            </li>
                                        {/each}
                                    </ul>
                                    <p class="game-vip-note">Private play needs game-server support before these VIP servers can be joined.</p>
                                {/if}
                            </div>

                            <div class="game-list">
                                <div class="game-header">
                                    <h3>Running Games</h3>
                                    <button type="button" class="game-btn-control-xs game-btn-more" onclick={loadServers}>Refresh</button>
                                </div>
                                {#if servers.length === 0}
                                    <p class="game-off">No Servers Found.</p>
                                {:else}
                                    <ul class="game-servers">
                                        {#each servers as server (server.jobId)}
                                            <li class="game-box game-server">
                                                <div class="game-server-left">
                                                    <div class="game-server-status">{server.players} of {Number(game.max_players) || 10} players max</div>
                                                    <button class="game-btn-control-xs game-btn-full" type="button" disabled={!server.ready} onclick={() => play(server.jobId)}>{server.ready ? "Join" : "Starting"}</button>
                                                </div>
                                                <div class="game-server-right"></div>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</main>
