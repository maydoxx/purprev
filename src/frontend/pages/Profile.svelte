<script lang="ts">
    import type { Snippet } from "svelte";
    import UserAd from "../UserAd.svelte";
    import Avatar3D from "../Avatar3D.svelte";
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    const badgeAnchor: Record<string, number> = {
        administrator: 1,
        friendship: 2,
        homestead: 6,
        bricksmith: 7,
        inviter: 8,
        veteran: 12,
        "official-model-maker": 17,
        "welcome-to-the-club": 18,
        "builders-club": 11,
        "turbo-builders-club": 15,
        "outrageous-builders-club": 16
    };

    const clubNames: Record<string, string> = {
        BC: "Builders Club",
        TBC: "Turbo Builders Club",
        OBC: "Outrageous Builders Club"
    };

    const catalogTypes = ["t-shirts", "hats", "shirts", "pants", "faces", "gear", "packages"];

    const MAX_COLLECTION = 6;
    const ITEMS_PER_PAGE = 8;
    const CARDS_PER_ROW = 6;

    const id = $derived(Number(router.query.id) || 0);
    const isMe = $derived(session.me?.id === id);

    let profile = $state<any>(null);
    let error = $state("");
    let busy = $state(false);
    let tab = $state("about");
    let menuOpen = $state(false);
    let statusOpen = $state(false);
    let statusDraft = $state("");
    let details = $state<Record<number, any>>({});
    let creations = $state<any[] | null>(null);
    let threeD = $state(false);
    let copied = $state(false);
    let expanded = $state(false);
    let folds = $state(false);
    let aboutEl = $state<HTMLElement | null>(null);
    let itemPage = $state(0);
    let badgesOpen = $state(false);
    let badgesMore = $state(false);
    let badgeList = $state<HTMLElement | null>(null);
    let view = $state("slide");
    let slide = $state(0);
    let gameRows = $state(1);
    let groupView = $state("slide");
    let groupSlide = $state(0);
    let groupRows = $state(1);
    let editing = $state(false);
    let owned = $state<any[]>([]);
    let picked = $state<number[]>([]);
    let saving = $state(false);
    let pickError = $state("");

    const itemPages = $derived(profile ? Math.ceil(profile.wearing.length / ITEMS_PER_PAGE) : 0);
    const worn = $derived(profile ? profile.wearing.slice(itemPage * ITEMS_PER_PAGE, (itemPage + 1) * ITEMS_PER_PAGE) : []);
    const favorites = $derived((profile?.favorites ?? []).map((g: any) => ({
        ...g,
        ...details[g.id]
    })));
    const created = $derived(profile ? profile.games.map((g: any) => ({
        ...g,
        creator_id: id,
        creator_name: profile.username,
        ...details[g.id]
    })) : []);
    const hasSocials = $derived(!!(profile?.socials?.discord || profile?.socials?.twitter || profile?.socials?.youtube));
    const inGame = $derived(profile?.presence?.type === "game" ? profile.presence : null);

    $effect(() => {
        profile;
        folds = aboutEl ? aboutEl.scrollHeight > 120 : false;
    });

    $effect(() => {
        const list = badgeList;
        if (!list) {
            return;
        }
        const sizes = new ResizeObserver(() => {
            const cells = [...list.children] as HTMLElement[];
            badgesMore = cells.some(cell => cell.offsetTop > cells[0].offsetTop);
        });
        sizes.observe(list);
        return () => sizes.disconnect();
    });

    $effect(() => {
        if (tab === "creations" && profile && !creations) {
            loadCreations();
        }
    });

    const fetchVotes = (ids: number[]) => {
        for (const gameId of ids.filter(gameId => !details[gameId])) {
            details[gameId] = {};
            api(`/games/${gameId}`).then(game => details[gameId] = {
                up_votes: game.up_votes,
                down_votes: game.down_votes
            }).catch(() => {});
        }
    };

    const loadCreations = async () => {
        const userId = id;
        creations = [];
        fetchVotes(profile.games.map((g: any) => g.id));
        const d = await api(`/user/profile/${userId}/creations`).catch(() => null);
        if (userId === id) {
            creations = d?.sections ?? [];
        }
    };

    const load = async () => {
        profile = null;
        error = "";
        menuOpen = false;
        statusOpen = false;
        creations = null;
        expanded = false;
        itemPage = 0;
        badgesOpen = false;
        slide = 0;
        gameRows = 1;
        groupSlide = 0;
        groupRows = 1;
        editing = false;
        if (!id) {
            error = "unknown user";
            return;
        }
        try {
            profile = await api(`/user/profile/${id}`);
        } catch (err: any) {
            error = err.message;
            return;
        }
        fetchVotes(profile.favorites.map((g: any) => g.id));
    };

    $effect(() => {
        id;
        load();
    });

    const friend = async (action: string) => {
        busy = true;
        try {
            await api("/user/friends", {
                action,
                userId: id
            });
            await load();
        } catch (err: any) {
            alert(err.message);
        }
        busy = false;
    };

    const follow = async () => {
        busy = true;
        try {
            await api("/user/friends/follow", {
                userId: id,
                follow: !profile.isFollowing
            });
            await load();
        } catch (err: any) {
            alert(err.message);
        }
        busy = false;
    };

    const clickAway = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (menuOpen && !target.closest(".profile-more")) {
            menuOpen = false;
        }
        if (statusOpen && !target.closest(".profile-status")) {
            statusOpen = false;
        }
    };

    const openStatus = () => {
        statusDraft = profile.status ?? "";
        statusOpen = true;
    };

    const saveStatus = async (e: SubmitEvent) => {
        e.preventDefault();
        const text = statusDraft.trim();
        busy = true;
        try {
            await api("/site/feed", {
                status: text
            });
            profile.status = text;
            statusOpen = false;
        } catch (err: any) {
            alert(err.message);
        }
        busy = false;
    };

    const focusInput = (el: HTMLInputElement) => {
        el.focus();
    };

    const copyDiscord = async (name: string) => {
        try {
            await navigator.clipboard.writeText(name);
            copied = true;
            setTimeout(() => copied = false, 1500);
        } catch {}
    };

    const step = (by: number) => {
        slide = (slide + by + profile.games.length) % profile.games.length;
    };

    const stepGroup = (by: number) => {
        groupSlide = (groupSlide + by + profile.groups.length) % profile.groups.length;
    };

    const markOverflow = (el: HTMLElement) => {
        const sizes = new ResizeObserver(() => el.classList.toggle("overflows", el.scrollHeight > el.clientHeight + 1));
        sizes.observe(el);
        return {
            destroy() {
                sizes.disconnect();
            }
        };
    };

    const openPicker = async () => {
        pickError = "";
        picked = profile.collection.map((item: any) => item.id);
        editing = true;
        try {
            owned = await api("/user/collections/owned");
        } catch (err: any) {
            pickError = err.message;
        }
    };

    const pick = (itemId: number) => {
        if (picked.includes(itemId)) {
            picked = picked.filter(x => x !== itemId);
            return;
        }
        if (picked.length >= MAX_COLLECTION) {
            return;
        }
        picked = [...picked, itemId];
    };

    const saveCollection = async () => {
        saving = true;
        pickError = "";
        try {
            await api("/user/collections", {
                items: picked
            });
            profile.collection = picked.map(itemId => owned.find(item => item.id === itemId)).filter(Boolean);
            editing = false;
        } catch (err: any) {
            pickError = err.message;
        }
        saving = false;
    };

    const abbreviate = (n: number) => {
        if (n < 10000) {
            return n.toLocaleString();
        }
        if (n < 1000000) {
            return `${Math.round(n / 1000)}K+`;
        }
        return `${Math.round(n / 1000000)}M+`;
    };

    const upShare = (game: any) => {
        const up = Number(game.up_votes) || 0;
        const down = Number(game.down_votes) || 0;
        return up + down > 0 ? up / (up + down) * 100 : 0;
    };

    const inventory = (category: string) => `/my/inventory?category=${category}${isMe ? "" : `&user=${id}`}`;
    const quoted = (text: string) => text ? `"${text}"` : "";
    const date = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "Unknown";
    const pic = (userId: number, type: string) => `/api/user/getProfilePicture?userId=${userId}&type=${type}`;
