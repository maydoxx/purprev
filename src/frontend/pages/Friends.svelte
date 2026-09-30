<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const tabs = [["friends", "Friends"], ["following", "Following"], ["followers", "Followers"], ["requests", "Requests"]];
    const ownerId = $derived(Number(router.query.user) || 0);
    const publicView = $derived(ownerId > 0 && ownerId !== session.me?.id);
    const tab = $derived(tabs.some(([key]) => key === router.query.tab) ? router.query.tab : publicView ? "followers" : "friends");
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
    const list = $derived(tab === "requests" ? requests : tab === "following" ? following : tab === "followers" ? followers : friends);
    const totalPages = $derived(Math.max(1, Math.ceil(list.length / 18)));
    const visible = $derived(list.slice((page - 1) * 18, page * 18));
    const label = $derived(tabs.find(([key]) => key === tab)?.[1] || "Friends");

    $effect(() => { tab; page = 1; });

    const load = async () => {
        loading = true;
        try {
            if (publicView) {
                const d = await api(`/user/friends/${ownerId}?tab=${tab === "following" ? "following" : "followers"}`);
                ownerName = d.username;
                following = tab === "following" ? d.list : [];
                followers = tab === "followers" ? d.list : [];
            } else {
                const results = await Promise.all(["friends", "requests", "sent", "following", "followers"].map(key => api(`/user/friends?tab=${key}`)));
                [friends, requests, sent, following, followers] = results.map(d => Array.isArray(d.list) ? d.list : []);
            }
            page = Math.min(page, Math.max(1, Math.ceil(list.length / 18)));
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
        if (action === "remove" && !confirm("Remove this friend?")) return;
        busy = userId;
        error = "";
        try {
            await api("/user/friends", { action, userId });
            await load();
        } catch (err: any) {
            error = err.message;
        } finally {
            busy = null;
        }
    };

    const ignoreAll = async () => {
        if (!confirm("Ignore all pending friend requests?")) return;
        busy = 0;
        error = "";
        const results = await Promise.allSettled(requests.map(u => api("/user/friends", { action: "decline", userId: u.id })));
        if (results.some(result => result.status === "rejected")) error = "Some requests could not be ignored. Please try again.";
        await load();
        busy = null;
    };

    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
</script>

<svelte:head>
    <title>My Friends - NoneRev</title>
    <link rel="stylesheet" href="/css/friends.css">
</svelte:head>

{#snippet card(u: any, kind: string)}
    <li class="friends-list-item">
        <div class="friends-list-card">
            <a class="friends-list-avatar" href="/user?id={u.id}" title={u.username}>
                <img src={pic(u.id)} alt="">
                {#if u.online && kind === "friends"}<span class="friends-online-indicator" title="Online" aria-label="Online"></span>{/if}
            </a>
            <div class="friends-list-info">
                <a class="friends-list-name" href="/user?id={u.id}" title={u.username}>{u.username}</a>
                {#if kind === "friends"}<span class="friends-list-status">{u.online ? "Online" : "Offline"}</span>{/if}
                {#if kind === "sent"}<span class="friends-list-status">Request sent</span>{/if}
            </div>
            {#if kind === "requests"}
                <div class="friends-list-actions">
                    <button class="friends-accept" disabled={busy !== null} onclick={() => act("accept", u.id)}>Accept</button>
                    <button disabled={busy !== null} onclick={() => act("decline", u.id)}>Ignore</button>
                </div>
            {:else if kind === "sent"}
                <div class="friends-list-actions"><button disabled={busy !== null} onclick={() => act("decline", u.id)}>Cancel</button></div>
            {:else if kind === "following" && !publicView}
                <div class="friends-list-actions">
                    <button disabled={busy !== null} onclick={() => setFollow(u.id, false)}>Unfollow</button>
                </div>
            {:else if kind === "followers" && !publicView}
                <div class="friends-list-actions">
                    <button disabled={busy !== null} onclick={() => setFollow(u.id, true)}>Follow</button>
                </div>
            {:else if kind === "friends"}
                <details class="friends-card-menu">
                    <summary aria-label={`Actions for ${u.username}`}>⋯</summary>
                    <button disabled={busy !== null} onclick={() => act("remove", u.id)}>Unfriend</button>
                </details>
            {:else}
                <span></span>
            {/if}
        </div>
    </li>
{/snippet}

<main class="rbx-content friends-page-background">
    <div class="friends-page">
        <h1>{publicView ? `${ownerName}'s Connections` : "My Friends"}</h1>
        <nav class="friends-tabs" class:public-view={publicView} aria-label="Friends sections">
            {#each tabs as [key, title]}
                {#if !publicView || key === "following" || key === "followers"}
                    <a href={`/my/friends?tab=${key}${publicView ? `&user=${ownerId}` : ""}`} class:active={tab === key} aria-current={tab === key ? "page" : undefined}>{title}</a>
                {/if}
            {/each}
        </nav>
        <section class="friends-content" aria-label={label}>
            <div class="friends-section-heading">
                <h2>{label} ({list.length.toLocaleString()})</h2>
                <span class="friends-info-icon" title={tab === "requests" ? "Accept requests to add people to your friends list." : "Your friends can be found here."} aria-label="Information">i</span>
                {#if tab === "requests" && requests.length > 0}<button class="friends-ignore-all" disabled={busy !== null} onclick={ignoreAll}>Ignore All</button>{/if}
            </div>
            {#if error}<div class="friends-error" role="alert">{error} <button onclick={() => { error = ""; loading = true; load(); }}>Retry</button></div>{/if}
            {#if loading}
                <div class="friends-empty-list" role="status">Loading…</div>
            {:else if list.length === 0}
                <div class="friends-empty-list">{tab === "requests" ? "You have no pending friend requests." : "You have no friends yet."}</div>
            {:else}
                <ul class="friends-list">{#each visible as u (u.id)}{@render card(u, tab)}{/each}</ul>
            {/if}
            {#if tab === "requests" && sent.length > 0}
                <h2 class="friends-sent-heading">Requests Sent ({sent.length})</h2>
                <ul class="friends-list">{#each sent as u (u.id)}{@render card(u, "sent")}{/each}</ul>
            {/if}
        </section>
        {#if (tab === "friends" || tab === "requests") && totalPages > 1}
            <nav class="friends-pagination" aria-label="Friends pages">
                <button aria-label="Previous page" disabled={page === 1} onclick={() => page--}>‹</button>
                <span>Page</span><span class="friends-page-number">{page}</span><span>of {totalPages}</span>
                <button aria-label="Next page" disabled={page === totalPages} onclick={() => page++}>›</button>
            </nav>
        {/if}
    </div>
</main>
