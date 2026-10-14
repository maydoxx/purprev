<script lang="ts">
    import { api, apiForm } from "../../api";
    import { router } from "../../router.svelte";
    import Group from "./Group.svelte";

    const VISIBLE_ROWS = 8;

    const createMode = $derived("create" in router.query);

    let mine = $state<any[]>([]);
    let loaded = $state(false);
    let listTop = $state(0);
    let error = $state("");
    let busy = $state(false);

    let name = $state("");
    let description = $state("");
    let icon = $state<FileList | null>(null);
    let banner = $state<FileList | null>(null);

    const list = (d: any) => Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : [];

    const refresh = async () => {
        mine = list(await api("/groups/my").catch(() => []));
        loaded = true;
    };

    refresh();

    const gid = $derived(Math.max(0, Number(router.query.gid) || 0) || Number(mine[0]?.id ?? 0));

    const ordered = $derived([...mine].sort((a, b) => {
        if (Number(a.id) === gid || Number(b.id) === gid) {
            return Number(a.id) === gid ? -1 : 1;
        }
        return String(a.name).localeCompare(String(b.name));
    }));

    const lastTop = $derived(Math.max(0, ordered.length - VISIBLE_ROWS));

    $effect(() => {
        gid;
        listTop = 0;
    });

    const create = async (e: Event) => {
        e.preventDefault();
        error = "";
        busy = true;

        const fd = new FormData();
        fd.append("name", name);
        fd.append("description", description);
        if (icon?.[0]) fd.append("icon", icon[0]);
        if (banner?.[0]) fd.append("banner", banner[0]);

        try {
            const d = await apiForm("/groups", fd);
            router.go(d.id ? `/my/groups?gid=${d.id}` : "/my/groups");
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };
</script>

<svelte:head>
    <title>{createMode ? "Create A Group" : "Groups"} - NoneRev</title>
    <link rel="stylesheet" href="/css/groups.css">
</svelte:head>

{#snippet groupList()}
    <div class="group-list-column">
        <div class="group-list">
            <a class="group-create" href="/my/groups?create=1">Create</a>
            <div class="group-list-pager">
                <button type="button" class="group-list-arrow up" aria-label="Scroll up" disabled={listTop <= 0} onclick={() => listTop -= 1}></button>
            </div>
            <div class="group-list-items">
                <div class="group-list-track" style:transform="translateY({listTop * -66}px)">
                    {#each ordered as g (g.id)}
                        <a class="group-list-item" class:selected={Number(g.id) === gid} href="/my/groups?gid={g.id}" title={g.name}>
                            <span class="group-list-emblem">
                                <img src={g.icon || "/img/pending.png"} alt="" width="42" height="42">
                            </span>
                            <span class="group-list-name">{g.name}</span>
                        </a>
                    {/each}
                </div>
            </div>
            <div class="group-list-pager">
                <button type="button" class="group-list-arrow down" aria-label="Scroll down" disabled={listTop >= lastTop} onclick={() => listTop += 1}></button>
            </div>
        </div>
    </div>
{/snippet}

{#if createMode}
    <main class="group-page">
        <div class="group-container group-create-page">
            <form class="group-create-form" onsubmit={create}>
                <h2>Create A Group</h2>
                {#if error}
                    <div class="group-alert error">{error}</div>
                {/if}
                <label for="group-name">Name:</label>
                <input id="group-name" type="text" bind:value={name} maxlength="60" required>
                <label for="group-description">Description:</label>
                <textarea id="group-description" bind:value={description} maxlength="2000"></textarea>
                <label for="group-icon">Emblem:</label>
                <input id="group-icon" type="file" bind:files={icon} accept="image/png,image/jpeg,image/webp">
                <p>PNG, JPG or WEBP. Square images work best.</p>
                <label for="group-banner">Banner:</label>
                <input id="group-banner" type="file" bind:files={banner} accept="image/png,image/jpeg,image/webp">
                <p>PNG, JPG or WEBP, up to 4 MB. Wide images work best.</p>
                <div class="group-create-buttons">
                    <input type="submit" class="group-button" value="Create Group" disabled={busy}>
                    <a class="group-button" href="/my/groups">Cancel</a>
                </div>
            </form>
        </div>
    </main>
{:else if loaded}
    <Group my gid={gid} side={groupList} onchange={refresh} />
{/if}
