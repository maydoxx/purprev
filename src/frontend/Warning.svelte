<script module lang="ts">
    const seen = () => {
        try {
            return localStorage.getItem("nonerev-warned") === "1";
        } catch {
            return false;
        }
    };

    export const warning = $state({
        seen: seen()
    });
</script>

<script lang="ts">
    import { router } from "./router.svelte";

    const go = () => {
        try {
            localStorage.setItem("nonerev-warned", "1");
        } catch {}
        warning.seen = true;
        if (router.name === "about") {
            router.go("/");
        } else {
            window.scrollTo(0, 0);
        }
    };
</script>

<svelte:head>
    <title>Before you go in - NoneRev</title>
    <link rel="stylesheet" href="/css/warning.css">
</svelte:head>

<div class="warning-page">
    <main class="warning-card">
        <div class="warning-brand"><img src="/img/nonelogo.png" width="2739" height="793" alt="NoneRev"></div>
        <h1 class="warning-title">Before you go in</h1>
        <p class="warning-lead">NoneRev is an independent, fan-made revival. It is <strong>not affiliated with or endorsed by Roblox Corporation</strong>.</p>
        <ol class="warning-points">
            <li><strong>Your NoneRev account is separate</strong>Never type your Roblox password or paste your Roblox account cookie on this site. Pick a password here that you use nowhere else.</li>
            <li><strong>Staff never ask for passwords</strong>Not on Discord, not in messages, not anywhere. Anyone who asks for yours is not staff.</li>
            <li><strong>Check the address bar</strong>It should show <span class="warning-address">nonerev.de</span>. If it shows anything else, close this tab.</li>
        </ol>
        <button type="button" class="warning-button" onclick={go}>Continue</button>
        <a class="warning-quiet" href="about:blank">Leave this site</a>
        <p class="warning-card-foot">You only see this once on this browser.</p>
    </main>
    <footer class="warning-foot">
        <a href="/info/tos">Terms</a>
        <a href="/info/privacy">Privacy</a>
    </footer>
</div>
