<script lang="ts">
    import { router } from "../../router.svelte";

    const links: [string, string][] = [
        ["/develop/places", "Places"],
        ["/develop/badges", "Badges"],
        ["/develop/game-passes", "Game Passes"],
        ["/develop/audio", "Audio"],
        ["/my/user-ads", "User Ads"],
        ["/develop/shirts", "Shirts"],
        ["/develop/t-shirts", "T-Shirts"],
        ["/develop/pants", "Pants"],
        ["/my/sets", "Sets"]
    ];

    const active = (href: string) => href === router.path || (href === "/develop/places" && router.path === "/develop");
</script>

<nav class="develop-nav">
    {#each links as [href, label]}
        <a class="develop-nav-link" class:active={active(href)} {href}>{label}</a>
    {/each}
    <div class="develop-widget">
        <div class="develop-widget-name">NoneRev Studio</div>
        <div class="develop-widget-body">
            <img src="/img/noneRevSmall.png" alt="">
            <ul>
                <li><a href="/download">Download</a></li>
                <li><a href="/blog">Visit Blog</a></li>
            </ul>
        </div>
    </div>
    <div class="develop-widget">
        <div class="develop-widget-name">Creator Community</div>
        <div class="develop-widget-body">
            <img src="/img/develop/community.svg" alt="">
            <ul>
                <li><a href="/forum">Visit Forum</a></li>
            </ul>
        </div>
    </div>
</nav>
