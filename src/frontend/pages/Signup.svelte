<script lang="ts">
    import AuthBackground from "../AuthBackground.svelte";
    import Turnstile from "../Turnstile.svelte";
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let { landing = false }: { landing?: boolean } = $props();

    let username = $state("");
    let password = $state("");
    let confirmpassword = $state("");
    let invitekey = $state("");
    let errors = $state<Record<string, string>>({});
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

    const fieldOf = (message: string) => {
        if (/invite/i.test(message)) return "invitekey";
        if (/match/i.test(message)) return "confirmpassword";
        if (/password/i.test(message)) return "password";
        if (/username/i.test(message)) return "username";
        return "";
    };

    const submit = async (e: Event) => {
        e.preventDefault();
        errors = {};
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
            const field = fieldOf(err.message);
            if (field) {
                errors = {
                    [field]: err.message
                };
            } else {
                error = err.message;
            }
            captcha?.reset();
        } finally {
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>{landing ? "None." : "Sign Up - None."}</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<AuthBackground>
    <div class="auth-panel">
        <h3>Sign up and start having fun!</h3>
        <div class="auth-panel-body">
            {#if closed}
                <div class="auth-alert" role="alert">Registration is closed right now. <a href="/apply">Apply for an invite</a> instead.</div>
            {:else}
                <form onsubmit={submit}>
                    <input class="auth-input" class:auth-input-error={errors.username} name="username" type="text" required autocomplete="username" maxlength="20" aria-label="Username" placeholder="Username (length 3-20, letters and numbers)" bind:value={username}>
                    <p class="auth-input-message">{errors.username ?? ""}</p>
                    <input class="auth-input" class:auth-input-error={errors.password} name="password" type="password" required autocomplete="new-password" aria-label="Password" placeholder="Password (minimum length 8)" bind:value={password}>
                    <p class="auth-input-message">{errors.password ?? ""}</p>
                    <input class="auth-input" class:auth-input-error={errors.confirmpassword} name="password_confirmation" type="password" required autocomplete="new-password" aria-label="Confirm Password" placeholder="Confirm Password" bind:value={confirmpassword}>
                    <p class="auth-input-message">{errors.confirmpassword ?? ""}</p>
                    <input class="auth-input" class:auth-input-error={errors.invitekey} name="invitekey" required autocomplete="off" aria-label="Invite Key" placeholder="Invite Key" bind:value={invitekey}>
                    <p class="auth-input-message">{errors.invitekey ?? ""}</p>
                    <p class="auth-legal">By signing up you agree to our <a href="/info/tos" target="_blank">Terms</a> and <a href="/info/privacy" target="_blank">Privacy Policy</a></p>
                    <Turnstile bind:this={captcha} {siteKey} bind:token={turnstile} />
                    <button type="submit" class="auth-button" disabled={busy || (!!siteKey && !turnstile)}>Sign Up</button>
                    {#if error}
                        <div class="auth-alert" role="alert">{error}</div>
                    {/if}
                </form>
            {/if}
            <p class="auth-note">No invite key? <a href="/apply">Apply for one</a></p>
        </div>
    </div>
</AuthBackground>
