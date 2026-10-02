<script lang="ts">
    import GameCard from "../GameCard.svelte";
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

    const id = $derived(Number(router.query.id) || 0);
    const isMe = $derived(session.me?.id === id);

    let profile = $state<any>(null);
    let error = $state("");
    let busy = $state(false);
    let tab = $state("about");
    let threeD = $state(false);
    let copied = $state(false);
    let expanded = $state(false);
    let overflows = $state(false);
    let aboutEl = $state<HTMLElement | null>(null);
    let view = $state("slide");
    let slide = $state(0);

    // measured while the text is still clamped to three lines
    $effect(() => {
        profile;
        overflows = aboutEl ? aboutEl.scrollHeight > aboutEl.clientHeight + 1 : false;
    });

    const load = async () => {
        profile = null;
        error = "";
        expanded = false;
        slide = 0;
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

    const follow = async () => {
        if (!session.me) {
            router.go("/login");
            return;
        }
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

    const date = (t: number) => t ? new Date(t * 1000).toLocaleDateString("en-US") : "Unknown";
    const pic = (userId: number, type: string) => `/api/user/getProfilePicture?userId=${userId}&type=${type}`;
</script>

<svelte:head>
    <title>{profile ? `${profile.username}'s Profile` : "Profile"} - NoneRev</title>
    <link rel="stylesheet" href="/css/profile.css">
</svelte:head>

<main class="profile-page">
    <div class="profile-container">
        {#if profile}
            <div class="profile-sheet profile-header">
                <div class="profile-headshot">
                    <img src={pic(id, "headshot")} alt={profile.username}>
                </div>
                <div class="profile-header-body">
                    <div class="profile-name">
                        <h2>{profile.username}</h2>
                        {#if clubNames[profile.membership]}
                            <span class="profile-club profile-club-{profile.membership.toLowerCase()}" title={clubNames[profile.membership]}></span>
                        {/if}
                    </div>
                    <div class="profile-details">
                        <ul class="profile-counts">
                            <li>
                                <div class="profile-label">Friends</div>
                                <a href={isMe ? "/my/friends" : "#"}>
                                    <h3>{profile.friendCount}</h3>
                                </a>
                            </li>
                            <li>
                                <div class="profile-label">Followers</div>
                                <a href="/my/friends?tab=followers&user={id}">
                                    <h3>{profile.followerCount}</h3>
                                </a>
                            </li>
                            <li>
                                <div class="profile-label">Following</div>
                                <a href="/my/friends?tab=following&user={id}">
                                    <h3>{profile.followingCount}</h3>
                                </a>
                            </li>
                        </ul>
                        <div class="profile-actions">
                            {#if isMe}
                                <a class="profile-btn profile-btn-control" href="/my/settings">Edit Profile</a>
                            {:else}
                                <a class="profile-btn profile-btn-control" href={session.me ? `/my/messages?compose=1&to=${id}` : "/login"}>Message</a>
                                {#if !session.me}
                                    <a class="profile-btn profile-btn-control" href="/login">Add Friend</a>
                                {:else if profile.friendStatus === "friends"}
                                    <button type="button" class="profile-btn profile-btn-control" disabled={busy} onclick={() => friend("remove")} title="Remove this friend">Unfriend</button>
                                {:else if profile.friendStatus === "pending_out"}
                                    <button type="button" class="profile-btn profile-btn-control" disabled={busy} onclick={() => friend("decline")} title="Cancel your friend request">Request Sent</button>
                                {:else if profile.friendStatus === "pending_in"}
                                    <button type="button" class="profile-btn profile-btn-primary" disabled={busy} onclick={() => friend("accept")}>Accept Request</button>
                                    <button type="button" class="profile-btn profile-btn-control" disabled={busy} onclick={() => friend("decline")}>Decline</button>
                                {:else}
                                    <button type="button" class="profile-btn profile-btn-control" disabled={busy} onclick={() => friend("request")}>Add Friend</button>
                                {/if}
                            {/if}
                        </div>
                    </div>
                </div>
                {#if !isMe}
                    <div class="profile-more dropdown">
                        <button type="button" class="profile-more-toggle" data-bs-toggle="dropdown" aria-expanded="false" title="More" aria-label="More">
                            <span class="profile-icon-more"></span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
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

            <div class="profile-tabs" role="tablist">
                <button type="button" class="profile-tab" class:active={tab === "about"} role="tab" aria-selected={tab === "about"} onclick={() => tab = "about"}>About</button>
                <button type="button" class="profile-tab" class:active={tab === "creations"} role="tab" aria-selected={tab === "creations"} onclick={() => tab = "creations"}>Creations</button>
            </div>

            <div class="profile-pane" role="tabpanel" hidden={tab !== "about"}>
                <div class="profile-section profile-about">
                    <div class="profile-heading">
                        <h3>About</h3>
                    </div>
                    <div class="profile-sheet">
                        <div class="profile-about-body">
                            <p class="profile-about-text" class:clamped={!expanded} class:overflows={overflows && !expanded} bind:this={aboutEl}>
                                <span>{profile.about || "Hi! I'm new to NoneRev!"}</span>
                                {#if overflows}
                                    <button type="button" class="profile-about-toggle" onclick={() => expanded = !expanded}>{expanded ? "Read Less" : "Read More"}</button>
                                {/if}
                            </p>
                            {#if profile.socials?.discord || profile.socials?.twitter || profile.socials?.youtube}
                                <ul class="profile-socials">
                                    {#if profile.socials.discord}
                                        <li>
                                            <button type="button" class="profile-social profile-social-discord" title="Copy Discord username" onclick={() => copyDiscord(profile.socials.discord)}>
                                                <span class="profile-social-icon"></span>
                                                {copied ? "Copied!" : profile.socials.discord}
                                            </button>
                                        </li>
                                    {/if}
                                    {#if profile.socials.twitter}
                                        <li>
                                            <a class="profile-social profile-social-twitter" href="https://twitter.com/{profile.socials.twitter}" target="_blank" rel="noopener">
                                                <span class="profile-social-icon"></span>
                                                @{profile.socials.twitter}
                                            </a>
                                        </li>
                                    {/if}
                                    {#if profile.socials.youtube}
                                        <li>
                                            <a class="profile-social profile-social-youtube" href="https://www.youtube.com/{profile.socials.youtube}" target="_blank" rel="noopener">
                                                <span class="profile-social-icon"></span>
                                                {profile.socials.youtube}
                                            </a>
                                        </li>
                                    {/if}
                                </ul>
                            {/if}
                        </div>
                        <div class="profile-about-footer">
                            {#if profile.previousUsernames?.length}
                                <span class="profile-pastnames">
                                    <span class="profile-pastnames-tip" tabindex="0" data-names={profile.previousUsernames.join(", ")} aria-label="Past usernames: {profile.previousUsernames.join(", ")}">
                                        <span class="profile-icon-pastname"></span>
                                    </span>
                                    <span class="profile-pastnames-text">Past usernames</span>
                                </span>
                            {/if}
                            <a class="profile-report" href="/discord">Report Abuse</a>
                        </div>
                    </div>
                </div>

                <div class="profile-section">
                    <div class="profile-heading">
                        <h3>Currently Wearing</h3>
                    </div>
                    <div class="profile-wearing">
                        <div class="profile-wearing-avatar">
                            <span class="profile-wearing-thumb">
                                {#if threeD}
                                    <Avatar3D userId={id} />
                                {:else}
                                    <img src={pic(id, "full")} alt={profile.username}>
                                {/if}
                            </span>
                            <button type="button" class="profile-btn profile-btn-control profile-3d" onclick={() => threeD = !threeD}>{threeD ? "2D" : "3D"}</button>
                        </div>
                        <div class="profile-wearing-items">
                            {#if profile.wearing.length === 0}
                                <span class="profile-wearing-empty">{profile.username} isn't wearing anything yet.</span>
                            {:else}
                                <ul>
                                    {#each profile.wearing as item (item.id)}
                                        <li>
                                            <a href="/catalog/item?id={item.id}" title={item.name}>
                                                <img src={item.thumbnail || "/img/pending.png"} alt={item.name}>
                                            </a>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="profile-section profile-friends">
                    <div class="profile-heading">
                        <h3>Friends ({profile.friendCount})</h3>
                        {#if isMe}
                            <a class="profile-btn profile-btn-secondary" href="/my/friends">See All</a>
                        {/if}
                    </div>
                    <div class="profile-sheet">
                        {#if profile.friends.length === 0}
                            <span class="profile-empty">{profile.username} has no friends yet.</span>
                        {:else}
                            <ul>
                                {#each profile.friends as f (f.id)}
                                    <li class:online={f.online}>
                                        <a href="/user?id={f.id}" title={f.username}>
                                            <span class="profile-friend-thumb">
                                                <img src={pic(f.id, "headshot")} alt="">
                                            </span>
                                            <span class="profile-friend-name">{f.username}</span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </div>

                <div class="profile-section profile-favorites">
                    <div class="profile-heading">
                        <h3>Favorite Games</h3>
                        <a class="profile-btn profile-btn-secondary" href="/favorites?id={id}">Favorites</a>
                    </div>
                    {#if !profile.favorites?.length}
                        <div class="profile-sheet">
                            <span class="profile-empty">{profile.username} has no favorite games yet.</span>
                        </div>
                    {:else}
                        <ul>
                            {#each profile.favorites as g (g.id)}
                                <GameCard game={g} />
                            {/each}
                        </ul>
                    {/if}
                </div>

                <div class="profile-section profile-badges">
                    <div class="profile-heading">
                        <h3>NoneRev Badges ({profile.siteBadges?.length ?? 0})</h3>
                        {#if profile.siteBadges?.length}
                            <a class="profile-btn profile-btn-secondary" href="/badges">See More</a>
                        {/if}
                    </div>
                    <div class="profile-sheet">
                        {#if !profile.siteBadges?.length}
                            <span class="profile-empty">{profile.username} has no NoneRev badges yet.</span>
                        {:else}
                            <ul>
                                {#each profile.siteBadges as b (b.id)}
                                    <li>
                                        <a href="/badges#Badge{badgeAnchor[b.id] ?? ""}" title={b.name}>
                                            <span class="profile-badge-icon icon-{b.id}"></span>
                                            <span class="profile-badge-name">{b.name}</span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </div>

                <div class="profile-section profile-badges">
                    <div class="profile-heading">
                        <h3>Player Badges ({profile.badgeCount.toLocaleString()})</h3>
                        {#if isMe}
                            <a class="profile-btn profile-btn-secondary" href="/my/inventory?category=badges">See All</a>
                        {/if}
                    </div>
                    <div class="profile-sheet">
                        {#if profile.badges.length === 0}
                            <span class="profile-empty">{profile.username} hasn't earned any player badges yet.</span>
                        {:else}
                            <ul>
                                {#each profile.badges as b (b.id)}
                                    <li>
                                        <a href="/game?id={b.game_id}" title={b.name}>
                                            <img class="profile-badge-icon" src={b.icon || "/img/pending.png"} alt={b.name}>
                                            <span class="profile-badge-name">{b.name}</span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </div>

                <div class="profile-section profile-statistics">
                    <div class="profile-heading">
                        <h3>Statistics</h3>
                    </div>
                    <div class="profile-sheet">
                        <ul>
                            <li>
                                <p class="profile-label">Join Date</p>
                                <p class="profile-lead">{date(profile.joined)}</p>
                            </li>
                            <li>
                                <p class="profile-label">Place Visits</p>
                                <p class="profile-lead">{Number(profile.placeVisits ?? 0).toLocaleString()}</p>
                            </li>
                            <li>
                                <p class="profile-label">Forum Posts</p>
                                <p class="profile-lead">{profile.postCount.toLocaleString()}</p>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="profile-pane profile-creations" role="tabpanel" hidden={tab !== "creations"}>
                <div class="profile-heading">
                    <h3>Games</h3>
                    {#if profile.games.length > 0}
                        <div class="profile-views">
                            <button type="button" class="profile-btn {view === "slide" ? "profile-btn-secondary" : "profile-btn-control"}" title="Slideshow View" aria-label="Slideshow View" onclick={() => view = "slide"}>
                                <span class="profile-icon-slideshow" class:selected={view === "slide"}></span>
                            </button>
                            <button type="button" class="profile-btn {view === "grid" ? "profile-btn-secondary" : "profile-btn-control"}" title="Grid View" aria-label="Grid View" onclick={() => view = "grid"}>
                                <span class="profile-icon-grid" class:selected={view === "grid"}></span>
                            </button>
                        </div>
                    {/if}
                </div>
                {#if profile.games.length === 0}
                    <div class="profile-sheet">
                        <span class="profile-empty">{profile.username} hasn't created any games yet.</span>
                    </div>
                {:else}
                    {@const g = profile.games[slide]}
                    <div class="profile-switcher" hidden={view !== "slide"}>
                        <div class="profile-slide-emblem">
                            <a href="/game?id={g.id}">
                                <img src="/img/DefaultPlaceIcon.jpg" alt={g.title}>
                            </a>
                        </div>
                        <div class="profile-slide-info">
                            <h2>
                                <a href="/game?id={g.id}">{g.title}</a>
                            </h2>
                            <p class="profile-slide-description">{g.description ?? ""}</p>
                            <ul>
                                <li>
                                    <p class="profile-label">Playing</p>
                                    <p class="profile-lead">0</p>
                                </li>
                                <li>
                                    <p class="profile-label">Visits</p>
                                    <p class="profile-lead">{Number(g.visits ?? 0).toLocaleString()}</p>
                                </li>
                            </ul>
                        </div>
                        {#if profile.games.length > 1}
                            <button type="button" class="profile-switcher-control left" aria-label="Previous" onclick={() => step(-1)}>
                                <span class="profile-icon-carousel-left"></span>
                            </button>
                            <button type="button" class="profile-switcher-control right" aria-label="Next" onclick={() => step(1)}>
                                <span class="profile-icon-carousel-right"></span>
                            </button>
                        {/if}
                    </div>
                    <ul class="profile-grid" hidden={view !== "grid"}>
                        {#each profile.games as game (game.id)}
                            <li>
                                <a href="/game?id={game.id}" title={game.title}>
                                    <img src="/img/DefaultPlaceIcon.jpg" alt={game.title}>
                                    <span>{game.title}</span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        {:else if error}
            <div class="profile-section">
                <div class="profile-heading">
                    <h3>User not found</h3>
                </div>
                <div class="profile-sheet">
                    <span class="profile-empty">{error === "unknown user" ? "The user you're looking for doesn't exist." : error}</span>
                </div>
            </div>
        {/if}
    </div>
</main>
