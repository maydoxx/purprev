<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let username = $state("");
    let password = $state("");
    let error = $state("");

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        try {
            const res = await api("/auth/login", {
                username,
                password
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            error = err.message;
        }
    };
</script>

<svelte:head>
    <title>NoneRev - Log In</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<a class="auth-top-link" href="/">&larr; Back</a>
<div class="auth-only">
    <div class="auth-panel">
        <div class="hero-logo"><img src="/img/nonelogo.png" alt="NoneRev"></div>
        <h2>Log in and start having fun!</h2>
        <div class="form-error" style:display={error ? "block" : "none"}>{error}</div>
        <form onsubmit={submit}>
            <div class="auth-field"><input type="text" bind:value={username} placeholder="Username" autocomplete="username"></div>
            <div class="auth-field"><input type="password" bind:value={password} placeholder="Password" autocomplete="current-password"></div>
            <button class="signup-button" type="submit">Log In</button>
        </form>
        <p class="auth-note">Need an account? <a href="/signup">Sign up</a></p>
    </div>
</div>
