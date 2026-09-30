<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import GameCard from "../GameCard.svelte";

    const me = session.me!;

    let friends = $state<any[]>([]);
    let friendCount = $state(0);
    let feed = $state<any[]>([]);
    let played = $state<any[]>([]);
    let blog = $state<any[]>([]);
    let status = $state("");
    let flash = $state("");
    let flashError = $state(false);

    api("/user/friends").then(d => {
        friends = d.list.slice(0, 9);
        friendCount = d.friendCount;
    }).catch(() => {});

    api("/games?sort=recently-played").then(d => {
        played = d.games ?? [];
    }).catch(() => {});

    const loadFeed = () => api("/site/feed").then(d => {
        if (Array.isArray(d)) feed = d;
    }).catch(() => {});
    loadFeed();


    api("/site/blog").then(d => {
        if (Array.isArray(d?.posts)) blog = d.posts.slice(0, 3);
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
            flashError = true;
            flash = err.message;
        }
    };

    const avatar = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const when = (t: number) => new Date(t * 1000).toLocaleString();
</script>

<svelte:head>
    <title>Home - NoneRev</title>
    <link rel="stylesheet" href="/css/home.css">
</svelte:head>

<main class="home2015-page">
    <div class="home2015-wrap">
        <section class="home2015-hero">
            <a class="home2015-hero-avatar" href="/user?id={me.id}">
                <img src={avatar(me.id)} alt={me.username}>
            </a>
            <h1>
                <a href="/user?id={me.id}">Hello, {me.username}!</a>
            </h1>
        </section>

        <section class="home2015-box home2015-friends-box">
            <div class="home2015-box-header">
                <h2>Friends ({friendCount.toLocaleString()})</h2>
                <a class="home2015-btn" href="/my/friends">See All</a>
            </div>

            {#if friends.length > 0}
                <ul class="home2015-friend-list">
                    {#each friends as friend}
                        <li class="home2015-friend">
                            <a href="/user?id={friend.id}" title={friend.username}>
                                <span class="home2015-friend-thumb">
                                    <img src={avatar(friend.id)} alt={friend.username}>
                                </span>
                                <span class="home2015-friend-name">{friend.username}</span>
                            </a>
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>

        {#if played.length > 0}
            <section class="home2015-box home2015-games-box">
                <div class="home2015-box-header">
                    <h2>Recently Played</h2>
                    <a class="home2015-btn" href="/games?sort=recently-played">See All</a>
                </div>
                <div class="game-sort-row">
                    <div class="game-sort-scroller">
                        <div class="game-sort-list">
                            <ul>
                                {#each played as game (game.id)}
                                    <GameCard {game} />
                                {/each}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        {/if}

        <div class="home2015-lower">
            <section class="home2015-box home2015-feed-box">
                <div class="home2015-box-header">
                    <h2>My Feed</h2>
                </div>
                {#if flash}
                    <div class="home2015-flash" class:error={flashError}>{flash}</div>
                {/if}
                <form class="home2015-feed-form" onsubmit={share}>
                    <input class="home2015-feed-input" type="text" bind:value={status} maxlength="254" placeholder="What are you up to?" autocomplete="off">
                    <button class="home2015-share-btn" type="submit">Share</button>
                </form>
                <ul class="home2015-feed-list">
                    {#if feed.length === 0}
                        <li class="home2015-feed-empty">No status updates yet.</li>
                    {:else}
                        {#each feed as item}
                            <li class="home2015-feed-item">
                                <a class="home2015-feed-avatar" href="/user?id={item.user_id}">
                                    <img src={avatar(item.user_id)} alt={item.username}>
                                </a>
                                <div class="home2015-feed-body">
                                    <a class="home2015-feed-user" href="/user?id={item.user_id}">{item.username}</a>
                                    <p class="home2015-feed-text">"{item.body}"</p>
                                    <span class="home2015-feed-date">{when(item.created_at)}</span>
                                </div>
                            </li>
                        {/each}
                    {/if}
                </ul>
            </section>

            <section class="home2015-box home2015-blog-box">
                <div class="home2015-box-header">
                    <h2>Blog News</h2>
                    <a class="home2015-btn-control" href="/blog">See More</a>
                </div>
                {#if blog.length === 0}
                    <div class="home2015-blog-empty">No blog posts yet.</div>
                {:else}
                    <ul class="home2015-blog-list">
                        {#each blog as post}
                            <li>
                                <span class="home2015-page-icon" aria-hidden="true"></span>
                                <a href="/blog?id={post.id}">{post.title}</a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </section>
        </div>
    </div>
</main>
