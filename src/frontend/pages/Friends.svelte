<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const PER_PAGE = 18;
    const tabs = [["friends", "Friends"], ["following", "Following"], ["followers", "Followers"], ["requests", "Requests"]];
    const tips: Record<string, string> = {
        friends: "Your friends can be found here.",
        following: "People you follow can be found here.",
        followers: "People following you can be found here.",
        requests: "Accept requests to add people to your friends list."
    };
    const ownerId = $derived(Number(router.query.user) || 0);
    const publicView = $derived(ownerId > 0 && ownerId !== session.me?.id);
    const tab = $derived(tabs.some(([key]) => key === router.query.tab) && (!publicView || router.query.tab !== "requests") ? router.query.tab : "friends");
    let ownerName = $state("");
    let friends = $state<any[]>([]);
    let following = $state<any[]>([]);
    let followers = $state<any[]>([]);
    let requests = $state<any[]>([]);
    let sent = $state<any[]>([]);
    let loading = $state(true);
    let error = $state("");
    let busy = $state<number | null>(null);
    let page = $state(1);
    let menu = $state<number | null>(null);
    const list = $derived(tab === "requests" ? requests : tab === "following" ? following : tab === "followers" ? followers : friends);
    const totalPages = $derived(Math.max(1, Math.ceil(list.length / PER_PAGE)));
    const visible = $derived(list.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    const label = $derived(tabs.find(([key]) => key === tab)?.[1] || "Friends");
    const followed = $derived(new Set(following.map(u => u.id)));

    $effect(() => {
        tab;
        page = 1;
        menu = null;
    });

    const load = async () => {
        loading = true;
        try {
            if (publicView) {
                const d = await api(`/user/friends/${ownerId}?tab=${tab}`);
                ownerName = d.username;
                friends = tab === "friends" ? d.list : [];
                following = tab === "following" ? d.list : [];
                followers = tab === "followers" ? d.list : [];
            } else {
                const results = await Promise.all(["friends", "requests", "sent", "following", "followers"].map(key => api(`/user/friends?tab=${key}`)));
                [friends, requests, sent, following, followers] = results.map(d => Array.isArray(d.list) ? d.list : []);
            }
            page = Math.min(page, Math.max(1, Math.ceil(list.length / PER_PAGE)));
        } catch (err: any) {
            error = err.message || "Your friends could not be loaded. Please try again.";
        } finally {
            loading = false;
        }
    };
    $effect(() => {
        tab;
        ownerId;
        load();
    });

    const setFollow = async (userId: number, follow: boolean) => {
        menu = null;
        busy = userId;
        error = "";
        try {
            await api("/user/friends/follow", {
                userId,
                follow
            });
            await load();
        } catch (err: any) {
            error = err.message;
        }
        busy = null;
    };

    const act = async (action: string, userId: number) => {
        menu = null;
        if (action === "remove" && !confirm("Remove this friend?")) {
            return;
        }
        busy = userId;
        error = "";
        try {
            await api("/user/friends", {
                action,
                userId
            });
            await load();
        } catch (err: any) {
            error = err.message;
        } finally {
            busy = null;
        }
    };

    const ignoreAll = async () => {
        if (!confirm("Ignore all pending friend requests?")) {
            return;
        }
        busy = 0;
        error = "";
        const results = await Promise.allSettled(requests.map(u => api("/user/friends", {
            action: "decline",
            userId: u.id
        })));
        if (results.some(result => result.status === "rejected")) {
            error = "Some requests could not be ignored. Please try again.";
        }
        await load();
        busy = null;
    };

    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const hasMenu = (kind: string) => !publicView && (kind === "friends" || kind === "following" || kind === "followers");
</script>

<svelte:head>
    <title>{publicView ? `${ownerName}'s Friends` : "My Friends"} - NoneRev</title>
    <link rel="stylesheet" href="/css/friends.css">
</svelte:head>

{#snippet card(u: any, kind: string)}
    <li class="friends-list-item">
        <div class="friends-list-card">
            <div class="friends-list-top">
                <a class="friends-list-avatar" href="/user?id={u.id}" title={u.username}>
                    <img src={pic(u.id)} alt="">
                    {#if u.online && (kind === "friends" || kind === "following")}
                        <span class="friends-online-indicator" title="Online" aria-label="Online"></span>
                    {/if}
                </a>
                <div class="friends-list-info">
                    <a class="friends-list-name" href="/user?id={u.id}" title={u.username}>{u.username}</a>
                    {#if kind === "sent"}
                        <span class="friends-list-status">Request sent</span>
                    {:else}
                        <span class="friends-list-status">{u.online ? "Online" : "Offline"}</span>
                        {#if u.online && (kind === "friends" || kind === "following")}
                            <span class="friends-list-status">Website</span>
                        {/if}
                    {/if}
                </div>
                {#if hasMenu(kind)}
                    <div class="friends-card-menu">
                        <button type="button" class="friends-card-more" aria-label={`Actions for ${u.username}`} onclick={() => menu = menu === u.id ? null : u.id}></button>
                        {#if menu === u.id}
                            <ul class="friends-dropdown" role="menu">
                                {#if kind === "friends"}
                                    <li><button type="button" disabled={busy !== null} onclick={() => act("remove", u.id)}>Unfriend</button></li>
                                {:else if followed.has(u.id)}
                                    <li><button type="button" disabled={busy !== null} onclick={() => setFollow(u.id, false)}>Unfollow</button></li>
                                {:else}
                                    <li><button type="button" disabled={busy !== null} onclick={() => setFollow(u.id, true)}>Follow</button></li>
                                {/if}
                            </ul>
                        {/if}
                    </div>
                {/if}
            </div>
            {#if kind === "requests"}
                <div class="friends-list-actions">
                    <button type="button" disabled={busy !== null} onclick={() => act("decline", u.id)}>Ignore</button>
                    <button type="button" class="friends-accept" disabled={busy !== null} onclick={() => act("accept", u.id)}>Accept</button>
                </div>
            {:else if kind === "sent"}
                <div class="friends-list-actions">
                    <button type="button" disabled={busy !== null} onclick={() => act("decline", u.id)}>Cancel</button>
                </div>
            {/if}
        </div>
    </li>
{/snippet}

<main class="rbx-content friends-page-background">
    <div class="friends-page">
        <h1 class="friends-title">{publicView ? `${ownerName}'s Friends` : "My Friends"}</h1>
        <nav class="friends-tabs" class:public-view={publicView} aria-label="Friends sections">
            {#each tabs as [key, title]}
                {#if !publicView || key !== "requests"}
                    <a href={`/my/friends?tab=${key}${publicView ? `&user=${ownerId}` : ""}`} class:active={tab === key} aria-current={tab === key ? "page" : undefined}>{title}</a>
                {/if}
            {/each}
        </nav>
        <section class="friends-content" aria-label={label}>
            <div class="friends-section-heading">
                <h2 class="friends-subtitle">{label} ({list.length.toLocaleString()})</h2>
                {#if tab === "requests" && requests.length > 0}
                    <button type="button" class="friends-ignore-all" disabled={busy !== null} onclick={ignoreAll}>Ignore All</button>
                {/if}
                <span class="friends-info-icon" title={tips[tab]} aria-label="Information">i</span>
            </div>
            {#if error}
                <div class="friends-error" role="alert">{error} <button type="button" onclick={() => { error = ""; loading = true; load(); }}>Retry</button></div>
            {/if}
            {#if loading}
                <div class="friends-empty-list" role="status">Loading…</div>
            {:else if list.length === 0}
                <div class="friends-empty-list">
                    {#if tab === "requests"}
                        You have no pending friend requests.
                    {:else if tab === "following"}
                        {publicView ? `${ownerName} is not following anyone.` : "You are not following anyone."}
                    {:else if tab === "followers"}
                        {publicView ? `${ownerName} has no followers yet.` : "You have no followers yet."}
                    {:else}
                        {publicView ? `${ownerName} has no friends yet.` : "You have no friends yet."}
                    {/if}
                </div>
            {:else}
                <ul class="friends-list">
                    {#each visible as u (u.id)}
                        {@render card(u, tab)}
                    {/each}
                </ul>
            {/if}
            {#if tab === "requests" && sent.length > 0}
                <h2 class="friends-sent-heading">Requests Sent ({sent.length})</h2>
                <ul class="friends-list">
                    {#each sent as u (u.id)}
                        {@render card(u, "sent")}
                    {/each}
                </ul>
            {/if}
        </section>
        {#if totalPages > 1}
            <nav class="friends-pagination" aria-label="Friends pages">
                <button type="button" aria-label="Previous page" disabled={page === 1} onclick={() => page--}>‹</button>
                <span class="friends-page-number">{page}</span>
                <span>of</span>
                <span>{totalPages.toLocaleString()}</span>
                <button type="button" aria-label="Next page" disabled={page === totalPages} onclick={() => page++}>›</button>
            </nav>
        {/if}
    </div>
</main>
