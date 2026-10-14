<script lang="ts">
    import Header from "../Header.svelte";
    import Banners from "../Banners.svelte";
    import Footer from "../Footer.svelte";
    import { api } from "../api";
    import { router } from "../router.svelte";

    const token = $derived(router.query.token ?? "");
    let valid = $state(false);
    let password = $state("");
    let confirmPassword = $state("");
    let error = $state("");
    let done = $state(false);
    let busy = $state(false);

    $effect(() => {
        valid = false;
        done = false;
        error = "";
        if (!token) {
            error = "Reset link is missing.";
            return;
        }
        api(`/auth/password-reset?token=${encodeURIComponent(token)}`).then(() => valid = true).catch((err: any) => error = err.message);
    });

    const submit = async (event: Event) => {
        event.preventDefault();
        error = "";
        busy = true;
        try {
            await api("/auth/password-reset", { token, password, confirmPassword });
            done = true;
            password = "";
            confirmPassword = "";
        } catch (err: any) {
            error = err.message;
        } finally {
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>Reset Password - None.</title>
    <meta name="referrer" content="no-referrer">
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<div class="login-page">
    <Header />
    <Banners />
    <div class="login-body">
        <h1>Reset your password</h1>
        <div class="login-panel">
            {#if error}<div class="login-error" role="alert">{error}</div>{/if}
            {#if done}
                <p>Your password has been changed. You can now <a href="/login">sign in</a>.</p>
            {:else if valid}
                <form class="login-area" onsubmit={submit}>
                    <div class="login-left">
                        <table class="login-table"><tbody>
                            <tr><td><label for="new-password">New password:</label></td><td><input id="new-password" type="password" required minlength="8" maxlength="200" autocomplete="new-password" bind:value={password}></td></tr>
                            <tr><td><label for="confirm-password">Confirm:</label></td><td><input id="confirm-password" type="password" required minlength="8" maxlength="200" autocomplete="new-password" bind:value={confirmPassword}></td></tr>
                        </tbody></table>
                        <div class="login-actions"><button type="submit" class="login-button" disabled={busy}>Change Password</button></div>
                    </div>
                </form>
            {:else if !error}
                <p>Checking reset link…</p>
            {/if}
        </div>
    </div>
    <Footer />
</div>
