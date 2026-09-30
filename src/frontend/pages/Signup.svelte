<script lang="ts">
    import AuthBackground from "../AuthBackground.svelte";
    import Turnstile from "../Turnstile.svelte";
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let username = $state("");
    let password = $state("");
    let confirmpassword = $state("");
    let invitekey = $state("");
    let error = $state("");
    let busy = $state(false);
    let closed = $state(false);
    let siteKey = $state("");
    let turnstile = $state("");
    let captcha = $state<Turnstile>();

    api("/site/settings").then(d => {
        closed = !d.registration_enabled;
        siteKey = d.turnstile_site_key ?? "";
    }).catch(() => {});

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        busy = true;
        try {
            const res = await api("/auth/register", {
                username,
                password,
                confirmpassword,
                invitekey,
                turnstile
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            error = err.message;
            captcha?.reset();
        } finally {
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>Sign Up - None.</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<AuthBackground />
<main class="none-auth-main">
    <div class="none-auth-container">
        <a href="/" class="none-auth-logo-link"><img src="/img/nonelogo.png" alt="None."></a>
        <div class="none-auth-panel">
            <h1>Sign Up</h1>
            {#if error}<div class="none-auth-error" role="alert">{error}</div>{/if}
            {#if closed}
                <div class="none-auth-error" role="alert">Registration is closed right now. <a href="/apply">Apply for an invite</a> instead.</div>
            {:else}
            <form onsubmit={submit}>
                    <div class="none-auth-field">
                        <label for="username">Username</label>
                        <input id="username" name="username" type="text" required autocomplete="username" bind:value={username} maxlength="20" placeholder="Username">
                    </div>
                    <div class="none-auth-field">
                        <label for="password">Password</label>
                        <input id="password" name="password" type="password" required autocomplete="new-password" bind:value={password} placeholder="Password">
                    </div>
                    <div class="none-auth-field">
                        <label for="confirm-password">Confirm Password</label>
                        <input id="confirm-password" name="password_confirmation" type="password" required autocomplete="new-password" bind:value={confirmpassword} placeholder="Confirm Password">
                    </div>
                    <div class="none-auth-field">
                        <label for="invite-key">Invite Key</label>
                        <input id="invite-key" name="invitekey" required autocomplete="off" bind:value={invitekey} placeholder="Invite Key">
                    </div>
                <Turnstile bind:this={captcha} {siteKey} bind:token={turnstile} />
                <button type="submit" class="none-auth-button" disabled={busy || (!!siteKey && !turnstile)}>{busy ? "Please wait…" : "Sign Up"}</button>
            </form>
            {/if}
            <p class="none-auth-note">Already have an account? <a href="/login">Log In</a></p>
            <p class="none-auth-note">No invite key? <a href="/apply">Apply for one</a></p>
        </div>
    </div>
</main>
