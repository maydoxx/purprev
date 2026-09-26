<script lang="ts">
    import AuthBackground from "../AuthBackground.svelte";
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let username = $state("");
    let password = $state("");
    let error = $state("");
    let busy = $state(false);

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        busy = true;
        try {
            const res = await api("/auth/login", {
                username,
                password
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            error = err.message;
        } finally {
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>Log In - None.</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<AuthBackground />
<main class="none-auth-main">
    <div class="none-auth-container">
        <a href="/" class="none-auth-logo-link"><img src="/img/nonelogo.png" alt="None."></a>
        <div class="none-auth-panel">
            <h1>Log In</h1>
            {#if error}<div class="none-auth-error" role="alert">{error}</div>{/if}
            <form onsubmit={submit}>
                    <div class="none-auth-field">
                        <label for="username">Username</label>
                        <input id="username" name="username" type="text" required autocomplete="username" bind:value={username} maxlength="20" placeholder="Username">
                    </div>
                    <div class="none-auth-field">
                        <label for="password">Password</label>
                        <input id="password" name="password" type="password" required autocomplete="current-password" bind:value={password} placeholder="Password">
                    </div>
                <button type="submit" class="none-auth-button" disabled={busy}>{busy ? "Please wait…" : "Log In"}</button>
            </form>
            <p class="none-auth-note">Don't have an account? <a href="/register">Sign Up</a></p>
        </div>
    </div>
</main>
