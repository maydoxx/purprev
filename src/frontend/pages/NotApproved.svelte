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
        2: "Banned for 1 Day",
        3: "Banned for 3 Days",
        4: "Banned for 7 Days",
        5: "Banned for 14 Days",
        6: "Account Deleted",
        7: "Reminder"
    };

    const durations: Record<number, string> = {
        2: "1 day",
        3: "3 days",
        4: "7 days",
        5: "14 days"
    };

    let action = $state<any>(null);
    let agreed = $state(false);

    api("/user/moderation").then(d => {
        if (d && d.action) {
            action = d;
        }
    }).catch(() => {});

    const type = $derived(types[action?.action] ?? "Moderated");
    const duration = $derived(durations[action?.action] ?? "");
    const terminated = $derived(action?.action === 6);
    const canReactivate = $derived(!!action && !terminated && Number(action.expiresAt) * 1000 < Date.now());

    const when = (t: any) => {
        if (!t) {
            return "";
        }
        const d = new Date(Number(t) * 1000);
        return `${d.toLocaleDateString("en-US")} ${d.toLocaleTimeString("en-US")}`;
    };

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
    <title>NoneRev | Disabled Account</title>
    <link rel="stylesheet" href="/css/not-approved.css">
</svelte:head>

<main class="not-approved-page">
    <div class="not-approved-box">
        <h2>{type}</h2>
        {#if terminated}
            <p>Our content monitors have determined that your behavior at NoneRev has been in violation of our Terms of Service.</p>
        {:else}
            <p>Our content monitors have determined that your behavior at NoneRev has been in violation of our Terms of Service. We will terminate your account if you do not abide by the rules.</p>
        {/if}
        {#if action}
            {#if action.createdAt}
                <p>Reviewed: <b>{when(action.createdAt)}</b></p>
            {/if}
            <p>Moderator Note: <b>{action.reason ?? ""}</b></p>
            {#each action.offenses ?? [] as offense}
                <div class="not-approved-offense">
                    <div class="not-approved-offense-reason"><b>Reason:</b> {offense.label || "Inappropriate"}</div>
                    <div>
                        <b>Offensive Item:</b>
                        <blockquote>{offense.body}</blockquote>
                    </div>
                </div>
            {/each}
            {#if terminated}
                <p>Your account has been terminated.</p>
            {:else}
                <p>Please abide by the <a href="/info/tos">NoneRev Community Guidelines</a> so that NoneRev can be fun for users of all ages.</p>
                {#if duration}
                    <p>Your account has been disabled for {duration}. You may re-activate it after {when(action.expiresAt)}.</p>
                {:else if !canReactivate}
                    <p>Your account has been disabled. You may re-activate it after {when(action.expiresAt)}.</p>
                {/if}
            {/if}
            {#if canReactivate}
                <p>You may re-activate your account by agreeing to our <a href="/info/tos">Terms of Service</a>.</p>
                <p class="not-approved-center">
                    <input id="agree" type="checkbox" bind:checked={agreed}><label for="agree">I Agree</label>
                </p>
                <p class="not-approved-center">
                    <button type="button" disabled={!agreed} onclick={reactivate}>Reactivate My Account</button>
                </p>
            {:else}
                <p>If you wish to appeal, please make a ticket in the <a href="/discord">Discord Server</a>.</p>
            {/if}
        {/if}
        <p class="not-approved-center">
            <button type="button" onclick={logout}>Logout</button>
        </p>
    </div>
</main>
