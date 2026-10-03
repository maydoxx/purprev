<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";

    const q = $derived((router.query.q ?? "").trim());
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let keyword = $state("");
    let results = $state<any[]>([]);
    let pages = $state(1);
    let loaded = $state(false);
    let error = $state("");

    const url = (p: number) => `/groups/search?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ""}`;

    const load = async () => {
        loaded = false;
        error = "";
        try {
            const d = await api(`/groups?q=${encodeURIComponent(q)}&page=${page}`);
            results = d.list ?? [];
            pages = Math.max(1, d.pages ?? 1);
        } catch (err: any) {
            error = err.message;
            results = [];
        }
        loaded = true;
    };

    $effect(() => {
        keyword = q;
    });

    $effect(() => {
        q;
        page;
        load();
    });

    const searchGroups = (e: Event) => {
        e.preventDefault();
        router.go(`/groups/search?q=${encodeURIComponent(keyword.trim())}`);
    };

    const searchUsers = () => {
        router.go(`/search?type=user&q=${encodeURIComponent(keyword.trim())}`);
    };

    const oneLine = (text: string) => (text ?? "").replace(/\s+/g, " ").trim();
</script>

<svelte:head>
    <title>Group Search - NoneRev</title>
    <link rel="stylesheet" href="/css/groups.css">
    <link rel="stylesheet" href="/css/groups-search.css">
</svelte:head>

<main class="group-page">
    <div class="group-container group-search-page">
        <div class="group-search-mid">
            <form class="group-search-bar" onsubmit={searchGroups}>
                <span class="group-search-label">Search:</span>
                <span class="group-search-fields">
                    <input type="text" class="group-search-box" bind:value={keyword} maxlength="100" aria-label="Search groups">
                    <input type="submit" class="group-button" value="Search Groups">
                    <input type="button" class="group-button" value="Search Users" onclick={searchUsers}>
                </span>
            </form>
            {#if error}
                <div class="group-search-error">{error}</div>
            {/if}
            <div class="group-search-results">
                <table class="group-search-table">
                    <thead>
                        <tr>
                            <th scope="col"></th>
                            <th scope="col">Group</th>
                            <th scope="col">Description</th>
                            <th scope="col">Members</th>
                            <th scope="col">Public</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#if loaded && results.length === 0}
                            <tr>
                                <td colspan="5" class="group-search-none">{q === "" ? "Enter a keyword to search for groups." : "No groups found."}</td>
                            </tr>
                        {/if}
                        {#each results as g (g.id)}
                            <tr>
                                <td>
                                    <a class="group-search-emblem" href="/groups?id={g.id}" title={g.name}>
                                        <img src={g.icon || "/img/pending.png"} alt={g.name} width="48" height="48">
                                    </a>
                                </td>
                                <td>
                                    <div class="group-search-name" title={g.name}>
                                        <a href="/groups?id={g.id}">{g.name}</a>
                                    </div>
                                </td>
                                <td>
                                    <div class="group-search-description" title={oneLine(g.description)}>{oneLine(g.description)}</div>
                                </td>
                                <td>{Number(g.member_count ?? 0).toLocaleString()}</td>
                                <td>
                                    {g.approval_required ? "No" : "Yes"}
                                    {#if g.bc_only}
                                        <br>
                                        <img src="/img/catalog/legend-bc.png" alt="Builders Club Only" class="group-search-bc">
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
                {#if pages > 1}
                    <div class="group-search-pages">
                        <div>Pages:</div>
                        {#if page > 1}
                            <a href={url(page - 1)}>&lt;&lt; Previous</a>
                        {/if}
                        {#if page > 1 && page < pages}
                            <span>|</span>
                        {/if}
                        {#if page < pages}
                            <a href={url(page + 1)}>Next &gt;&gt;</a>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
        <div class="group-side"></div>
    </div>
</main>
