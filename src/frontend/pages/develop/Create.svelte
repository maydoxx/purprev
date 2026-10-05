<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { postForm } from "./develop";
    import { checkPlaceFile, uploadPlace, placeLimitLabel } from "./upload";

    const tabs: [string, string][] = [
        ["basic", "Basic Settings"],
        ["access", "Access"],
        ["advanced", "Advanced Settings"]
    ];

    const ACCESS: [string, string][] = [
        ["everyone", "Everyone"],
        ["friends", "Friends"],
        ["private", "Private"]
    ];

    let tab = $state("basic");
    let settings = $state<any>(null);
    let title = $state("");
    let description = $state("");
    let genre = $state("All");
    let maxPlayers = $state(10);
    let access = $state("everyone");
    let copylocked = $state(true);
    let allowedGear = $state<string[]>([]);
    let files = $state<FileList | null>(null);
    let error = $state("");
    let busy = $state("");
    let createdId = $state(0);

    const genres = $derived<string[]>(settings?.genres ?? ["All"]);
    const gear = $derived<any[]>(settings?.gear ?? []);
    const playerLimit = $derived(Number(settings?.max_players) || 10);

    api("/develop/places/0/settings").then(d => settings = d).catch(() => {});

    const toggleGear = (key: string) => {
        allowedGear = allowedGear.includes(key) ? allowedGear.filter(k => k !== key) : [...allowedGear, key];
    };

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";

        if (!title.trim()) {
            tab = "basic";
            error = "Your place needs a name.";
            return;
        }

        const file = files?.[0] ?? null;
        if (file) {
            error = checkPlaceFile(file);
            if (error) {
                tab = "basic";
                return;
            }
        }

        let step = "";
        busy = "Creating...";
        try {
            const form = new FormData();
            form.append("title", title);
            const d = await postForm("/develop/places", form);
            const id = Number(d.id ?? d.placeId);
            if (!id) {
                throw new Error("Could not create the place.");
            }
            createdId = id;

            step = "settings";
            await api(`/develop/places/${id}`, {
                title,
                description,
                genre,
                max_players: maxPlayers,
                allowed_gear: allowedGear,
                copylocked,
                access
            }, "PATCH");

            let status = "created";
            if (file) {
                step = "upload";
                await uploadPlace(id, file, p => busy = `Uploading ${p}%`);
                status = "uploaded";
            }
            router.go(`/develop/configure?id=${id}&status=${status}`);
        } catch (err: any) {
            if (step === "settings") {
                error = `The place was created (ID ${createdId}), but its settings could not be saved: ${err.message} You can change them from Configure.`;
            } else if (step === "upload") {
                error = `The place was created (ID ${createdId}), but the .rbxl upload failed: ${err.message} You can retry from Configure.`;
            } else {
                error = err.message;
            }
            busy = "";
        }
    };
</script>

<svelte:head>
    <title>Create Place - NoneRev</title>
    <link rel="stylesheet" href="/css/develop.css">
</svelte:head>

<main class="develop-page">
    <form class="develop-container" onsubmit={submit}>
        <h1 class="develop-title">Create Place</h1>
        <div class="develop-tabs">
            {#each tabs as [key, name]}
                <button class="develop-tab" class:active={tab === key} type="button" onclick={() => tab = key}>{name}</button>
            {/each}
        </div>
        <div class="develop-sheet">
            <div class="develop-form">
                {#if error}
                    <div class="develop-error">{error}</div>
                {/if}
                <div hidden={tab !== "basic"}>
                    <h2 class="develop-heading">Basic Settings</h2>
                    <label class="develop-label" for="title">Name:</label>
                    <input id="title" class="develop-text" name="title" type="text" maxlength="100" bind:value={title}>
                    <label class="develop-label" for="description">Description:</label>
                    <textarea id="description" class="develop-text" name="description" maxlength="2000" bind:value={description}></textarea>
                    <label class="develop-label" for="genre">Genre:</label>
                    <select id="genre" class="develop-select" bind:value={genre}>
                        {#each genres as g}
                            <option value={g}>{g}</option>
                        {/each}
                    </select>
                    <label class="develop-label" for="place_file">Place File:</label>
                    <input id="place_file" class="develop-file" name="place_file" type="file" accept=".rbxl" bind:files>
                    <span class="develop-help">.rbxl only, up to {placeLimitLabel()}. Large files are uploaded in small chunks.</span>
                </div>
                <div hidden={tab !== "access"}>
                    <h2 class="develop-heading">Access</h2>
                    <label class="develop-label" for="max_players">Maximum Player Count:</label>
                    <select id="max_players" class="develop-select" bind:value={maxPlayers}>
                        {#each Array.from({ length: Math.max(playerLimit, maxPlayers) }, (_, i) => i + 1) as n}
                            <option value={n}>{n}</option>
                        {/each}
                    </select>
                    <label class="develop-label" for="access">Who Can Play:</label>
                    <select id="access" class="develop-select" bind:value={access}>
                        {#each ACCESS as [key, name]}
                            <option value={key}>{name}</option>
                        {/each}
                    </select>
                </div>
                <div hidden={tab !== "advanced"}>
                    <h2 class="develop-heading">Advanced Settings</h2>
                    <span class="develop-label">Gear types:</span>
                    <ul class="develop-gear-list">
                        {#each gear as g (g.key)}
                            <li>
                                <label>
                                    <input type="checkbox" checked={allowedGear.includes(g.key)} onchange={() => toggleGear(g.key)}>
                                    {g.name}
                                </label>
                            </li>
                        {/each}
                    </ul>
                    <div class="develop-rule"></div>
                    <label class="develop-check">
                        <input type="checkbox" bind:checked={copylocked}>
                        Copy Locked
                    </label>
                </div>
            </div>
            <div class="develop-buttons develop-form-buttons">
                <button class="develop-btn" type="submit" disabled={!!busy}>{busy || "Create Place"}</button>
                <a class="develop-btn develop-btn-negative" href="/develop/places">Cancel</a>
                {#if createdId}
                    <a class="develop-control" href="/develop/configure?id={createdId}">Open Configure</a>
                {/if}
            </div>
        </div>
    </form>
</main>
