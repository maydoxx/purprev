<script lang="ts">
    import { api, apiForm } from "../../api";
    import { router } from "../../router.svelte";

    const createMode = $derived("create" in router.query);

    let mine = $state<any[]>([]);
    let all = $state<any[]>([]);
    let error = $state("");
    let busy = $state(false);

    let name = $state("");
    let description = $state("");
    let icon = $state<FileList | null>(null);

    const list = (d: any) => Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : [];

    api("/groups/my").then(d => {
        mine = list(d);
    }).catch(() => {});

    api("/groups?page=1").then(d => {
        all = list(d).slice(0, 12);
    }).catch(() => {});

    const create = async (e: Event) => {
        e.preventDefault();
        error = "";
        busy = true;

        const fd = new FormData();
        fd.append("name", name);
        fd.append("description", description);
        if (icon?.[0]) fd.append("icon", icon[0]);

        try {
            const d = await apiForm("/groups", fd);
            router.go(d.id ? `/groups?id=${d.id}` : "/my/groups");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };
</script>

<svelte:head>
    <title>{createMode ? "Create Group" : "Groups"} - NoneRev</title>
    <link rel="stylesheet" href="/css/groups.css">
</svelte:head>

{#snippet card(g: any, sub: string)}
    <a class="groups-list-card" href="/groups?id={g.id}">
        <img src={g.icon || "/img/pending.png"} alt="">
        <div class="groups-list-info">
            <h3>{g.name}</h3>
            <p>{(g.member_count ?? 0).toLocaleString()} Members</p>
            <span>{sub}</span>
        </div>
    </a>
{/snippet}

<main class="groups2016-page">
    <div class="groups2016-shell groups-list-shell">
        <div class="groups2016-page-heading">
            <h1>{createMode ? "Create Group" : "Groups"}</h1>
            {#if createMode}
                <a class="groups2016-btn secondary" href="/my/groups">Back to Groups</a>
            {:else}
                <a class="groups2016-btn secondary" href="/my/groups?create=1">Create Group</a>
            {/if}
        </div>

        {#if error}
            <div class="groups2016-alert error">{error}</div>
        {/if}

        {#if createMode}
            <section class="groups2016-card groups-create-card">
                <form class="groups-create-form" onsubmit={create}>
                    <div class="groups-create-row">
                        <label for="group-name">Name</label>
                        <div>
                            <input id="group-name" type="text" bind:value={name} maxlength="60" required>
                            <small>Choose a name for your group.</small>
                        </div>
                    </div>
                    <div class="groups-create-row">
                        <label for="group-description">Description</label>
                        <div>
                            <textarea id="group-description" bind:value={description} rows="6" maxlength="2000"></textarea>
                        </div>
                    </div>
                    <div class="groups-create-row">
                        <label for="group-icon">Emblem</label>
                        <div>
                            <input id="group-icon" type="file" bind:files={icon} accept="image/png,image/jpeg,image/webp">
                            <small>PNG, JPG or WEBP. Square images work best.</small>
                        </div>
                    </div>
                    <div class="groups-create-actions">
                        <button class="groups2016-btn primary" type="submit" disabled={busy}>Create Group</button>
                        <a class="groups2016-btn secondary" href="/my/groups">Cancel</a>
                    </div>
                </form>
            </section>
        {:else}
            <section class="groups-list-section">
                <h2>My Groups</h2>
                {#if mine.length === 0}
                    <div class="groups2016-card groups-empty">You haven't joined any groups yet.</div>
                {:else}
                    <div class="groups-list-grid">
                        {#each mine as g}
                            {@render card(g, g.role ?? "Member")}
                        {/each}
                    </div>
                {/if}
            </section>

            <section class="groups-list-section browse-groups">
                <h2>Discover Groups</h2>
                {#if all.length === 0}
                    <div class="groups2016-card groups-empty">There aren't any groups yet.</div>
                {:else}
                    <div class="groups-list-grid">
                        {#each all as g}
                            {@render card(g, `By ${g.owner_username || "NoneRev"}`)}
                        {/each}
                    </div>
                {/if}
            </section>
        {/if}
    </div>
</main>
