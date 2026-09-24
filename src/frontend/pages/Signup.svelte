<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let username = $state("");
    let password = $state("");
    let confirmpassword = $state("");
    let invitekey = $state("");
    let error = $state("");

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        try {
            const res = await api("/auth/register", {
                username,
                password,
                confirmpassword,
                invitekey
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            error = err.message;
        }
    };
</script>

<svelte:head>
    <title>NoneRev - Sign Up</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<a class="auth-top-link" href="/">&larr; Back</a>
<div class="auth-only">
    <div class="auth-panel">
        <div class="hero-logo"><img src="/img/nonelogo.png" alt="NoneRev"></div>
        <h2>Sign up and start having fun!</h2>
        <div class="form-error" style:display={error ? "block" : "none"}>{error}</div>
        <form onsubmit={submit}>
            <div class="auth-field"><input bind:value={username} type="text" placeholder="Username" autocomplete="username" maxlength="32"></div>
            <div class="auth-field"><input bind:value={password} type="password" placeholder="Password" autocomplete="new-password"></div>
            <div class="auth-field"><input bind:value={confirmpassword} type="password" placeholder="Confirm Password" autocomplete="new-password"></div>
            <div class="auth-field"><input bind:value={invitekey} type="text" placeholder="Invite Key" autocomplete="off"></div>
            <button class="signup-button" type="submit">Sign Up</button>
        </form>
        <p class="auth-note">Already have an account? <a href="/login">Log in</a></p>
    </div>
</div>
