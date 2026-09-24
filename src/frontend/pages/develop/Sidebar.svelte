<script lang="ts">
    import { router } from "../../router.svelte";

    const groups: [string, [string, string][]][] = [
        ["My Creations", [
            ["/develop", "Overview"],
            ["/develop/places", "Places"],
            ["/develop/audio", "Audio"]
        ]],
        ["Clothing", [
            ["/develop/shirts", "Shirts"],
            ["/develop/t-shirts", "T-Shirts"],
            ["/develop/pants", "Pants"]
        ]],
        ["More", [
            ["/develop/game-passes", "Game Passes"],
            ["/develop/badges", "Badges"]
        ]]
    ];

    const active = $derived(["/develop/create", "/develop/configure"].includes(router.path) ? "/develop/places" : router.path);
</script>

<aside class="develop-sidebar-2016">
    {#each groups as [heading, links], i}
        <div class="develop-sidebar-title" class:develop-sidebar-secondary={i > 0}>{heading}</div>
        <nav>
            {#each links as [href, label]}
                <a {href} class:active={href === active}>{label}</a>
            {/each}
        </nav>
    {/each}
    <div class="develop-sidebar-disabled">Images <span>Coming Soon</span></div>
</aside>
