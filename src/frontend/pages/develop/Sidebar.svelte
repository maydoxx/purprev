<script lang="ts">
    import { router } from "../../router.svelte";

    const links: [string, string][] = [
        ["/develop", "Overview"],
        ["/develop/places", "Places"],
        ["/develop/badges", "Badges"],
        ["/develop/game-passes", "Game Passes"],
        ["/develop/audio", "Audio"],
        ["/develop/shirts", "Shirts"],
        ["/develop/t-shirts", "T-Shirts"],
        ["/develop/pants", "Pants"],
        ["/my/sets", "Sets"]
    ];
</script>

<nav class="develop-nav">
    {#each links as [href, label]}
        <a class="develop-nav-link" class:active={href === router.path} {href}>{label}</a>
    {/each}
    <span class="develop-nav-off">
        Images
        <small>Coming Soon</small>
    </span>
    <div class="develop-studio">
        <div class="develop-studio-title">NoneRev Studio</div>
        <div class="develop-studio-body">
            <img src="/img/noneRevSmall.png" alt="">
            <div class="develop-studio-links">
                <a href="/download">Download</a>
            </div>
        </div>
    </div>
</nav>
