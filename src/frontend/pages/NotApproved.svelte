<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    $effect(() => {
        if (session.me && !session.me.ongoing_action_id) router.replace("/home");
    });

    const types: Record<number, string> = {
        1: "Warning",
        2: "Ban for 1 Day",
        3: "Ban for 3 Days",
        4: "Ban for 7 Days",
        5: "Ban for 14 Days",
        6: "Account Deleted"
    };

    // TODO: no user route for the ongoing action yet, session only has its id
    let action = $state<any>(null);

    api("/user/moderation").then(d => {
        if (d && d.action) action = d;
    }).catch(() => {});

    const type = $derived(types[action?.action] ?? "Moderated");
    const terminated = $derived(action?.action === 6);
    const canReactivate = $derived(!!action && !terminated && Number(action.expiresAt) * 1000 < Date.now());

    const when = (t: any) => t ? new Date(Number(t) * 1000).toLocaleString("en-US") : "";

    const logout = async (e: Event) => {
        e.preventDefault();
        await session.logout();
        router.go("/");
    };

    const reactivate = async (e: Event) => {
        e.preventDefault();
        if (!canReactivate) return;
        try {
            await api("/user/moderation/reactivate", {});
            await session.refresh();
            router.go("/home");
        } catch (err: any) {
            alert(err.message);
        }
    };
</script>

<svelte:head>
    <title>Not Approved - NoneRev</title>
</svelte:head>

<main class="rbx-content">
    <div class="container col-md-6 mt-5 p-4 bg-white border border-black">
        <h1 class="mb-4">{type}</h1>

        {#if terminated}
            <p class="mb-3">
                Our content monitors have determined that your behavior at NoneRev has been in violation of our Terms of Service.
                <br><br>
                Reviewed: <strong>{when(action.createdAt)}</strong>
                <br><br>
                Moderator Note: <strong>{action.reason ?? ""}</strong>
                <br><br>
                Your account has been terminated.
                <br><br>
                If you wish to appeal, please make a ticket in the <a href="/discord">Discord Server</a>.
                <br>
            </p>
        {:else}
            <p class="mt-3">
                Our content monitors have determined that your behavior at NoneRev has been in violation of our Terms of Service. We will terminate your account if you do not abide by the rules.
                <br><br>
                Reviewed: <strong>{when(action?.createdAt)}</strong>
                <br><br>
                Moderator Note: <strong>{action?.reason ?? ""}</strong>
                <br><br>
                Please abide by the <a href="/tos">NoneRev Community Guidelines</a> so that NoneRev can be fun for users of all ages.
                <br><br>
                Your account has been disabled. You may reactivate it after {when(action?.expiresAt)}.
                <br><br>
                If you wish to appeal, please make a ticket in the <a href="/discord">Discord Server</a>.
            </p>
        {/if}

        <div class="mt-3 text-center">
            <form onsubmit={logout}>
                <button type="submit">Logout</button>
            </form>
            {#if !terminated}
                <a href="?reactivate" class="btn btn-primary mt-2" class:disabled={!canReactivate} onclick={reactivate}>Reactivate account</a>
            {/if}
        </div>
    </div>
</main>
