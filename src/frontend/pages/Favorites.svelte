<script lang="ts">
    import GameCard from "../GameCard.svelte";
    import { api } from "../api";
    import { router } from "../router.svelte";

    const id = $derived(Number(router.query.id) || 0);
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const type = $derived(router.query.type === "items" ? "items" : "games");

    let data = $state<any>(null);
    let missing = $state(false);

    $effect(() => {
        data = null;
        missing = false;
        if (!id) {
            missing = true;
            return;
        }
        api(`/user/favorites/${id}?page=${page}&type=${type}`).then(d => data = d).catch(() => missing = true);
    });

    const url = (p: number, kind = type) => `/favorites?id=${id}&type=${kind}&page=${p}`;
</script>

<svelte:head>
    <title>{data ? `${data.username}'s Favorites` : "Favorites"} - NoneRev</title>
</svelte:head>

<main class="rbx-content">
    <div class="favorites-page">
        {#if missing}
            <div class="section-content-off">That user does not exist.</div>
        {:else if data}
            <div class="container-header">
                <h2><a href="/user?id={id}">{data.username}</a>'s Favorites <span class="assets-count">({data.total.toLocaleString()})</span></h2>
            </div>
            <nav class="favorites-tabs" aria-label="Favorite type"><a href={url(1, "games")} class:active={type === "games"}>Games</a><a href={url(1, "items")} class:active={type === "items"}>Catalog Items</a></nav>
            {#if type === "items" && data.items?.length === 0}
                <div class="section-content-off">{data.username} has no favorite items yet.</div>
            {:else if type === "games" && data.games.length === 0}
                <div class="section-content-off">{data.username} has no favorite games yet.</div>
            {:else if type === "items"}
                <ul class="favorite-items-list">{#each data.items as item (item.id)}<li><a href="/catalog/item?id={item.id}"><img src={item.thumbnail || "/img/pending.png"} alt=""><span>{item.name}</span></a></li>{/each}</ul>
            {:else}
                <ul class="favorites-list">
                    {#each data.games as game (game.id)}
                        <GameCard {game} />
                    {/each}
                </ul>
            {/if}
            {#if data.totalPages > 1}
                <nav aria-label="Page navigation" class="d-flex justify-content-center mt-3">
                    <ul class="pagination">
                        {#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as i}
                            <li class="page-item" class:active={i === page}>
                                <a class="page-link" href={url(i)}>{i}</a>
                            </li>
                        {/each}
                    </ul>
                </nav>
            {/if}
        {/if}
    </div>
</main>

<style>
    .favorites-page {
        max-width: 970px;
        margin: 0 auto;
        color: #191919;
    }

    .favorites-page h2 {
        margin: 0 0 12px;
        font-size: 24px;
        font-weight: 300;
    }

    .favorites-page h2 a {
        color: inherit;
        text-decoration: none;
    }

    .favorites-page h2 a:hover {
        text-decoration: underline;
    }

    .favorites-page .assets-count {
        font-weight: inherit;
    }

    .favorites-list {
        display: flex;
        flex-wrap: wrap;
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .favorites-tabs { display: flex; margin-bottom: 14px; background: #fff; box-shadow: 0 1px 3px #969696bd; }
    .favorites-tabs a { flex: 1; padding: 12px; text-align: center; color: #333; text-decoration: none; }
    .favorites-tabs a.active { border-bottom: 4px solid #7d27c5; }
    .favorite-items-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; list-style: none; padding: 0; }
    .favorite-items-list li { background: #fff; box-shadow: 0 1px 3px #969696bd; }
    .favorite-items-list a { display: flex; flex-direction: column; padding: 7px; color: #333; text-decoration: none; }
    .favorite-items-list img { width: 100%; aspect-ratio: 1; object-fit: contain; }
    .favorite-items-list span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
