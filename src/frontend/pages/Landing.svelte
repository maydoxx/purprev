<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";

    let loginUsername = $state("");
    let loginPassword = $state("");

    let username = $state("");
    let password = $state("");
    let confirmpassword = $state("");
    let invitekey = $state("");
    let error = $state("");

    const login = async (e: Event) => {
        e.preventDefault();
        try {
            const res = await api("/auth/login", {
                username: loginUsername,
                password: loginPassword
            });
            session.set(res.user);
            router.go("/home");
        } catch (err: any) {
            alert(err.message);
        }
    };

    const signup = async (e: Event) => {
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
    <title>NoneRev</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<nav class="landing-nav">
    <div class="landing-nav-inner">
        <div class="landing-left">
            <a class="landing-brand" href="/"><img src="/img/noneRevSmall.png" alt="NoneRev"></a>
        </div>
        <form class="top-login" onsubmit={login}>
            <input type="text" bind:value={loginUsername} placeholder="Username" autocomplete="username">
            <input type="password" bind:value={loginPassword} placeholder="Password" autocomplete="current-password">
            <button type="submit">Log In</button>
        </form>
    </div>
</nav>

<section class="hero" id="play">
    <div class="hero-inner">
        <div class="hero-copy">
            <img class="hero-logo" src="/img/nonelogo.png" alt="NoneRev">
            <h1>A revival that goes for the win.</h1>
            <br>
            <video width="640" height="360" controls>
                <source src="https://cdn.mrrpmeowfurry.dev/uploads/2026-09-07%2022-07-03.mp4" type="video/mp4">
                Dude are you on internet explorer 6 or something because your browser can't load video tag.
                oh wait you probably are on ie 6, this is 2016 after all
            </video>
        </div>

        <div class="signup-panel">
            <h2>Sign up and start having fun!</h2>
            <div class="form-error" style:display={error ? "block" : "none"}>{error}</div>
            <form onsubmit={signup}>
                <div class="auth-field"><input bind:value={username} type="text" placeholder="Username" autocomplete="username" maxlength="32"></div>
                <div class="auth-field"><input bind:value={password} type="password" placeholder="Password" autocomplete="new-password"></div>
                <div class="auth-field"><input bind:value={confirmpassword} type="password" placeholder="Confirm Password" autocomplete="new-password"></div>
                <div class="auth-field"><input bind:value={invitekey} type="text" placeholder="Invite Key" autocomplete="off"></div>
                <button class="signup-button" type="submit">Sign Up</button>
            </form>
        </div>
    </div>
</section>
