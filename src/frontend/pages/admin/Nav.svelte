<script lang="ts">
    import { router } from "../../router.svelte";

    const links: [string, string, string, string[]][] = [
        ["/admi/", "Dashboard", "speedometer2", ["/admi"]],
        ["/admi/users", "Users", "people", ["/admi/users"]],
        ["/admi/catalog", "Catalog", "bag", ["/admi/catalog"]],
        ["/admi/moderation", "Moderation", "shield-exclamation", ["/admi/moderation", "/admi/viewmoderation"]],
        ["/admi/invitekeys", "Invite Keys", "key", ["/admi/invitekeys"]],
        ["/admi/banners", "Banners", "megaphone", ["/admi/banners"]]
    ];
</script>

<nav class="navbar navbar-expand-lg navbar-dark admin-subnav" aria-label="Admin navigation">
    <div class="container-fluid px-3 px-lg-4">
        <a class="navbar-brand" href="/admi/"><i class="bi bi-tools me-2"></i>Administration</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbar" aria-controls="adminNavbar" aria-expanded="false" aria-label="Toggle admin navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="adminNavbar">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                {#each links as [href, label, icon, match]}
                    <li class="nav-item">
                        <a class="nav-link" class:active={match.includes(router.path)} href={href}>
                            <i class="bi bi-{icon} me-1"></i>{label}
                        </a>
                    </li>
                {/each}
            </ul>
            <span class="navbar-text small">Admin only</span>
        </div>
    </div>
</nav>
