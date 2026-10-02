<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    $effect(() => {
        if (session.me && !session.me.ongoing_action_id) {
            router.replace("/home");
        }
    });

    const types: Record<number, string> = {
        1: "Warning",
        2: "Ban for 1 Day",
        3: "Ban for 3 Days",
        4: "Ban for 7 Days",
        5: "Ban for 14 Days",
        6: "Account Deleted"
    };

    let action = $state<any>(null);
    let agreed = $state(false);

    api("/user/moderation").then(d => {
        if (d && d.action) {
            action = d;
        }
    }).catch(() => {});

    const type = $derived(types[action?.action] ?? "Moderated");
    const terminated = $derived(action?.action === 6);
    const canReactivate = $derived(!!action && !terminated && Number(action.expiresAt) * 1000 < Date.now());

    const when = (t: any) => t ? new Date(Number(t) * 1000).toLocaleString("en-US") : "";

    const logout = async () => {
        await session.logout();
        router.go("/");
    };

    const reactivate = async () => {
        if (!canReactivate || !agreed) {
            return;
        }
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
    <link rel="stylesheet" href="/css/not-approved.css">
</svelte:head>

<main class="not-approved-page">
    <div class="not-approved-stage">
        <div class="not-approved-box">
            <h2>{type}</h2>
            <div class="not-approved-body">
                {#if terminated}
                    <p>Our content monitors have determined that your behavior at NoneRev has been in violation of our Terms of Service.</p>
                {:else}
                    <p>Our content monitors have determined that your behavior at NoneRev has been in violation of our Terms of Service. We will terminate your account if you do not abide by the rules.</p>
                {/if}
                {#if action}
                    {#if action.createdAt}
                        <p>Reviewed: <strong>{when(action.createdAt)}</strong></p>
                    {/if}
                    <p>Moderator Note: <strong>{action.reason ?? ""}</strong></p>
                    {#if terminated}
                        <p>Your account has been terminated.</p>
                        <p>If you wish to appeal, please make a ticket in the <a href="/discord">Discord Server</a>.</p>
                    {:else}
                        <p>Please abide by the <a href="/info/tos">NoneRev Community Guidelines</a> so that NoneRev can be fun for users of all ages.</p>
                        {#if canReactivate}
                            <p>You may re-activate your account by agreeing to our <a href="/info/tos">Terms of Service</a>.</p>
                            <div class="not-approved-agree">
                                <input id="agree" type="checkbox" bind:checked={agreed}>
                                <label for="agree">I Agree</label>
                            </div>
                        {:else}
                            <p>Your account has been disabled. You may re-activate it after <strong>{when(action.expiresAt)}</strong>.</p>
                            <p>If you wish to appeal, please make a ticket in the <a href="/discord">Discord Server</a>.</p>
                        {/if}
                    {/if}
                {/if}
                <div class="not-approved-actions">
                    {#if canReactivate}
                        <button type="button" disabled={!agreed} onclick={reactivate}>Reactivate My Account</button>
                    {/if}
                    <button type="button" onclick={logout}>Logout</button>
                </div>
            </div>
        </div>
    </div>
</main>
