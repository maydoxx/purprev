<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    let data = $state<any>(null);
    let error = $state("");
    let busy = $state(false);

    const load = async () => {
        try {
            data = await api(`/notifications?page=${page}`);
            error = "";
        } catch (err: any) {
            error = err.message;
        }
    };

    $effect(() => {
        page;
        load();
    });

    const read = async (id: number) => {
        try {
            await api(`/notifications/${id}/read`, {});
            window.dispatchEvent(new Event("notifications:refresh"));
        } catch (err: any) {
            error = err.message;
        }
    };

    const readAll = async () => {
        busy = true;
        try {
            await api("/notifications/read-all", {});
            await load();
            window.dispatchEvent(new Event("notifications:refresh"));
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const description = (item: any) => {
        const name = item.actor_name || "Someone";
        if (item.kind === "message") return `${name} sent you a message`;
        if (item.kind === "friend_request") return `${name} sent you a friend request`;
        if (item.kind === "friend_accepted") return `${name} accepted your friend request`;
        if (item.kind === "follow") return `${name} followed you`;
        if (item.kind === "group_affiliate") return `${name} requested a group affiliation`;
        if (item.kind === "group_affiliate_accepted") return `${name} accepted your group affiliation`;
        return "New activity";
    };

    const when = (value: number) => new Date(Number(value) * 1000).toLocaleString("en-US");
</script>

<svelte:head>
    <title>Notifications - NoneRev</title>
    <link rel="stylesheet" href="/css/notifications.css">
</svelte:head>

<main class="rbx-content notifications-page">
    <header class="notifications-heading">
        <h1>Notifications</h1>
        <button type="button" disabled={busy || !data?.items?.length} onclick={readAll}>Mark All as Read</button>
    </header>
    {#if error}
        <p class="notifications-error" role="alert">{error}</p>
    {/if}
    {#if data}
        {#if data.items.length === 0}
            <div class="notifications-empty">No notifications yet.</div>
        {/if}
        <ul class="notifications-list">
            {#each data.items as item (item.id)}
                <li class:unread={!item.is_read}>
                    <a href={item.href} onclick={() => read(item.id)}>
                        <img src={item.actor_id ? `/api/user/getProfilePicture?userId=${item.actor_id}&type=headshot` : "/img/pending.png"} alt="">
                        <span>
                            <strong>{description(item)}</strong>
                            <small>{when(item.created_at)}</small>
                        </span>
                    </a>
                </li>
            {/each}
        </ul>
        {#if data.totalPages > 1}
            <nav class="notifications-pages" aria-label="Notification pages">
                {#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as p}
                    <a class:active={p === page} href={`/my/notifications?page=${p}`}>{p}</a>
                {/each}
            </nav>
        {/if}
    {/if}
</main>
