<script lang="ts">
    let moreBadges = $state(false);

    let copied = $state(false);
    const copyDiscord = async (name: string) => {
        try {
            await navigator.clipboard.writeText(name);
            copied = true;
            setTimeout(() => copied = false, 1500);
        } catch {}
    };

    // ids on /Badges
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

    import GameCard from "../GameCard.svelte";
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    const id = $derived(Number(router.query.id) || 0);

    let profile = $state<any>(null);
    let error = $state("");
    let busy = $state(false);
    let tab = $state("about");
    let expanded = $state(false);
    let overflows = $state(false);
    let aboutEl = $state<HTMLElement | null>(null);

    $effect(() => {
        profile;
        overflows = aboutEl ? aboutEl.scrollHeight > aboutEl.clientHeight + 1 : false;
    });
    let view = $state("slide");
    let slide = $state(0);

    const isMe = $derived(session.me?.id === id);

    const load = async () => {
        profile = null;
        error = "";
        if (!id) {
            error = "unknown user";
            return;
        }
        try {
            profile = await api(`/user/profile/${id}`);
        } catch (err: any) {
            error = err.message;
        }
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

    const date = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "Unknown";
    const pic = (userId: number, type: string) => `/api/user/getProfilePicture?userId=${userId}&type=${type}`;
</script>

<svelte:head>
    <title>{profile ? `${profile.username}'s Profile` : "Profile"} - NoneRev</title>
    <link rel="stylesheet" href="/css/profile.css">
    <link rel="stylesheet" href="/css/friends.css">
</svelte:head>

<main class="rbx-content">
    <div class="profile-container">
        {#if profile}
            <div class="section profile-header">
                <div class="section-content profile-header-content">
                    <div class="profile-header-top">
                        <div class="profile-avatar-image">
                            <span class="avatar-image-link">
                                <img alt={profile.username} class="profile-avatar-thumb" src={pic(id, "headshot")}>
                            </span>
                        </div>
                        <div class="header-title">
                            <h2>{profile.username}</h2>
                            {#if profile.membership && profile.membership !== "None"}<span class="icon-{profile.membership.toLowerCase()}" title="{profile.membership === "BC" ? "Builders Club" : profile.membership === "TBC" ? "Turbo Builders Club" : "Outrageous Builders Club"}"></span>{/if}
                        </div>
                        <div class="header-userstatus">
                            <div class="header-userstatus-text">
                                <span id="userStatusText"></span>
                            </div>
                        </div>
                        <div class="header-details">
                            <ul class="details-info">
                                <li>
                                    <div class="text-label">Friends</div>
                                    <a class="text-name" href={isMe ? "/my/friends" : "#"}>
                                        <h3>{profile.friendCount}</h3>
                                    </a>
                                </li>
                                <li>
                                    <div class="text-label">Followers</div>
                                    <a class="text-name" href="#">
                                        <h3>0</h3>
                                    </a>
                                </li>
                                <li>
                                    <div class="text-label">Following</div>
                                    <a class="text-name" href="#">
                                        <h3>0</h3>
                                    </a>
                                </li>
                            </ul>
                            <ul class="details-actions">
                                {#if isMe}
                                    <li><a class="rbx-btn-control-sm" href="/my/settings">Edit Profile</a></li>
                                {:else}
                                    <li class="btn-friends">
                                        {#if !session.me}
                                            <a class="rbx-btn-control-sm" href="/login">Add Friend</a>
                                        {:else if profile.friendStatus === "friends"}
                                            <button type="button" class="rbx-btn-control-sm" disabled={busy} onclick={() => friend("remove")} title="Remove this friend">Unfriend</button>
                                        {:else if profile.friendStatus === "pending_out"}
                                            <button type="button" class="rbx-btn-control-sm" disabled={busy} onclick={() => friend("decline")} title="Cancel your friend request">Request Sent</button>
                                        {:else if profile.friendStatus === "pending_in"}
                                            <button type="button" class="rbx-btn-primary-sm" disabled={busy} onclick={() => friend("accept")}>Accept Request</button>
                                            <button type="button" class="rbx-btn-control-sm" disabled={busy} onclick={() => friend("decline")}>Decline</button>
                                        {:else}
                                            <button type="button" class="rbx-btn-control-sm" disabled={busy} onclick={() => friend("request")}>Add Friend</button>
                                        {/if}
                                    </li>
                                    <li class="btn-messages">
                                        <a class="rbx-btn-control-sm" href={session.me ? `/my/messages?compose=1&to=${id}` : "/login"}>Message</a>
                                    </li>
                                {/if}
                            </ul>
                        </div>
                    </div>

                    {#if !isMe}
                        <div class="profile-header-more dropdown">
                            <a class="rbx-menu-item" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" title="More">
                                <span class="rbx-icon-more"></span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end rbx-dropdown-menu" role="menu">
                                <li><a href="#">Follow</a></li>
                                <li><a href="/trade?with={id}">Trade Items</a></li>
                                <li><a href="#">Block User</a></li>
                            </ul>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="rbx-tabs-horizontal">
                <ul id="horizontal-tabs" class="rbx-nav-tabs" role="tablist">
                    <li class="rbx-tab">
                        <a class="rbx-tab-heading" class:active={tab === "about"} href="#about" role="tab" onclick={e => { e.preventDefault(); tab = "about"; }}>
                            <span class="text-lead">About</span>
                            <span class="rbx-tab-subtitle"></span>
                        </a>
                    </li>
                    <li class="rbx-tab">
                        <a class="rbx-tab-heading" class:active={tab === "creations"} href="#creations" role="tab" onclick={e => { e.preventDefault(); tab = "creations"; }}>
                            <span class="text-lead">Creations</span>
                            <span class="rbx-tab-subtitle"></span>
                        </a>
                    </li>
                </ul>

                <div class="tab-content rbx-tab-content">
                    <div class="tab-pane" class:active={tab === "about"} id="about" role="tabpanel">
                        <div class="section profile-about">
                            <div class="container-header">
                                <h3>About</h3>
                            </div>
                            <div class="section-content">
                                <div class="profile-about-content">
                                    <p class="para-overflow-toggle para-height" class:para-overflow-toggle-off={expanded || !overflows} bind:this={aboutEl}>
                                        <span class="profile-about-content-text">{profile.about || "Hi! I'm new to NoneRev!"}</span>
                                        <span class="toggle-para" style:display={overflows ? "" : "none"} onclick={() => expanded = !expanded}>{expanded ? "Read Less" : "Read More"}</span>
                                    </p>
                                    {#if profile.socials?.discord || profile.socials?.twitter || profile.socials?.youtube}
                                        <ul class="profile-social">
                                            {#if profile.socials.discord}
                                                <li><button type="button" class="profile-social-link discord" title="Copy Discord username" onclick={() => copyDiscord(profile.socials.discord)}><span class="profile-social-icon"></span>{copied ? "Copied!" : profile.socials.discord}</button></li>
                                            {/if}
                                            {#if profile.socials.twitter}
                                                <li><a class="profile-social-link twitter" href="https://twitter.com/{profile.socials.twitter}" target="_blank" rel="noopener"><span class="profile-social-icon"></span>@{profile.socials.twitter}</a></li>
                                            {/if}
                                            {#if profile.socials.youtube}
                                                <li><a class="profile-social-link youtube" href="https://www.youtube.com/{profile.socials.youtube}" target="_blank" rel="noopener"><span class="profile-social-icon"></span>{profile.socials.youtube}</a></li>
                                            {/if}
                                        </ul>
                                    {/if}
                                </div>
                                <div class="profile-about-footer">
                                    {#if profile.previousUsernames?.length}
                                        <span class="profile-name-history">
                                            <span class="tooltip-pastnames" tabindex="0" data-names={profile.previousUsernames.join(", ")} aria-label="Past usernames: {profile.previousUsernames.join(", ")}">
                                                <span class="icon-pastname"></span>
                                            </span>
                                            <span class="text-pastname">Past usernames</span>
                                        </span>
                                    {/if}
                                    <a href="/discord" class="abuse-report-link">
                                        <span class="text-error">Report Abuse</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div class="container-list profile-avatar">
                            <h3>Currently Wearing</h3>
                            <div class="profile-avatar-left">
                                <div class="thumbnail-holder">
                                    <span class="thumbnail-span">
                                        <img alt={profile.username} src={pic(id, "full")}>
                                    </span>
                                </div>
                            </div>
                            <div class="profile-avatar-right">
                                <div class="profile-avatar-mask">
                                    <div class="profile-accoutrements-container">
                                        <div class="profile-accoutrements-slider">
                                            <ul class="accoutrement-items-container">
                                                {#if profile.wearing.length === 0}
                                                    <li class="accoutrement-empty">{profile.username} isn't wearing anything yet.</li>
                                                {:else}
                                                    {#each profile.wearing as item}
                                                        <li class="accoutrement-item">
                                                            <a href="/catalog/item?id={item.id}" title={item.name}>
                                                                <img class="accoutrement-image" src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                                                            </a>
                                                        </li>
                                                    {/each}
                                                {/if}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="section profile-friends">
                            <div class="container-header">
                                <h3>Friends ({profile.friendCount})</h3>
                                {#if isMe}<a class="rbx-btn-secondary-xs btn-fixed-width btn-more" href="/my/friends">See All</a>{/if}
                            </div>
                            <div class="section-content">
                                {#if profile.friends.length === 0}
                                    <div class="section-content-off">{profile.username} has no friends yet.</div>
                                {:else}
                                    <ul class="friends-grid">
                                        {#each profile.friends as f}
                                            <li class="friend-card" class:online={f.online}>
                                                <a href="/user?id={f.id}" title={f.username}>
                                                    <span class="friend-avatar"><img src={pic(f.id, "headshot")} alt=""></span>
                                                    <span class="friend-name">{f.username}</span>
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>

                        <div class="favorite-games-container">
                            <div class="container-header">
                                <h3>Favorite Games</h3>
                                <a class="rbx-btn-secondary-xs btn-fixed-width btn-more" href="/favorites?id={id}">Favorites</a>
                            </div>
                            {#if !profile.favorites?.length}
                                <div class="section-content-off">{profile.username} has no favorite games yet.</div>
                            {:else}
                                <ul class="favorite-games-list">
                                    {#each profile.favorites as g (g.id)}
                                        <GameCard game={g} />
                                    {/each}
                                </ul>
                            {/if}
                        </div>

                        <div class="section profile-site-badges">
                            <div class="container-header">
                                <h3>NoneRev Badges <span class="assets-count">({profile.siteBadges?.length ?? 0})</span></h3>
                                {#if profile.siteBadges?.length}
                                    <button type="button" class="rbx-btn-secondary-xs btn-fixed-width btn-more" onclick={() => moreBadges = !moreBadges}>{moreBadges ? "See Less" : "See More"}</button>
                                {/if}
                            </div>
                            <div class="section-content">
                                {#if !profile.siteBadges?.length}
                                    <div class="section-content-off">{profile.username} has no NoneRev badges yet.</div>
                                {:else}
                                    <ul class="hlist badge-list" class:badge-list-more={moreBadges}>
                                        {#each profile.siteBadges as b}
                                            <li class="list-item badge-item asset-item">
                                                <a href="/badges#Badge{badgeAnchor[b.id] ?? ""}" class="badge-link" title={b.name}>
                                                    <span class="icon-{b.id}" title={b.name}></span>
                                                    <span class="text-overflow item-name">{b.name}</span>
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>

                        <div class="section profile-badges">
                            <div class="container-header">
                                <h3>Player Badges <span class="assets-count">({profile.badgeCount.toLocaleString()})</span></h3>
                                {#if isMe}<a class="rbx-btn-secondary-xs btn-fixed-width btn-more" href="/my/inventory?category=badges">See All</a>{/if}
                            </div>
                            <div class="section-content">
                                {#if profile.badges.length === 0}
                                    <div class="section-content-off">{profile.username} hasn't earned any player badges yet.</div>
                                {:else}
                                    <ul class="hlist badge-list">
                                        {#each profile.badges as b}
                                            <li class="list-item badge-item asset-item">
                                                <a href="/game?id={b.game_id}" class="badge-link" title={b.name}>
                                                    <img src={b.icon || "/img/pending.png"} alt={b.name}>
                                                    <span class="text-overflow item-name">{b.name}</span>
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>

                        <div class="section profile-statistics">
                            <h3>Statistics</h3>
                            <div class="section-content">
                                <ul class="profile-stats-container">
                                    <li class="profile-stat">
                                        <p class="text-label">Join Date</p>
                                        <p class="text-lead">{date(profile.joined)}</p>
                                    </li>
                                    <li class="profile-stat">
                                        <p class="text-label">Place Visits</p>
                                        <p class="text-lead">{Number(profile.placeVisits ?? 0).toLocaleString()}</p>
                                    </li>
                                    <li class="profile-stat">
                                        <p class="text-label">Forum Posts</p>
                                        <p class="text-lead">{profile.postCount.toLocaleString()}</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane" class:active={tab === "creations"} id="creations" role="tabpanel">
                        <div class="profile-game">
                            <div class="container-header">
                                <h3>Games</h3>
                                {#if profile.games.length > 0}
                                    <div class="container-buttons">
                                        <button class="profile-view-selector rbx-btn-secondary-xs" title="Slideshow View" type="button" onclick={() => view = "slide"}>
                                            <span class="rbx-icon-slideshow" class:selected={view === "slide"}></span>
                                        </button>
                                        <button class="profile-view-selector rbx-btn-control-xs" title="Grid View" type="button" onclick={() => view = "grid"}>
                                            <span class="rbx-icon-grid" class:selected={view === "grid"}></span>
                                        </button>
                                    </div>
                                {/if}
                            </div>

                            {#if profile.games.length > 0}
                                <div id="games-switcher" class="rbx-switcher slide-switcher games" hidden={view !== "slide"}>
                                    <ul class="slide-items-container rbx-switcher-items hlist">
                                        {#each profile.games as g, i}
                                            <li class="rbx-switcher-item profile-slide-item" class:active={i === slide}>
                                                <div class="profile-slide-item-left">
                                                    <div class="slide-item-emblem-container">
                                                        <a href="/game?id={g.id}">
                                                            <img class="game-item-image" src="/img/DefaultPlaceIcon.jpg" alt={g.title}>
                                                        </a>
                                                    </div>
                                                </div>
                                                <div class="profile-slide-item-right games">
                                                    <div class="slide-item-info">
                                                        <h2 class="text-overflow slide-item-name games">
                                                            <a href="/game?id={g.id}">{g.title}</a>
                                                        </h2>
                                                        <p class="text-description para-overflow slide-item-description games">{g.description ?? ""}</p>
                                                    </div>
                                                    <div class="slide-item-stats">
                                                        <ul class="hlist">
                                                            <li class="list-item">
                                                                <p class="text-label slide-item-stat-title">Playing</p>
                                                                <p class="text-lead slide-item-members-count">0</p>
                                                            </li>
                                                            <li class="list-item">
                                                                <p class="text-label slide-item-stat-title">Visits</p>
                                                                <p class="text-lead slide-item-my-rank games">{Number(g.visits ?? 0).toLocaleString()}</p>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </li>
                                        {/each}
                                    </ul>
                                    {#if profile.games.length > 1}
                                        <a class="rbx-switcher-control left" role="button" aria-label="Previous" onclick={() => slide = (slide - 1 + profile.games.length) % profile.games.length}><span class="rbx-icon-carousel-left"></span></a>
                                        <a class="rbx-switcher-control right" role="button" aria-label="Next" onclick={() => slide = (slide + 1) % profile.games.length}><span class="rbx-icon-carousel-right"></span></a>
                                    {/if}
                                </div>

                                <div class="game-grid" hidden={view !== "grid"}>
                                    <ul class="hlist game-list">
                                        {#each profile.games as g}
                                            <li class="list-item rbx-game">
                                                <div class="rbx-game-item">
                                                    <a href="/game?id={g.id}" class="rbx-game-item-link">
                                                        <div class="rbx-game-thumb-content">
                                                            <span class="rbx-game-thumb-wrapper">
                                                                <img class="rbx-game-thumb" src="/img/DefaultPlaceIcon.jpg" alt={g.title}>
                                                            </span>
                                                        </div>
                                                        <div class="text-overflow rbx-game-title" title={g.title}>{g.title}</div>
                                                    </a>
                                                </div>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            {:else}
                                <div class="section-content-off">{profile.username} hasn't created any games yet.</div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {:else if error}
            <div class="section profile-not-found">
                <div class="container-header">
                    <h3>User not found</h3>
                </div>
                <div class="section-content-off">
                    {error === "unknown user" ? "The user you're looking for doesn't exist." : error}
                </div>
            </div>
        {/if}
    </div>
</main>
