<script lang="ts">
    import { fade } from "svelte/transition";
    import { sineOut } from "svelte/easing";
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const PER_PAGE = 18;
    const tabs = [["friends", "Friends"], ["following", "Following"], ["followers", "Followers"], ["requests", "Requests"]];
    const headings: Record<string, string> = {
        friends: "Friends",
        following: "Following",
        followers: "Followers",
        requests: "Friend Requests"
    };
    const tips: Record<string, string> = {
        friends: "Friends are established when two NoneRev users mutually agree to friendship.",
        following: "People whose activity you have chosen to follow.",
        followers: "People who have chosen to follow your activity.",
        requests: "Friends are established when two NoneRev users mutually agree to friendship."
    };
    const ownerId = $derived(Number(router.query.user) || 0);
    const publicView = $derived(ownerId > 0 && ownerId !== session.me?.id);
    const tab = $derived(tabs.some(([key]) => key === router.query.tab) && (!publicView || router.query.tab !== "requests") ? router.query.tab : "friends");
    let owner = $state({
        id: 0,
        name: ""
    });
    let friends = $state<any[]>([]);
    let following = $state<any[]>([]);
    let followers = $state<any[]>([]);
    let requests = $state<any[]>([]);
    let sent = $state<any[]>([]);
    let unfollowed = $state<number[]>([]);
    let loading = $state(true);
    let error = $state("");
    let failed = $state(false);
    let modal = $state(false);
    let busy = $state<number | null>(null);
    let page = $state(1);
    let menu = $state<number | null>(null);
    let tip = $state(false);
    const list = $derived(tab === "requests" ? requests : tab === "following" ? following : tab === "followers" ? followers : friends);
    const totalPages = $derived(Math.max(1, Math.ceil(list.length / PER_PAGE)));
    const visible = $derived(list.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    const followed = $derived(new Set(following.map(u => u.id).filter(id => !unfollowed.includes(id))));
    const pageTitle = $derived(!publicView ? "My Friends" : owner.id === ownerId ? `${owner.name}'s Friends` : "");

    $effect(() => {
        tab;
        page = 1;
        menu = null;
    });

    const fail = (message: string, retry = false) => {
        error = message;
        failed = retry;
        modal = true;
    };

    const load = async (quiet = false) => {
        if (!quiet) {
            loading = true;
        }
        try {
            if (publicView) {
                const d = await api(`/user/friends/${ownerId}?tab=${tab}`);
                owner = {
                    id: ownerId,
                    name: d.username
                };
                friends = tab === "friends" ? d.list : [];
                following = tab === "following" ? d.list : [];
                followers = tab === "followers" ? d.list : [];
            } else {
                const results = await Promise.all(["friends", "requests", "sent", "following", "followers"].map(key => api(`/user/friends?tab=${key}`)));
                [friends, requests, sent, following, followers] = results.map(d => Array.isArray(d.list) ? d.list : []);
            }
            unfollowed = [];
            page = Math.min(page, Math.max(1, Math.ceil(list.length / PER_PAGE)));
        } catch (err: any) {
            fail(err.message || "Your friends could not be loaded. Please try again.", true);
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
        try {
            await api("/user/friends/follow", {
                userId,
                follow
            });
            // no reload here, the card stays as "Unfollowed" until the tab is opened again
            if (tab === "following") {
                unfollowed = follow ? unfollowed.filter(id => id !== userId) : [...unfollowed, userId];
            } else {
                await load(true);
            }
        } catch (err: any) {
            fail(err.message);
        }
        busy = null;
    };

    const act = async (action: string, userId: number) => {
        menu = null;
        busy = userId;
        try {
            await api("/user/friends", {
                action,
                userId
            });
            await load(true);
        } catch (err: any) {
            fail(err.message);
        } finally {
            busy = null;
        }
    };

    const ignoreAll = async () => {
        busy = 0;
        const results = await Promise.allSettled(requests.map(u => api("/user/friends", {
            action: "decline",
            userId: u.id
        })));
        if (results.some(result => result.status === "rejected")) {
            fail("Some requests could not be ignored. Please try again.");
        }
        await load(true);
        busy = null;
    };

    const close = () => {
        modal = false;
    };

    const retry = () => {
        close();
        load();
    };

    const dismiss = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            close();
        }
    };

    const outside = (e: MouseEvent) => {
        if (menu !== null && !(e.target as Element).closest(".friends-card-menu")) {
            menu = null;
        }
    };

    const escape = (e: KeyboardEvent) => {
        if (modal && e.key === "Escape") {
            close();
        }
    };

    const drop = () => ({
        duration: 300,
        easing: sineOut,
        css: (t: number) => `transform: translate3d(0, ${(t - 1) * 25}%, 0)`
    });

    const backdropOut = {
        duration: 150,
        delay: 150
    };

    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=full`;
    const hasMenu = (kind: string) => !publicView && (kind === "friends" || kind === "following" || kind === "followers");
</script>

<svelte:head>
    <title>Friends - NoneRev</title>
    <link rel="stylesheet" href="/css/friends.css">
</svelte:head>

<svelte:window onclick={outside} onkeydown={escape} />

{#snippet card(u: any, kind: string)}
    {@const status = u.online && (kind === "friends" || kind === "following")}
    {@const website = status && (kind === "friends" || followed.has(u.id))}
    <li class="friends-card-item">
        <div class="friends-card">
            <div class="friends-card-content">
                <div class="friends-card-avatar">
                    <a class="friends-card-avatar-link" href="/user?id={u.id}">
                        <img class="friends-card-image" src={pic(u.id)} alt="">
                    </a>
                    {#if status}
                        <a class="friends-card-status" href="/user?id={u.id}" title="Website" aria-label="Online"></a>
                    {/if}
                </div>
                <div class="friends-card-caption">
                    <div class="friends-card-name">
                        <a href="/user?id={u.id}" title={u.username}>{u.username}</a>
                    </div>
                    <div class="friends-card-label">{kind === "sent" ? "Request sent" : u.online ? "Online" : "Offline"}</div>
                    {#if website}
                        <div class="friends-card-label">Website</div>
                    {/if}
                    {#if kind === "following" && !followed.has(u.id)}
                        <div class="friends-card-label friends-card-label-fail">Unfollowed</div>
                    {/if}
                </div>
                {#if hasMenu(kind)}
                    <div class="friends-card-menu">
                        <button type="button" class="friends-card-more" aria-label={`Actions for ${u.username}`} aria-expanded={menu === u.id} onclick={() => menu = menu === u.id ? null : u.id}>
                            <span class="friends-card-more-icon"></span>
                        </button>
                        {#if menu === u.id}
                            <div class="friends-popover" transition:fade={{ duration: 150 }}>
                                <ul class="friends-popover-menu" role="menu">
                                    {#if kind === "friends"}
                                        <li><button type="button" disabled={busy !== null} onclick={() => act("remove", u.id)}>Unfriend</button></li>
                                    {:else if followed.has(u.id)}
                                        <li><button type="button" disabled={busy !== null} onclick={() => setFollow(u.id, false)}>Unfollow</button></li>
                                    {:else}
                                        <li><button type="button" disabled={busy !== null} onclick={() => setFollow(u.id, true)}>Follow</button></li>
                                    {/if}
                                </ul>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
            {#if kind === "requests"}
                <div class="friends-card-buttons">
                    <button type="button" class="friends-btn-control" disabled={busy !== null} onclick={() => act("decline", u.id)}>Ignore</button>
                    <button type="button" class="friends-btn-secondary" disabled={busy !== null} onclick={() => act("accept", u.id)}>Accept</button>
                </div>
            {:else if kind === "sent"}
                <div class="friends-card-buttons">
                    <button type="button" class="friends-btn-control friends-btn-wide" disabled={busy !== null} onclick={() => act("decline", u.id)}>Cancel</button>
                </div>
            {/if}
        </div>
    </li>
{/snippet}

<main class="rbx-content">
    <div class="friends-page">
        <h1 class="friends-title">{pageTitle}</h1>
        <ul class="friends-tabs" class:friends-tabs-thirds={publicView}>
            {#each tabs as [key, title]}
                {#if !publicView || key !== "requests"}
                    <li class="friends-tab" class:active={tab === key}>
                        <a class="friends-tab-heading" href={`/my/friends?tab=${key}${publicView ? `&user=${ownerId}` : ""}`} aria-current={tab === key ? "page" : undefined}>
                            <span class="friends-tab-label">{title}</span>
                        </a>
                    </li>
                {/if}
            {/each}
        </ul>
        <div class="friends-content" class:friends-content-hidden={loading}>
            <h3 class="friends-subtitle">{headings[tab]} ({list.length.toLocaleString()})</h3>
            {#if tab === "requests" && requests.length > 0}
                <button type="button" class="friends-ignore-all" disabled={busy !== null} onclick={ignoreAll}>Ignore All</button>
            {/if}
            <span class="friends-tip" role="img" aria-label={tips[tab]} onmouseenter={() => tip = true} onmouseleave={() => tip = false}>
                <span class="friends-tip-icon"></span>
                {#if tip}
                    <span class="friends-tip-bubble" aria-hidden="true" transition:fade={{ duration: 150 }}>
                        <span class="friends-tip-inner">{tips[tab]}</span>
                    </span>
                {/if}
            </span>
            <div class="friends-tab-content">
                <ul class="friends-cards">
                    {#each visible as u (u.id)}
                        {@render card(u, tab)}
                    {/each}
                </ul>
            </div>
        </div>
        {#if !loading && totalPages > 1}
            <div class="friends-pager-holder">
                <ul class="friends-pager">
                    <li class="friends-pager-prev">
                        <button type="button" aria-label="Previous page" disabled={page === 1} onclick={() => page--}><span class="friends-pager-icon"></span></button>
                    </li>
                    <li class="friends-pager-cur"><span>{page}</span></li>
                    <li class="friends-pager-total"><span>of</span> <span>{totalPages.toLocaleString()}</span></li>
                    <li class="friends-pager-next">
                        <button type="button" aria-label="Next page" disabled={page === totalPages} onclick={() => page++}><span class="friends-pager-icon"></span></button>
                    </li>
                </ul>
            </div>
        {/if}
        {#if tab === "requests" && sent.length > 0}
            <div class="friends-content" class:friends-content-hidden={loading}>
                <h3 class="friends-subtitle">Requests Sent ({sent.length.toLocaleString()})</h3>
                <div class="friends-tab-content">
                    <ul class="friends-cards">
                        {#each sent as u (u.id)}
                            {@render card(u, "sent")}
                        {/each}
                    </ul>
                </div>
            </div>
        {/if}
    </div>
    {#if modal}
        <div class="friends-modal-backdrop" in:fade={{ duration: 150 }} out:fade={backdropOut}></div>
        <div class="friends-modal" role="presentation" onclick={dismiss} transition:fade={{ duration: 150 }}>
            <div class="friends-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="friends-modal-title" transition:drop>
                <div class="friends-modal-frame">
                    <div class="friends-modal-content">
                        <div class="friends-modal-header">
                            <button type="button" class="friends-modal-close" aria-label="Close" onclick={close}><span class="friends-modal-close-icon"></span></button>
                            <h5 class="friends-modal-title" id="friends-modal-title">Error</h5>
                        </div>
                        <div class="friends-modal-body">
                            <p>{error}</p>
                        </div>
                        <div class="friends-modal-footer">
                            <button type="button" class="friends-btn-control" onclick={failed ? retry : close}>{failed ? "Retry" : "Ok"}</button>
                        </div>
                        <p class="friends-modal-note">Please check back in few minutes.</p>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</main>
