<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";

    let tab = $state(router.query.tab === "requests" ? "requests" : "friends");
    let friends = $state<any[]>([]);
    let requests = $state<any[]>([]);
    let sent = $state<any[]>([]);

    const load = async () => {
        [friends, requests, sent] = await Promise.all([
            api("/user/friends?tab=friends").then(d => d.list),
            api("/user/friends?tab=requests").then(d => d.list),
            api("/user/friends?tab=sent").then(d => d.list)
        ]);
    };
    load();

    const act = async (action: string, userId: number) => {
        if (action === "remove" && !confirm("Remove this friend?")) return;
        try {
            await api("/user/friends", {
                action,
                userId
            });
            await load();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
</script>

<svelte:head>
    <title>Friends - NoneRev</title>
    <link rel="stylesheet" href="/css/friends.css">
</svelte:head>

{#snippet card(u: any, buttons: [string, string, boolean][])}
    <li class="friend-card" class:online={u.online}>
        <a href="/user?id={u.id}" title={u.username}>
            <span class="friend-avatar"><img src={pic(u.id)} alt=""></span>
            <span class="friend-name">{u.username}</span>
            <span class="friend-status">{u.online ? "Online" : "Offline"}</span>
        </a>
        <div class="friend-actions">
            {#each buttons as [action, label, primary]}
                <button type="button" class={primary ? "rbx-btn-primary-sm" : "rbx-btn-control-sm"} onclick={() => act(action, u.id)}>{label}</button>
            {/each}
        </div>
    </li>
{/snippet}

<main class="rbx-content">
    <div class="friends-page">
        <h1>Friends</h1>
        <ul class="friends-tabs">
            <li><a href="/my/friends" class:active={tab === "friends"} onclick={e => { e.preventDefault(); tab = "friends"; }}>Friends <span class="count">{friends.length}</span></a></li>
            <li><a href="/my/friends?tab=requests" class:active={tab === "requests"} onclick={e => { e.preventDefault(); tab = "requests"; }}>Friend Requests <span class="count">{requests.length}</span></a></li>
        </ul>

        <div class="tab-pane" class:active={tab === "friends"}>
            {#if friends.length === 0}
                <div class="friends-empty-list">You have no friends yet. Visit someone's profile and click Add Friend.</div>
            {:else}
                <ul class="friends-grid">
                    {#each friends as u}
                        {@render card(u, [["remove", "Unfriend", false]])}
                    {/each}
                </ul>
            {/if}
        </div>

        <div class="tab-pane" class:active={tab === "requests"}>
            {#if requests.length === 0}
                <div class="friends-empty-list">No pending friend requests.</div>
            {:else}
                <ul class="friends-grid">
                    {#each requests as u}
                        {@render card(u, [["accept", "Accept", true], ["decline", "Ignore", false]])}
                    {/each}
                </ul>
            {/if}

            {#if sent.length > 0}
                <h3>Requests you sent</h3>
                <ul class="friends-grid">
                    {#each sent as u}
                        {@render card(u, [["decline", "Cancel", false]])}
                    {/each}
                </ul>
            {/if}
        </div>
    </div>
</main>
