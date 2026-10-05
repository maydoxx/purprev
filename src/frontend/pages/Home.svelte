<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";

    const me = session.me!;

    let friends = $state<any[]>([]);
    let friendCount = $state(0);
    let feed = $state<any[]>([]);
    let feedLoaded = $state(false);
    let played = $state<any[]>([]);
    let favorites = $state<any[]>([]);
    let picks = $state<any[]>([]);
    let blog = $state<any[]>([]);
    let status = $state("");
    let flash = $state("");

    api("/user/friends").then(d => {
        friends = d.list.slice(0, 9);
        friendCount = d.friendCount;
    }).catch(() => {});

    api("/games?sort=recently-played").then(d => {
        played = (d.games ?? []).slice(0, 6);
    }).catch(() => {});

    api("/games?sort=my-favorites").then(d => {
        favorites = (d.games ?? []).slice(0, 6);
    }).catch(() => {});

    const loadFeed = () => api("/site/feed").then(d => {
        if (Array.isArray(d)) {
            feed = d;
        }
    }).catch(() => {}).finally(() => {
        feedLoaded = true;
    });

    loadFeed().then(() => {
        if (!feed.length) {
            api("/games?sort=popular").then(d => picks = (d.games ?? []).slice(0, 4)).catch(() => {});
        }
    });

    api("/site/blog").then(d => {
        if (Array.isArray(d?.posts)) {
            blog = d.posts.slice(0, 2);
        }
    }).catch(() => {});

    const share = async (e: Event) => {
        e.preventDefault();
        flash = "";
        try {
            await api("/site/feed", {
                status
            });
            status = "";
            await loadFeed();
        } catch (err: any) {
            flash = err.message;
        }
    };

    const club = me.membership && me.membership !== "None" ? me.membership : null;
    const clubName = club === "BC" ? "Builders Club" : club === "TBC" ? "Turbo Builders Club" : "Outrageous Builders Club";
    const avatar = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const headshot = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const icon = (game: any) => game.icon || "/img/DefaultPlaceIcon.jpg";

    const when = (t: number) => {
        const d = new Date(t * 1000);
        const day = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${day} | ${d.getHours() % 12 || 12}:${minutes} ${d.getHours() < 12 ? "AM" : "PM"}`;
    };
</script>

<svelte:head>
    <title>Home - NoneRev</title>
    <link rel="stylesheet" href="/css/home.css">
</svelte:head>

{#snippet gameCard(game: any)}
    <li class="home-game-card">
        <div class="home-game-card-inner">
            <a class="home-game-card-link" href="/game?id={game.id}">
                <div class="home-game-card-thumb">
                    <img src={icon(game)} alt={game.title}>
                </div>
                <div class="home-game-card-name" title={game.title}>{game.title}</div>
                <div class="home-game-card-playing">{Number(game.playing ?? 0).toLocaleString()} Playing</div>
                <div class="home-game-card-vote">
                    <div class="home-vote-bar">
                        <div class="home-vote-up">
                            <span class="home-icon-like"></span>
                        </div>
                        <div class="home-vote-track" class:voted={game.up_votes + game.down_votes > 0}>
                            <div class="home-vote-background"></div>
                            <div class="home-vote-fill" style="width: {game.like_ratio ?? 0}%;"></div>
                            <span class="home-vote-segment"></span>
                            <span class="home-vote-segment"></span>
                            <span class="home-vote-segment"></span>
                            <span class="home-vote-segment"></span>
                        </div>
                        <div class="home-vote-down">
                            <span class="home-icon-dislike"></span>
                        </div>
                    </div>
                    <div class="home-vote-counts">
                        <span class="home-vote-count-up">{Number(game.up_votes ?? 0).toLocaleString()}</span>
                        <span class="home-vote-count-down">{Number(game.down_votes ?? 0).toLocaleString()}</span>
                    </div>
                </div>
            </a>
            {#if game.creator_name}
                <div class="home-game-card-footer">
                    <span class="home-game-card-by">By</span>
                    <a href="/user?id={game.creator_id}">{game.creator_name}</a>
                </div>
            {/if}
        </div>
    </li>
{/snippet}

<main class="home-page">
    <div class="home-container">
        <div class="home-hero">
            <a class="home-avatar" href="/user?id={me.id}">
                <img src={headshot(me.id)} alt={me.username}>
            </a>
            <div class="home-hello" class:home-hello-club={!!club}>
                <h1>
                    <a href="/user?id={me.id}">Hello, {me.username}!</a>
                </h1>
                {#if club}
                    <a class="home-club home-club-{club.toLowerCase()}" href="/premium/membership" title={clubName} aria-label={clubName}></a>
                {/if}
            </div>
        </div>

        {#if friends.length > 0}
            <div class="home-section">
                <div class="home-header">
                    <h3>Friends ({friendCount.toLocaleString()})</h3>
                    <a class="home-btn home-btn-more home-btn-secondary" href="/my/friends">See All</a>
                </div>
                <div class="home-sheet">
                    <ul class="home-friends">
                        {#each friends as friend (friend.id)}
                            <li class="home-friend">
                                <a class="home-friend-link" href="/user?id={friend.id}" title={friend.username}>
                                    <span class="home-friend-avatar">
                                        <img src={avatar(friend.id)} alt={friend.username}>
                                        {#if friend.presence?.type === "game"}
                                            <span class="home-status home-status-game" title={friend.presence.place_name}></span>
                                        {:else if friend.presence?.type === "studio"}
                                            <span class="home-status home-status-studio" title={friend.presence.place_name}></span>
                                        {:else if friend.online}
                                            <span class="home-status home-status-online"></span>
                                        {/if}
                                    </span>
                                    <span class="home-friend-name">{friend.username}</span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                </div>
            </div>
        {/if}

        {#if played.length > 0}
            <div class="home-section home-games">
                <div class="home-header">
                    <h3>Recently Played</h3>
                    <a class="home-btn home-btn-more home-btn-secondary" href="/games?sort=recently-played">See All</a>
                </div>
                <ul class="home-game-cards">
                    {#each played as game (game.id)}
                        {@render gameCard(game)}
                    {/each}
                </ul>
            </div>
        {/if}

        {#if favorites.length > 0}
            <div class="home-section home-games">
                <div class="home-header">
                    <h3>My Favorites</h3>
                    <a class="home-btn home-btn-more home-btn-secondary" href="/games?sort=my-favorites">See All</a>
                </div>
                <ul class="home-game-cards">
                    {#each favorites as game (game.id)}
                        {@render gameCard(game)}
                    {/each}
                </ul>
            </div>
        {/if}

        <div class="home-column home-blog-column">
            <div class="home-header">
                <h3>Blog News</h3>
                <a class="home-btn home-btn-more home-btn-control" href="/blog">See More</a>
            </div>
            <div class="home-sheet">
                <ul class="home-blog">
                    {#each blog as post (post.id)}
                        <li>
                            <a class="home-blog-link" href="/blog?id={post.id}">{post.title}</a>
                        </li>
                    {:else}
                        <li class="home-empty">Nothing yet...</li>
                    {/each}
                </ul>
            </div>
        </div>

        <div class="home-column home-feed-column">
            <div class="home-header">
                <h3>My Feed</h3>
            </div>
            <div class="home-sheet">
                <form class="home-share" onsubmit={share}>
                    <div class="home-share-field">
                        <input class="home-input" type="text" bind:value={status} maxlength="254" placeholder="What are you up to?" autocomplete="off">
                    </div>
                    <button class="home-btn home-btn-primary" type="submit">Share</button>
                </form>
                {#if flash}
                    <div class="home-flash">{flash}</div>
                {/if}
                <ul class="home-feed">
                    {#each feed as item (item.id)}
                        <li class="home-feed-item">
                            <a class="home-feed-avatar" href="/user?id={item.user_id}">
                                <img src={headshot(item.user_id)} alt={item.username}>
                            </a>
                            <div class="home-feed-body">
                                <p class="home-feed-name">
                                    <a href="/user?id={item.user_id}">{item.username}</a>
                                </p>
                                <p class="home-feed-text">"{item.body}"</p>
                                <span class="home-feed-date">{when(item.created_at)}</span>
                                <a class="home-feed-report" href="/abusereport?type=user&id={item.user_id}" title="Report Abuse" aria-label="Report Abuse"></a>
                            </div>
                        </li>
                    {/each}
                    {#if feedLoaded && feed.length === 0}
                        <li class="home-feed-item home-feed-game">
                            <a class="home-feed-icon" href="/games" aria-label="Games">
                                <span class="home-icon-games"></span>
                            </a>
                            <div class="home-feed-body">
                                <h2>Play Games</h2>
                                <p class="home-feed-copy">Nearly all NoneRev games are built by players like you. Here are some of our favorites:</p>
                                {#if picks.length > 0}
                                    <ul class="home-feed-games">
                                        {#each picks as game (game.id)}
                                            <li>
                                                <a href="/game?id={game.id}" title={game.title}>
                                                    <img src={icon(game)} alt={game.title}>
                                                    <span class="home-feed-game-name">{game.title}</span>
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </li>
                        <li class="home-feed-item home-feed-creation">
                            <a class="home-feed-icon" href="/my/avatar" aria-label="Avatar">
                                <span class="home-icon-avatar"></span>
                            </a>
                            <div class="home-feed-body">
                                <h2>Customize Your Avatar</h2>
                                <p class="home-feed-copy">Visit the <a href="/my/avatar">Avatar page</a> to customize your avatar. Get new clothing in the <a href="/catalog">catalog</a>.</p>
                                <ul class="home-feed-looks">
                                    {#each [1, 2, 3, 4] as n}
                                        <li>
                                            <img src="/img/home/look-{n}.png" alt="NoneRev avatar">
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        </li>
                        <li class="home-feed-item home-feed-creation">
                            <a class="home-feed-icon" href="/develop" aria-label="Develop">
                                <span class="home-icon-develop"></span>
                            </a>
                            <div class="home-feed-body">
                                <h2>Build Something</h2>
                                <p class="home-feed-copy">Builders will enjoy playing our multiplayer building game. Professional builders will want to check out NoneRev Studio, our game development environment on your <a href="/develop">Develop page</a>.</p>
                            </div>
                        </li>
                        <li class="home-feed-item home-feed-social">
                            <a class="home-feed-icon" href="/search?type=users" aria-label="Find people">
                                <span class="home-icon-friends"></span>
                            </a>
                            <div class="home-feed-body">
                                <h2>Make Friends</h2>
                                <p class="home-feed-copy">Meet other players in-game and send them a friend request. If you miss your opportunity you can always send a request later by <a href="/search?type=users">searching</a> for their user profile.</p>
                            </div>
                        </li>
                    {/if}
                </ul>
            </div>
        </div>
    </div>
</main>
