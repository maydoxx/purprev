<script lang="ts">
    import GameCard from "../GameCard.svelte";
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const types: Record<string, string> = {
        games: "games",
        user: "users",
        groups: "groups"
    };

    const q = $derived(router.query.q ?? "");
    const type = $derived(types[router.query.type ?? ""] ? router.query.type! : "games");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let results = $state<any[]>([]);
    let totalPages = $state(0);
    let loaded = $state(false);
    let sent = $state<Record<number, boolean>>({});

    $effect(() => {
        loaded = false;
        api(`/site/search?q=${encodeURIComponent(q)}&type=${type}&page=${page}`).then(d => {
            const list = Array.isArray(d) ? d : d?.results ?? d?.[type];
            results = Array.isArray(list) ? list : [];
            totalPages = Number(d?.totalPages) || 0;
        }).catch(() => {
            results = [];
            totalPages = 0;
        }).finally(() => {
            loaded = true;
        });
    });

    const request = async (userId: number) => {
        try {
            await api("/user/friends", {
                action: "request",
                userId
            });
            sent[userId] = true;
        } catch (err: any) {
            alert(err.message);
        }
    };

    const url = (p: number) => `/search?q=${encodeURIComponent(q)}&type=${type}&page=${p}`;
    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
</script>

<svelte:head>
    <title>Search - NoneRev</title>
</svelte:head>

    <div class="container">
        <h1>{type === "games" && !q ? "All Games" : `Searching for ${q} in ${types[type]}`}</h1>
        {#if type === "games"}
            <ul class="games-search-list">
                {#each results as game (game.id)}
                    <GameCard {game} />
                {/each}
            </ul>
        {:else}
            <div class="row">
            {#if type === "groups"}
                {#each results as group (group.id)}
                    <div class="user-search-item col col-12 bg-body-tertiary p-3 m-0 position-relative">
                        <div class="d-flex align-items-center">
                            <img src={group.icon || "/img/pending.png"} alt="" width="56" height="56" style="object-fit: cover">
                            <div class="ms-3">
                                <h4 class="m-0">{group.name}</h4>
                                <div class="text-muted">{(Number(group.member_count) || 0).toLocaleString()} Members</div>
                            </div>
                            <a class="w-100 h-100 position-absolute left-0 top-0" href="/groups?id={group.id}" aria-label={group.name}></a>
                        </div>
                    </div>
                {/each}
            {:else}
                {#each results as user (user.id)}
                    <div class="user-search-item col col-12 bg-body-tertiary p-3 m-0 position-relative">
                        <div class="d-flex align-items-center">
                            <div class="profile-icon mr-3">
                                <img src={pic(user.id)} alt="Profile Icon" class="img-fluid rounded-circle" width="40" height="40">
                            </div>
                            <div>
                                <h4 class="m-0 ms-3">{user.username}</h4>
                                <a class="w-100 h-100 position-absolute left-0 top-0" href="/user?id={user.id}" aria-label={user.username}></a>
                            </div>
                            {#if session.me && session.me.id !== user.id}
                                <div class="ms-auto z-1">
                                    <button type="button" class="btn btn-primary btn-sm" disabled={sent[user.id]} onclick={() => request(user.id)}>{sent[user.id] ? "Request Sent" : "Send Friend Request"}</button>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
            </div>
        {/if}
        <nav aria-label="Page navigation" class="d-flex justify-content-center mt-3">
            <ul class="pagination">
                {#each Array.from({ length: totalPages }, (_, i) => i + 1) as i}
                    <li class="page-item" class:active={i === page}>
                        <a class="page-link" href={url(i)}>{i}</a>
                    </li>
                {/each}
            </ul>
        </nav>
    </div>

<style>
    .games-search-list {
        display: flex;
        flex-wrap: wrap;
        list-style: none;
        margin: 0;
        padding: 0;
    }
</style>