</script>

<svelte:window onclick={clickAway} />

<svelte:head>
    <title>{profile ? `${profile.username}'s Profile` : "Profile"} - NoneRev</title>
    <link rel="stylesheet" href="/css/profile.css">
</svelte:head>

{#snippet viewButtons(current: string, set: (next: string) => void)}
    <div class="profile-view-buttons">
        <button type="button" class="profile-view-button" class:selected={current === "slide"} title="Slideshow View" aria-label="Slideshow View" onclick={() => set("slide")}>
            <span class="profile-icon-slideshow" class:selected={current === "slide"}></span>
        </button>
        <button type="button" class="profile-view-button" class:selected={current === "grid"} title="Grid View" aria-label="Grid View" onclick={() => set("grid")}>
            <span class="profile-icon-grid" class:selected={current === "grid"}></span>
        </button>
    </div>
{/snippet}

{#snippet gameCard(game: any)}
    <div class="profile-game-card-inner">
        <a class="profile-game-card-link" href="/game?id={game.id}">
            <div class="profile-game-card-thumb">
                <img src={game.icon || "/img/DefaultPlaceIcon.jpg"} alt={game.title}>
            </div>
            <div class="profile-game-card-name" title={game.title}>{game.title}</div>
            <div class="profile-game-card-playing">{Number(game.playing ?? 0).toLocaleString()} Playing</div>
            <div class="profile-game-card-vote">
                <div class="profile-vote-bar">
                    <div class="profile-vote-up">
                        <span class="profile-icon-like"></span>
                    </div>
                    <div class="profile-vote-track">
                        <div class="profile-vote-background" class:empty={!Number(game.up_votes) && !Number(game.down_votes)}></div>
                        <div class="profile-vote-fill" style="width: {upShare(game)}%;"></div>
                        <div class="profile-vote-mask">
                            <div class="profile-vote-segment"></div>
                            <div class="profile-vote-segment"></div>
                            <div class="profile-vote-segment"></div>
                            <div class="profile-vote-segment"></div>
                        </div>
                    </div>
                    <div class="profile-vote-down">
                        <span class="profile-icon-dislike"></span>
                    </div>
                </div>
                {#if game.up_votes !== undefined}
                    <div class="profile-vote-counts">
                        <div class="profile-vote-down-count">{Number(game.down_votes).toLocaleString()}</div>
                        <div class="profile-vote-up-count">{Number(game.up_votes).toLocaleString()}</div>
                    </div>
                {/if}
            </div>
        </a>
        {#if game.creator_name}
            <div class="profile-game-card-footer">
                <span class="profile-game-card-by">By</span>
                <a href="/user?id={game.creator_id}">{game.creator_name}</a>
            </div>
        {/if}
    </div>
{/snippet}

{#snippet cardGrid(items: any[], rows: number, more: () => void, card: Snippet<[any]>)}
    <div class="profile-grid">
        <ul class="profile-grid-list">
            {#each items.slice(0, rows * CARDS_PER_ROW) as item (item.id)}
                <li class="profile-grid-item">
                    <div class="profile-game-card">
                        {@render card(item)}
                    </div>
                </li>
            {/each}
        </ul>
        {#if items.length > rows * CARDS_PER_ROW}
            <button type="button" class="profile-load-more" onclick={more}>Load More</button>
        {/if}
    </div>
{/snippet}

{#snippet groupCard(group: any)}
    <div class="profile-game-card-inner">
        <a class="profile-game-card-link" href="/groups?id={group.id}" title={group.name}>
            <div class="profile-game-card-thumb">
                <img src={group.icon || "/img/pending.png"} alt={group.name}>
            </div>
            <div class="profile-game-card-name">{group.name}</div>
            <div class="profile-game-card-playing">{abbreviate(group.memberCount)} Members</div>
            <div class="profile-game-card-playing">{group.role}</div>
        </a>
    </div>
{/snippet}

<main class="profile-page">
    <UserAd size="banner" class="user-ad-top" />
    <div class="profile-container">
        {#if profile}
            <div class="profile-header">
                <div class="profile-header-card">
                    <div class="profile-header-top">
                        <div class="profile-headshot">
                            <img src={pic(id, "headshot")} alt={profile.username}>
                            {#if inGame}
                                <span class="profile-presence profile-presence-game" title={inGame.place_name}></span>
                            {:else if profile.online}
                                <span class="profile-presence" title="Online"></span>
                            {/if}
                        </div>
                        <div class="profile-caption">
                            <div class="profile-title">
                                <h2>{profile.username}</h2>
                                {#if clubNames[profile.membership]}
                                    <span class="profile-club profile-club-{profile.membership.toLowerCase()}" title={clubNames[profile.membership]}></span>
                                {/if}
                            </div>
                            <div class="profile-status">
                                {#if statusOpen}
                                    <form onsubmit={saveStatus}>
                                        <input class="profile-status-input" type="text" maxlength="254" aria-label="Status" disabled={busy} bind:value={statusDraft} onkeydown={e => e.key === "Escape" && (statusOpen = false)} use:focusInput>
                                    </form>
                                {:else if isMe}
                                    <button type="button" class="profile-status-text profile-status-edit" title="Update status" onclick={openStatus}>{quoted(profile.status)}</button>
                                {:else}
                                    <span class="profile-status-text">{quoted(profile.status)}</span>
                                {/if}
                            </div>
                            <div class="profile-details">
                                <ul class="profile-counts">
                                    <li>
                                        <div class="profile-label">Friends</div>
                                        <a class="profile-count" href={isMe ? "/my/friends" : `/my/friends?user=${id}`}>
                                            <h3>{profile.friendCount.toLocaleString()}</h3>
                                        </a>
                                    </li>
                                    <li>
                                        <div class="profile-label">Followers</div>
                                        <a class="profile-count" href="/my/friends?tab=followers&user={id}">
                                            <h3>{abbreviate(profile.followerCount)}</h3>
                                        </a>
                                    </li>
                                    <li>
                                        <div class="profile-label">Following</div>
                                        <a class="profile-count" href="/my/friends?tab=following&user={id}">
                                            <h3>{abbreviate(profile.followingCount)}</h3>
                                        </a>
                                    </li>
                                </ul>
                                {#if !isMe}
                                    <ul class="profile-actions" class:three={!!inGame}>
                                        <li>
                                            {#if !session.me}
                                                <a class="profile-action profile-action-add" href="/login"><span>Add Friend</span></a>
                                            {:else if profile.friendStatus === "friends"}
                                                <button type="button" class="profile-action profile-action-remove" disabled={busy} onclick={() => friend("remove")}><span>Unfriend</span></button>
                                            {:else if profile.friendStatus === "pending_out"}
                                                <button type="button" class="profile-action profile-action-pending" disabled><span>Pending</span></button>
                                            {:else if profile.friendStatus === "pending_in"}
                                                <button type="button" class="profile-action profile-action-add" disabled={busy} onclick={() => friend("accept")}><span>Accept</span></button>
                                            {:else}
                                                <button type="button" class="profile-action profile-action-add" disabled={busy} onclick={() => friend("request")}><span>Add Friend</span></button>
                                            {/if}
                                        </li>
                                        <li>
                                            <a class="profile-action profile-action-message" href={session.me ? `/my/messages?compose=1&to=${id}` : "/login"}><span>Message</span></a>
                                        </li>
                                        {#if inGame}
                                            <li>
                                                <a class="profile-action profile-action-join" href="/game?id={inGame.place_id}&join={encodeURIComponent(inGame.job_id)}"><span>Join Game</span></a>
                                            </li>
                                        {/if}
                                    </ul>
                                {/if}
                            </div>
                        </div>
                    </div>
                    {#if session.me && !isMe}
                        <div class="profile-more">
                            <button type="button" class="profile-more-toggle" title="More" aria-label="More" aria-expanded={menuOpen} onclick={() => menuOpen = !menuOpen}>
                                <span class="profile-icon-more"></span>
                            </button>
                            {#if menuOpen}
                                <div class="profile-popover">
                                    <div class="profile-popover-arrow"></div>
                                    <ul class="profile-menu" role="menu">
                                        <li>
                                            <button type="button" disabled={busy} onclick={follow}>{profile.isFollowing ? "Unfollow" : "Follow"}</button>
                                        </li>
                                        <li>
                                            <a href="/trade?with={id}">Trade Items</a>
                                        </li>
                                        <li>
                                            <a href="#">Block User</a>
                                        </li>
                                    </ul>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="profile-tabs">
                <ul class="profile-tab-list" role="tablist">
                    <li class="profile-tab" class:active={tab === "about"}>
                        <button type="button" class="profile-tab-heading" role="tab" aria-selected={tab === "about"} onclick={() => tab = "about"}>
                            <span class="profile-tab-label">About</span>
                        </button>
                    </li>
                    <li class="profile-tab" class:active={tab === "creations"}>
                        <button type="button" class="profile-tab-heading" role="tab" aria-selected={tab === "creations"} onclick={() => tab = "creations"}>
                            <span class="profile-tab-label">Creations</span>
                        </button>
                    </li>
                </ul>
            </div>

            <div class="profile-pane" role="tabpanel" hidden={tab !== "about"}>
                <div class="profile-section profile-about">
                    <div class="profile-heading">
                        <h3>About</h3>
                        {#if hasSocials}
                            <ul class="profile-socials">
                                {#if profile.socials.discord}
                                    <li>
                                        <button type="button" class="profile-social profile-social-discord profile-tip" data-tip={copied ? "Copied!" : profile.socials.discord} aria-label="Copy Discord username" onclick={() => copyDiscord(profile.socials.discord)}></button>
                                    </li>
                                {/if}
                                {#if profile.socials.twitter}
                                    <li>
                                        <a class="profile-social profile-social-twitter profile-tip" href="https://twitter.com/{profile.socials.twitter}" target="_blank" rel="noopener" data-tip="@{profile.socials.twitter}" aria-label="Twitter"></a>
                                    </li>
                                {/if}
                                {#if profile.socials.youtube}
                                    <li>
                                        <a class="profile-social profile-social-youtube profile-tip" href="https://www.youtube.com/{profile.socials.youtube}" target="_blank" rel="noopener" data-tip={profile.socials.youtube} aria-label="YouTube"></a>
                                    </li>
                                {/if}
                            </ul>
                        {/if}
                    </div>
                    <div class="profile-card">
                        <div class="profile-about-body">
                            <p class="profile-about-text" class:folded={folds && !expanded} bind:this={aboutEl}>
                                <span class="profile-about-content">{profile.about || "Hi! I'm new to NoneRev!"}</span>
                                {#if folds}
                                    <button type="button" class="profile-about-toggle" onclick={() => expanded = !expanded}>{expanded ? "Show Less" : "Read More"}</button>
                                {/if}
                            </p>
                        </div>
                        <div class="profile-about-footer">
                            {#if profile.previousUsernames?.length}
                                <span class="profile-pastnames">
                                    <span class="profile-pastnames-tip profile-tip" tabindex="0" data-tip={profile.previousUsernames.join(", ")} aria-label="Past usernames: {profile.previousUsernames.join(", ")}">
                                        <span class="profile-icon-pastname"></span>
                                    </span>
                                    <span class="profile-pastnames-text">Past usernames</span>
                                </span>
                            {/if}
                            <a class="profile-report" href="/abusereport?type=user&id={id}">
                                <span>Report Abuse</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div class="profile-list profile-wearing">
                    <h3>Currently Wearing</h3>
                    <div class="profile-avatar-panel">
                        <div class="profile-avatar-holder">
                            <span class="profile-avatar-thumb">
                                {#if threeD}
                                    <Avatar3D userId={id} />
                                {:else}
                                    <img src={pic(id, "full")} alt={profile.username}>
                                {/if}
                            </span>
                        </div>
                        <button type="button" class="profile-3d" onclick={() => threeD = !threeD}>{threeD ? "2D" : "3D"}</button>
                    </div>
                    <div class="profile-items-panel">
                        <div class="profile-items-mask">
                            <div class="profile-items">
                                {#if profile.wearing.length === 0}
                                    <span class="profile-items-empty">{profile.username} isn't wearing anything yet.</span>
                                {:else}
                                    <ul class="profile-items-page">
                                        {#each worn as item (item.id)}
                                            <li>
                                                <a href="/catalog/item?id={item.id}" title={item.name}>
                                                    <img src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                    {#if itemPages > 1}
                                        <div class="profile-items-pager">
                                            {#each { length: itemPages } as _, page}
                                                <button type="button" class="profile-items-dot" class:active={page === itemPage} aria-label="Page {page + 1}" onclick={() => itemPage = page}></button>
                                            {/each}
                                        </div>
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                {#if profile.friends.length > 0}
                    <div class="profile-section profile-friends">
                        <div class="profile-heading">
                            <h3>Friends ({profile.friendCount.toLocaleString()})</h3>
                            <a class="profile-btn-more" href={isMe ? "/my/friends" : `/my/friends?user=${id}`}>See All</a>
                        </div>
                        <div class="profile-card">
                            <ul class="profile-friend-list">
                                {#each profile.friends as f (f.id)}
                                    <li class="profile-friend">
                                        <div class="profile-friend-avatar">
                                            <a class="profile-friend-link" href="/user?id={f.id}" title={f.username}>
                                                <span class="profile-friend-thumb">
                                                    <img src={pic(f.id, "full")} alt={f.username}>
                                                </span>
                                                <span class="profile-friend-name">{f.username}</span>
                                            </a>
                                            {#if f.presence?.type === "game"}
                                                <span class="profile-presence profile-presence-game" title={f.presence.place_name}></span>
                                            {:else if f.online}
                                                <span class="profile-presence" title="Online"></span>
                                            {/if}
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/if}

                {#if isMe || profile.collection.length > 0}
                    <div class="profile-section profile-collections">
                        <div class="profile-heading">
                            <h3>Collections</h3>
                            {#if isMe}
                                <button type="button" class="profile-btn-more" onclick={openPicker}>Edit</button>
                            {:else}
                                <a class="profile-btn-more" href="/my/inventory?user={id}">Inventory</a>
                            {/if}
                        </div>
                        <div class="profile-card">
                            {#if profile.collection.length === 0}
                                <span class="profile-empty">You haven't added any items to your collection yet.</span>
                            {:else}
                                <ul class="profile-asset-list">
                                    {#each profile.collection as item (item.id)}
                                        <li class="profile-asset">
                                            <a href="/catalog/item?id={item.id}" title={item.name}>
                                                <img src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                                                <span class="profile-asset-name">{item.name}</span>
                                            </a>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                    </div>
                {/if}

                {#if profile.groups.length > 0}
                    <div class="profile-list profile-groups">
                        <div class="profile-heading">
                            <h3>Groups</h3>
                            {@render viewButtons(groupView, next => groupView = next)}
                        </div>
                        {#if groupView === "grid"}
                            {@render cardGrid(profile.groups, groupRows, () => groupRows++, groupCard)}
                        {:else}
                            <div class="profile-switcher profile-switcher-groups">
                                <ul class="profile-slides">
                                    {#each profile.groups as g, i (g.id)}
                                        <li class="profile-slide" class:active={i === groupSlide}>
                                            <div class="profile-slide-left">
                                                <div class="profile-slide-emblem">
                                                    <a href="/groups?id={g.id}">
                                                        <img class="profile-slide-image" src={g.icon || "/img/pending.png"} alt={g.name}>
                                                    </a>
                                                </div>
                                            </div>
                                            <div class="profile-slide-right">
                                                <div class="profile-slide-info">
                                                    <h2 class="profile-slide-name">
                                                        <a href="/groups?id={g.id}">{g.name}</a>
                                                    </h2>
                                                    <p class="profile-slide-description" use:markOverflow>{g.description ?? ""}</p>
                                                </div>
                                                <div class="profile-slide-stats">
                                                    <ul>
                                                        <li>
                                                            <div class="profile-label">Members</div>
                                                            <div class="profile-lead">{abbreviate(g.memberCount)}</div>
                                                        </li>
                                                        <li>
                                                            <div class="profile-label">Rank</div>
                                                            <div class="profile-lead profile-slide-rank">{g.role}</div>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </li>
                                    {/each}
                                </ul>
                                {#if profile.groups.length > 1}
                                    <button type="button" class="profile-switcher-control left" aria-label="Previous" onclick={() => stepGroup(-1)}>
                                        <span class="profile-icon-carousel-left"></span>
                                    </button>
                                    <button type="button" class="profile-switcher-control right" aria-label="Next" onclick={() => stepGroup(1)}>
                                        <span class="profile-icon-carousel-right"></span>
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if profile.favorites?.length}
                    <div class="profile-list profile-favorites">
                        <div class="profile-heading">
                            <h3>Favorite Games</h3>
                            <a class="profile-btn-more" href="/favorites?id={id}&category=places">Favorites</a>
                        </div>
                        <ul class="profile-game-cards">
                            {#each favorites as g (g.id)}
                                <li class="profile-game-card">
                                    {@render gameCard(g)}
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                {#if profile.siteBadges?.length}
                    <div class="profile-section profile-badges">
                        <div class="profile-heading">
                            <h3>NoneRev Badges <span class="profile-heading-count">({profile.siteBadges.length})</span></h3>
                            {#if badgesMore}
                                <button type="button" class="profile-btn-more profile-badges-more" onclick={() => badgesOpen = !badgesOpen}>{badgesOpen ? "See Less" : "See More"}</button>
                            {/if}
                        </div>
                        <div class="profile-card">
                            <ul class="profile-asset-list" class:open={badgesOpen} bind:this={badgeList}>
                                {#each profile.siteBadges as b (b.id)}
                                    <li class="profile-asset">
                                        <a href="/badges#Badge{badgeAnchor[b.id] ?? ""}" title={b.name}>
                                            <span class="profile-badge-icon profile-badge-{b.id}"></span>
                                            <span class="profile-asset-name">{b.name}</span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/if}

                {#if profile.badges.length > 0}
                    <div class="profile-section profile-badges">
                        <div class="profile-heading">
                            <h3>Player Badges <span class="profile-heading-count">({profile.badgeCount.toLocaleString()})</span></h3>
                            <a class="profile-btn-more" href={inventory("badges")}>See All</a>
                        </div>
                        <div class="profile-card">
                            <ul class="profile-asset-list">
                                {#each profile.badges as b (b.id)}
                                    <li class="profile-asset">
                                        <a href="/game?id={b.game_id}" title={b.name}>
                                            <img src={b.icon || "/img/pending.png"} alt={b.name}>
                                            <span class="profile-asset-name">{b.name}</span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/if}

                <div class="profile-section profile-statistics">
                    <h3>Statistics</h3>
                    <div class="profile-card">
                        <ul class="profile-stats">
                            <li class="profile-stat">
                                <p class="profile-label">Join Date</p>
                                <p class="profile-lead">{date(profile.joined)}</p>
                            </li>
                            <li class="profile-stat">
                                <p class="profile-label">Place Visits</p>
                                <p class="profile-lead">{Number(profile.placeVisits ?? 0).toLocaleString()}</p>
                            </li>
                            <li class="profile-stat">
                                <p class="profile-label">Forum Posts</p>
                                <p class="profile-lead">{profile.postCount.toLocaleString()}</p>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="profile-pane" role="tabpanel" hidden={tab !== "creations"}>
                <div class="profile-games">
                    <div class="profile-heading">
                        <h3>Games</h3>
                        {#if profile.games.length > 0}
                            {@render viewButtons(view, next => view = next)}
                        {/if}
                    </div>
                    {#if profile.games.length === 0}
                        <div class="profile-card">
                            <span class="profile-empty">{profile.username} hasn't created any games yet.</span>
                        </div>
                    {:else if view === "grid"}
                        {@render cardGrid(created, gameRows, () => gameRows++, gameCard)}
                    {:else}
                        <div class="profile-switcher profile-switcher-games">
                            <ul class="profile-slides">
                                {#each created as g, i (g.id)}
                                    <li class="profile-slide" class:active={i === slide}>
                                        <div class="profile-slide-left">
                                            <div class="profile-slide-emblem">
                                                <a href="/game?id={g.id}">
                                                    <img class="profile-slide-image" src={g.icon || "/img/DefaultPlaceIcon.jpg"} alt={g.title}>
                                                </a>
                                            </div>
                                        </div>
                                        <div class="profile-slide-right">
                                            <div class="profile-slide-info">
                                                <h2 class="profile-slide-name">
                                                    <a href="/game?id={g.id}">{g.title}</a>
                                                </h2>
                                                <p class="profile-slide-description" use:markOverflow>{g.description ?? ""}</p>
                                            </div>
                                            <div class="profile-slide-stats">
                                                <ul>
                                                    <li>
                                                        <div class="profile-label">Playing</div>
                                                        <div class="profile-lead">{Number(g.playing ?? 0).toLocaleString()}</div>
                                                    </li>
                                                    <li>
                                                        <div class="profile-label">Visits</div>
                                                        <div class="profile-lead profile-slide-rank">{abbreviate(Number(g.visits ?? 0))}</div>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                            {#if profile.games.length > 1}
                                <button type="button" class="profile-switcher-control left" aria-label="Previous" onclick={() => step(-1)}>
                                    <span class="profile-icon-carousel-left"></span>
                                </button>
                                <button type="button" class="profile-switcher-control right" aria-label="Next" onclick={() => step(1)}>
                                    <span class="profile-icon-carousel-right"></span>
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>

                {#each creations ?? [] as section (section.type)}
                    {@const listed = catalogTypes.includes(section.type)}
                    <div class="profile-section">
                        <div class="profile-heading">
                            <h3>{section.title} <span class="profile-heading-count">({section.total.toLocaleString()})</span></h3>
                            <a class="profile-btn-more" href={listed ? `/catalog?category=${section.type}&creator=${encodeURIComponent(profile.username)}&unavailable=1` : inventory(section.type)}>See All</a>
                        </div>
                        <div class="profile-card">
                            <ul class="profile-asset-list">
                                {#each section.items as item (item.id)}
                                    <li class="profile-asset">
                                        <a href={listed ? `/catalog/item?id=${item.id}` : undefined} title={item.name}>
                                            <img src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                                            <span class="profile-asset-name">{item.name}</span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if error}
            <div class="profile-section">
                <div class="profile-heading">
                    <h3>User not found</h3>
                </div>
                <div class="profile-card">
                    <span class="profile-empty">{error === "unknown user" ? "The user you're looking for doesn't exist." : error}</span>
                </div>
            </div>
        {/if}
    </div>
    {#if editing}
        <div class="profile-modal-backdrop" role="presentation" onclick={() => editing = false}></div>
        <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title">
            <div class="profile-modal-header">
                <h3 id="collection-title">Edit Collections</h3>
                <button type="button" class="profile-modal-close" aria-label="Close" onclick={() => editing = false}></button>
            </div>
            <div class="profile-modal-body">
                <p class="profile-modal-hint">Choose up to {MAX_COLLECTION} items you own to show on your profile. ({picked.length}/{MAX_COLLECTION})</p>
                {#if pickError}
                    <p class="profile-modal-error">{pickError}</p>
                {/if}
                {#if owned.length === 0}
                    <span class="profile-empty">You don't own any items yet.</span>
                {:else}
                    <ul class="profile-picker">
                        {#each owned as item (item.id)}
                            <li>
                                <button type="button" class="profile-picker-item" class:picked={picked.includes(item.id)} title={item.name} onclick={() => pick(item.id)}>
                                    <img src={item.thumbnail || "/img/pending.png"} alt="">
                                    <span class="profile-item-name">{item.name}</span>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
            <div class="profile-modal-footer">
                <button type="button" class="profile-modal-button" onclick={() => editing = false}>Cancel</button>
                <button type="button" class="profile-modal-button profile-modal-save" disabled={saving} onclick={saveCollection}>Save</button>
            </div>
        </div>
    {/if}
    <div class="user-ad-pair">
        <UserAd size="rectangle" />
        <UserAd size="rectangle" />
    </div>
</main>
