<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    const tabs = [["friends", "Friends"], ["following", "Following"], ["followers", "Followers"], ["requests", "Requests"]];
    const tab = $derived(tabs.some(([key]) => key === router.query.tab) ? router.query.tab : "friends");
    let friends = $state<any[]>([]);
    let requests = $state<any[]>([]);
    let sent = $state<any[]>([]);
    let loading = $state(true);
    let error = $state("");
    let busy = $state<number | null>(null);
    let page = $state(1);
    const list = $derived(tab === "requests" ? requests : friends);
    const totalPages = $derived(Math.max(1, Math.ceil(list.length / 18)));
    const visible = $derived(list.slice((page - 1) * 18, page * 18));
    const label = $derived(tabs.find(([key]) => key === tab)?.[1] || "Friends");

    $effect(() => { tab; page = 1; });

    const load = async () => {
        try {
            const results = await Promise.all(["friends", "requests", "sent"].map(key => api(`/user/friends?tab=${key}`)));
            [friends, requests, sent] = results.map(d => Array.isArray(d.list) ? d.list : []);
            page = Math.min(page, Math.max(1, Math.ceil((tab === "requests" ? requests : friends).length / 18)));
        } catch (err: any) {
            error = err.message || "Your friends could not be loaded. Please try again.";
        } finally {
            loading = false;
        }
    };
    load();

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
            {:else}
                <details class="friends-card-menu">
                    <summary aria-label={`Actions for ${u.username}`}>⋯</summary>
                    <button disabled={busy !== null} onclick={() => act("remove", u.id)}>Unfriend</button>
                </details>
            {/if}
        </div>
    </li>
{/snippet}

<main class="rbx-content friends-page-background">
    <div class="friends-page">
        <h1>My Friends</h1>
        <nav class="friends-tabs" aria-label="Friends sections">
            {#each tabs as [key, title]}
                <a href={key === "friends" ? "/my/friends" : `/my/friends?tab=${key}`} class:active={tab === key} aria-current={tab === key ? "page" : undefined}>{title}</a>
            {/each}
        </nav>
        <section class="friends-content" aria-label={label}>
            <div class="friends-section-heading">
                <h2>{label}{tab === "friends" || tab === "requests" ? ` (${list.length.toLocaleString()})` : ""}</h2>
                <span class="friends-info-icon" title={tab === "requests" ? "Accept requests to add people to your friends list." : "Your friends can be found here."} aria-label="Information">i</span>
                {#if tab === "requests" && requests.length > 0}<button class="friends-ignore-all" disabled={busy !== null} onclick={ignoreAll}>Ignore All</button>{/if}
            </div>
            {#if error}<div class="friends-error" role="alert">{error} <button onclick={() => { error = ""; loading = true; load(); }}>Retry</button></div>{/if}
            {#if tab === "following" || tab === "followers"}
                <div class="friends-empty-list">{label} is not available yet.</div>
            {:else if loading}
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
