<script lang="ts">
    const links = [
        ["Blog", "/blog"],
        ["Forum", "/forum"],
        ["Download", "/download"],
        ["Discord", "/discord"],
        ["Apply", "/apply"],
        ["Terms", "/info/tos"],
        ["Privacy", "/info/privacy"]
    ];
</script>

<footer class="site-footer">
    <div class="site-footer-inner">
        <ul class="site-footer-links">
            {#each links as [label, href]}
                <li>
                    <a href={href}>{label}</a>
                </li>
            {/each}
        </ul>
        <p class="site-footer-note">
            NoneRev is a fan project and is not affiliated with, sponsored by or endorsed by ROBLOX Corporation.
            ROBLOX, its characters, logos, names and all related indicia are trademarks of ROBLOX Corporation.
            Use of this site signifies your acceptance of the <a href="/info/tos">Terms and Conditions</a>.
        </p>
    </div>
</footer>
