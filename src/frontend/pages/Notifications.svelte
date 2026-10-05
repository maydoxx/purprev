<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    const first = $derived(Math.max(1, Number(router.query.page) || 1));
    let page = $state(1);
    let data = $state<any>(null);
    let error = $state("");
    let busy = $state(false);
    let more = $state(false);

    const load = async () => {
        try {
            data = await api(`/notifications?page=${first}`);
            page = first;
            error = "";
        } catch (err: any) {
            error = err.message;
        }
    };

    $effect(() => {
        first;
        load();
    });

    const loadMore = async () => {
        more = true;
        try {
            const next = await api(`/notifications?page=${page + 1}`);
            data = {
                ...next,
                items: [...data.items, ...next.items]
            };
            page = next.page;
        } catch (err: any) {
            error = err.message;
        }
        more = false;
    };

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

    const date = (value: number) => {
        const d = new Date(Number(value) * 1000);
        return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    };
    const when = (value: number) => new Date(Number(value) * 1000).toLocaleString("en-US");
</script>

<svelte:head>
    <title>Notifications - NoneRev</title>
    <link rel="stylesheet" href="/css/notifications.css">
</svelte:head>

<main class="money-page">
    <ul class="money-tabs">
        <li><a href="/my/messages">Messages</a></li>
        <li class="selected"><a href="/my/notifications">Notifications</a></li>
    </ul>
    <button class="notifications-read-all money-btn-control medium" type="button" disabled={busy || !data?.items?.length} onclick={readAll}>Mark All as Read</button>

    {#if error}
        <div class="money-error" role="alert">{error}</div>
    {/if}

    <table class="money-table notifications-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>From</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            {#if !data}
                <tr class="money-loading"><td colspan="3"><span></span><span></span><span></span></td></tr>
            {:else if data.items.length === 0}
                <tr><td class="money-empty" colspan="3">You have no notifications.</td></tr>
            {:else}
                {#each data.items as item (item.id)}
                    <tr class:unread={!item.is_read}>
                        <td title={when(item.created_at)}>{date(item.created_at)}</td>
                        <td class="money-member">
                            {#if item.actor_id}
                                <a href="/user?id={item.actor_id}"><img src="/api/user/getProfilePicture?userId={item.actor_id}&type=headshot" alt=""></a>
                                <span>{item.actor_name || "Someone"}</span>
                            {:else}
                                <a href="/home"><img src="/img/noneRevSmall.png" alt=""></a>
                                <span>NoneRev</span>
                            {/if}
                        </td>
                        <td><a href={item.href} onclick={() => read(item.id)}>{description(item)}</a></td>
                    </tr>
                {/each}
                {#if page < data.totalPages}
                    <tr class="money-more">
                        <td colspan="3"><button class="money-btn-control small" type="button" disabled={more} onclick={loadMore}>More Records</button></td>
                    </tr>
                {/if}
            {/if}
        </tbody>
    </table>
</main>
