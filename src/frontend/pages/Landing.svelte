<script lang="ts">
    import AuthBackground from "../AuthBackground.svelte";
</script>

<svelte:head>
    <title>None.</title>
    <link rel="stylesheet" href="/css/landing-2016.css">
</svelte:head>

<AuthBackground landing />
<main class="none-auth-main">
    <div class="none-landing-content">
        <img class="none-landing-logo" src="/img/nonelogo.png" alt="None.">
        <p>A Revival that goes for the win.</p>
        <div class="none-landing-actions">
            <a class="none-auth-button none-login-button" href="/login">Log In</a>
            <a class="none-auth-button" href="/register">Sign Up</a>
        </div>
    </div>
</main>
