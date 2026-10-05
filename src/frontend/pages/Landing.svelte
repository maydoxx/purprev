<script lang="ts">
    import { onMount } from "svelte";
    import Signup from "./Signup.svelte";

    onMount(() => {
        const el = location.hash && document.getElementById(location.hash.slice(1));
        if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
    });
</script>

<Signup landing />
<section class="landing-about" id="about">
    <div class="landing-about-top">
        <div class="landing-about-text">
            <h1>WHAT IS NONEREV?</h1>
            <p>NoneRev is a revival that brings back the games and the site you remember. Play games made by the community, build your own places in Studio, dress up your avatar with hats, gear and clothing from the catalog, trade with other players and hang out with your friends in groups and on the forums. It is free, made by fans, and invite only, so everyone here really wants to be here.</p>
        </div>
    </div>
    <div class="landing-about-games">
        <div class="landing-game-1"></div>
        <div class="landing-game-2"></div>
        <div class="landing-game-3"></div>
    </div>
</section>
<section class="landing-devices" id="platforms">
    <div class="landing-devices-text">
        <h2>NONEREV ON YOUR DEVICE</h2>
        <p>You can play NoneRev on Windows, Linux and Android. Download the launcher for your device, log in, and jump into any game with your friends, wherever you are.</p>
    </div>
    <picture>
        <source media="(max-width: 1199px)" srcset="/img/landing/devices-sm.png" width="566" height="403">
        <img class="landing-devices-image" src="/img/landing/devices.png" width="1621" height="587" alt="">
    </picture>
    <ul class="landing-stores">
        <li>
            <a class="landing-store" href="/api/setup/download" title="Download for Windows">
                <img src="/img/download/windows-white.png" alt="">
                <span>Download for</span>
                Windows
            </a>
        </li>
        <li>
            <a class="landing-store" href="/api/setup/download?os=android" title="Download for Android">
                <img src="/img/download/android-white.png" alt="">
                <span>Download for</span>
                Android
            </a>
        </li>
        <li>
            <a class="landing-store" href="/api/setup/download?os=linux" title="Download for Linux">
                <img src="/img/download/linux-white.png" alt="">
                <span>Download for</span>
                Linux
            </a>
        </li>
    </ul>
</section>
