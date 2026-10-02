<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import GameCard, { sortRow } from "../GameCard.svelte";

    const me = session.me!;

    let friends = $state<any[]>([]);
    let friendCount = $state(0);
    let feed = $state<any[]>([]);
    let feedLoaded = $state(false);
    let played = $state<any[]>([]);
    let blog = $state<any[]>([]);
    let status = $state("");
    let flash = $state("");

    api("/user/friends").then(d => {
        friends = d.list.slice(0, 9);
        friendCount = d.friendCount;
    }).catch(() => {});

    // one row only, 96px tiles with a 16px gap inside 15px of padding
    let friendListWidth = $state(0);
    const shownFriends = $derived(friends.slice(0, Math.max(1, Math.floor((friendListWidth - 30 + 16) / 112))));

    api("/games?sort=recently-played").then(d => {
        played = d.games ?? [];
    }).catch(() => {});

    const loadFeed = () => api("/site/feed").then(d => {
        if (Array.isArray(d)) {
            feed = d;
        }
    }).catch(() => {}).finally(() => {
        feedLoaded = true;
    });
    loadFeed();

    api("/site/blog").then(d => {
        if (Array.isArray(d?.posts)) {
            blog = d.posts.slice(0, 3);
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

    const clubName = me.membership === "BC" ? "Builders Club" : me.membership === "TBC" ? "Turbo Builders Club" : "Outrageous Builders Club";
    const avatar = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const headshot = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const when = (t: number) => new Date(t * 1000).toLocaleString();
</script>

<svelte:head>
    <title>Home - NoneRev</title>
    <link rel="stylesheet" href="/css/home.css">
</svelte:head>

<main class="home-page">
    <div class="home-container">
        <div class="home-hero">
            <a class="home-avatar" href="/user?id={me.id}">
                <img src={headshot(me.id)} alt={me.username}>
            </a>
            <div class="home-hello">
                <h1>
                    <a href="/user?id={me.id}">Hello, {me.username}!</a>
                </h1>
                {#if me.membership && me.membership !== "None"}
                    <a class="home-club" href="/premium/membership" title={clubName} aria-label={clubName}>
                        <span class="icon-{me.membership.toLowerCase()}"></span>
                    </a>
                {/if}
            </div>
        </div>

        <div class="home-section">
            <div class="home-header">
                <h3>Friends ({friendCount.toLocaleString()})</h3>
                <a class="home-btn home-btn-secondary" href="/my/friends">See All</a>
            </div>
            <div class="home-sheet" bind:clientWidth={friendListWidth}>
                {#if friends.length > 0}
                    <ul class="home-friends">
                        {#each shownFriends as friend (friend.id)}
                            <li>
                                <a href="/user?id={friend.id}" title={friend.username}>
                                    <span class="home-friend-thumb">
                                        <img src={avatar(friend.id)} alt={friend.username}>
                                    </span>
                                    <span class="home-friend-name">{friend.username}</span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <span class="home-empty">You have no friends yet.</span>
                {/if}
            </div>
        </div>

        {#if played.length > 0}
            <div class="home-section">
                <div class="home-header">
                    <h3>Recently Played</h3>
                    <a class="home-btn home-btn-secondary" href="/games?sort=recently-played">See All</a>
                </div>
                <div class="home-sheet home-games">
                    <div class="game-sort-row" use:sortRow>
                        <div class="game-sort-scroller">
                            <div class="game-sort-list">
                                <ul>
                                    {#each played as game (game.id)}
                                        <GameCard {game} />
                                    {/each}
                                </ul>
                            </div>
                        </div>
                        <button type="button" class="game-sort-arrow left" aria-label="Scroll Previous" hidden>
                            <span></span>
                        </button>
                        <button type="button" class="game-sort-arrow right" aria-label="Scroll Next" hidden>
                            <span></span>
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <div class="home-columns">
            <div class="home-column">
                <div class="home-header">
                    <h3>My Feed</h3>
                </div>
                <div class="home-sheet">
                    <form class="home-share" onsubmit={share}>
                        <input class="home-input" type="text" bind:value={status} maxlength="254" placeholder="What are you up to?" autocomplete="off">
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
                                    <a class="home-feed-user" href="/user?id={item.user_id}">{item.username}</a>
                                    <p>"{item.body}"</p>
                                    <span class="home-feed-date">{when(item.created_at)}</span>
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
                                    <p>Nearly all NoneRev games are built by players like you. Here are some of our favorites:</p>
                                </div>
                            </li>
                            <li class="home-feed-item home-feed-creation">
                                <a class="home-feed-icon" href="/my/avatar" aria-label="Avatar">
                                    <span class="home-icon-avatar"></span>
                                </a>
                                <div class="home-feed-body">
                                    <h2>Customize Your Character</h2>
                                    <p>Visit the <a href="/my/avatar">Avatar page</a> to customize your character. Get new clothing in the <a href="/catalog">catalog</a></p>
                                    <ul class="home-feed-gallery">
                                        {#each [1, 2, 3, 4] as n}
                                            <li><img src="/img/home/look-{n}.png" alt="NoneRev avatar"></li>
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
                                    <p>Builders will enjoy playing our multiplayer building game. Professional builders will want to check out NoneRev Studio, our game development environment on your <a href="/develop">Develop page</a>.</p>
                                </div>
                            </li>
                            <li class="home-feed-item home-feed-social">
                                <a class="home-feed-icon" href="/search?type=users" aria-label="Find people">
                                    <span class="home-icon-friends"></span>
                                </a>
                                <div class="home-feed-body">
                                    <h2>Make Friends</h2>
                                    <p>Meet other players in-game and send them a friend request. If you miss your opportunity you can always send a request later by <a href="/search?type=users">searching</a> for their user profile.</p>
                                </div>
                            </li>
                        {/if}
                    </ul>
                </div>
            </div>

            <div class="home-column">
                <div class="home-header">
                    <h3>Blog News</h3>
                    <a class="home-btn home-btn-control" href="/blog">See More</a>
                </div>
                <div class="home-sheet">
                    {#each blog as post (post.id)}
                        <a class="home-blog-link" href="/blog?id={post.id}">{post.title}</a>
                    {:else}
                        <span class="home-empty">Nothing yet...</span>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</main>
