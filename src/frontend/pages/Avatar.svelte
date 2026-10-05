<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import Avatar3D from "../Avatar3D.svelte";

    const me = session.me!;

    const parts: [string, string][] = [
        ["head_color", "Head"],
        ["torso_color", "Torso"],
        ["left_arm_color", "Left Arm"],
        ["right_arm_color", "Right Arm"],
        ["left_leg_color", "Left Leg"],
        ["right_leg_color", "Right Leg"]
    ];

    const categories: [string, string][] = [
        ["all", "All"],
        ["Hat", "Hats"],
        ["Face", "Faces"],
        ["T-Shirt", "T-Shirts"],
        ["Shirt", "Shirts"],
        ["Pants", "Pants"],
        ["Gear", "Gear"],
        ["Package", "Packages"]
    ];

    const wearable = ["Hat", "Face", "Shirt", "Pants", "T-Shirt", "Package"];
    const PER_PAGE = 8;

    let data = $state<any>(null);
    let threeD = $state(false);
    let outfits = $state<any[]>([]);
    let view = $state("wardrobe");
    let outfitName = $state("");
    let outfitBusy = $state(false);
    let part = $state<string | null>(null);
    let category = $state("all");
    let page = $state(1);
    let status = $state("");
    let statusError = $state(false);
    let avatarVersion = $state(0);
    let watch = 0;

    // renders take a few seconds
    const watchRender = async () => {
        const mine = ++watch;
        for (let i = 0; i < 40 && mine === watch; i++) {
            await new Promise(r => setTimeout(r, 3000));
            let job: any;
            try {
                job = await api("/user/avatar/render");
            } catch {
                continue;
            }
            if (mine !== watch) {
                return;
            }
            if (job.status === "done") {
                avatarVersion = Date.now();
                statusError = false;
                status = job.warnings.length ? `Your avatar has been re-drawn, but without a 3D view: ${job.warnings.join("; ")}` : "Your avatar has been re-drawn.";
                return;
            }
            if (job.status === "failed") {
                statusError = true;
                status = `Re-drawing failed: ${job.error}`;
                return;
            }
            if (job.status === "unknown" && i >= 3) {
                statusError = true;
                status = "The renderer did not answer, try again later.";
                return;
            }
        }
    };

    const load = async () => {
        data = await api("/user/avatar");
    };
    load();
    const loadOutfits = async () => {
        outfits = await api("/user/avatar/outfits");
    };
    loadOutfits();

    const saveOutfit = async (e: Event) => {
        e.preventDefault();
        outfitBusy = true;
        try {
            await api("/user/avatar/outfits", {
                name: outfitName.trim()
            });
            outfitName = "";
            await loadOutfits();
            statusError = false;
            status = "Outfit saved.";
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        outfitBusy = false;
    };

    const useOutfit = async (outfitId: number) => {
        outfitBusy = true;
        try {
            await api(`/user/avatar/outfits/${outfitId}/wear`, {});
            await load();
            statusError = false;
            status = "Outfit applied. Your avatar is being re-drawn.";
            watchRender();
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        outfitBusy = false;
    };

    const removeOutfit = async (outfitId: number) => {
        outfitBusy = true;
        try {
            await api(`/user/avatar/outfits/${outfitId}`, undefined, "DELETE");
            await loadOutfits();
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        outfitBusy = false;
    };

    const shown = $derived(data ? data.owned.filter((i: any) => category === "all" || i.category === category) : []);
    const pages = $derived(Math.max(1, Math.ceil(shown.length / PER_PAGE)));
    const pageItems = $derived(shown.slice((page - 1) * PER_PAGE, page * PER_PAGE));

    const hex = (n: number) => {
        const c = data.palette[n];
        return c ? "#" + [c[0], c[1], c[2]].map(v => v.toString(16).padStart(2, "0")).join("") : "#000";
    };
    const name = (n: number) => data.palette[n]?.[3] ?? "";

    const paint = async (n: number) => {
        if (!part) return;
        try {
            const res = await api("/user/avatar/colors", {
                [part]: n
            });
            data.colors = res.colors;
            statusError = false;
            status = "Saved. Your avatar is being re-drawn.";
            watchRender();
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
    };

    const setType = async (type: string) => {
        if (data.avatar_type === type) return;
        try {
            const res = await api("/user/avatar/type", {
                type
            });
            data.avatar_type = res.avatar_type;
            statusError = !res.ok;
            status = res.ok ? `Switched to ${type}. Your avatar is being re-drawn.` : "Saved, but the renderer could not be reached.";
            if (res.ok) {
                watchRender();
            }
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
    };

    const redraw = async (e: Event) => {
        e.preventDefault();
        try {
            const res = await api("/user/avatar/render", {});
            statusError = !res.ok;
            status = res.ok ? "Your avatar is being re-drawn, give it a minute." : "Could not reach the renderer, try again later.";
            if (res.ok) {
                watchRender();
            }
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
    };

    const wear = async (itemId: number, on: boolean) => {
        try {
            await api("/user/avatar/wear", {
                itemId,
                wear: on
            });
            await load();
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
    };

    const thumb = (item: any) => item.thumbnail || "/img/pending.png";
    const canWear = (item: any) => wearable.includes(item.category) && (item.asset_id || item.package_parts);
</script>

<svelte:head>
    <title>Avatar - NoneRev</title>
    <link rel="stylesheet" href="/css/avatar.css">
</svelte:head>

{#snippet tile(item: any, mode: "wardrobe" | "wearing")}
    <li class="item-tile">
        <span class="item-image">
            <a href="/catalog/item?id={item.id}"><img src={thumb(item)} alt={item.name}></a>
            {#if mode === "wearing"}
                <button type="button" class="item-badge wear-toggle" onclick={() => wear(item.id, false)}>Remove</button>
            {:else if canWear(item)}
                <button type="button" class="item-badge wear-toggle" class:wearing={item.wearing} disabled={!!item.wearing} onclick={() => wear(item.id, true)}>{item.wearing ? "Wearing" : "Wear"}</button>
            {/if}
        </span>
        <a class="item-name" href="/catalog/item?id={item.id}">{item.name}</a>
        {#if mode === "wardrobe" && !canWear(item)}
            <span class="item-note">Not wearable</span>
        {/if}
    </li>
{/snippet}

<main class="rbx-content">
{#if data}
    <div class="avatar-container">
        <div class="avatar-left">
            <div class="avatar-thumb">
                {#if threeD}
                    {#key avatarVersion}
                        <Avatar3D userId={me.id} />
                    {/key}
                {:else}
                    <img src="/api/user/getProfilePicture?userId={me.id}&type=full{avatarVersion ? `&v=${avatarVersion}` : ""}" alt={me.username}>
                {/if}
                <button type="button" class="avatar-3d-toggle" onclick={() => threeD = !threeD}>{threeD ? "2D" : "3D"}</button>
            </div>
            <div class="avatar-rig">
                <span>Body type</span>
                <div class="avatar-rig-switch">
                    <button type="button" class:active={data.avatar_type !== "R15"} onclick={() => setType("R6")}>R6</button>
                    <button type="button" class:active={data.avatar_type === "R15"} onclick={() => setType("R15")}>R15</button>
                </div>
            </div>
            <div class="avatar-redraw">
                Something wrong with your avatar?<br>
                <a href="#" onclick={redraw}>Click here to re-draw it!</a>
                <div class="avatar-status" class:error={statusError}>{status}</div>
            </div>

            <div class="avatar-colors">
                <h2>Colors</h2>
                <p>Click a body part to change its color:</p>
                <div class="body-figure">
                    {#each parts as [key, label]}
                        <button type="button" class="body-part" class:active={part === key} data-part={key}
                            title="{label}: {name(data.colors[key])}" style="background: {hex(data.colors[key])}"
                            onclick={() => part = part === key ? null : key}></button>
                    {/each}
                </div>
                <div class="color-picker" class:open={part !== null}>
                    <p class="picker-title">Pick a color for the <span>{parts.find(p => p[0] === part)?.[1] ?? "Head"}</span></p>
                    <div class="swatches">
                        {#each Object.entries(data.palette) as [n, c]}
                            <button type="button" title={c[3]} style="background: {hex(Number(n))}" onclick={() => paint(Number(n))}></button>
                        {/each}
                    </div>
                </div>
            </div>
        </div>

        <div class="avatar-right">
            <ul class="wardrobe-tabs">
                <li><button type="button" class:active={view === "wardrobe"} onclick={() => view = "wardrobe"}>Wardrobe</button></li>
                <li><button type="button" class:active={view === "outfits"} onclick={() => view = "outfits"}>Outfits</button></li>
            </ul>

            {#if view === "wardrobe"}
            <div class="wardrobe-categories">
                {#each categories as [key, label]}
                    <a href="#" class:active={category === key} onclick={e => { e.preventDefault(); category = key; page = 1; }}>{label}</a>
                {/each}
                <a href="/catalog">Shop</a>
            </div>

            {#if data.owned.length === 0}
                <div class="wardrobe-empty">You do not own any items yet. Visit the <a href="/catalog">catalog</a> to get some.</div>
            {:else}
                <ul class="item-tiles" id="wardrobe">
                    {#each pageItems as item}
                        {@render tile(item, "wardrobe")}
                    {/each}
                </ul>
                <div class="wardrobe-empty" hidden={pageItems.length > 0}>No items in this category.</div>
                <div class="wardrobe-pager">
                    {#if pages > 1}
                        <a href="#" class:disabled={page <= 1} onclick={e => { e.preventDefault(); if (page > 1) page--; }}>Previous</a>
                        {#each Array(pages) as _, i}
                            <a href="#" class:current={page === i + 1} onclick={e => { e.preventDefault(); page = i + 1; }}>{i + 1}</a>
                        {/each}
                        <a href="#" class:disabled={page >= pages} onclick={e => { e.preventDefault(); if (page < pages) page++; }}>Next</a>
                    {/if}
                </div>
            {/if}

            <div class="currently-wearing">
                <h2>Currently Wearing</h2>
                <ul class="item-tiles" id="wearing">
                    {#each data.wearing as item}
                        {@render tile(item, "wearing")}
                    {/each}
                </ul>
                <div class="wardrobe-empty" hidden={data.wearing.length > 0}>You aren't wearing anything yet.</div>
            </div>
            {:else}
                <section class="avatar-outfits">
                    <h2>My Outfits ({outfits.length})</h2>
                    <form class="avatar-outfit-create" onsubmit={saveOutfit}>
                        <input type="text" bind:value={outfitName} maxlength="60" placeholder="Outfit name" aria-label="Outfit name" required>
                        <button type="submit" disabled={outfitBusy}>Save Current Outfit</button>
                    </form>
                    {#if outfits.length === 0}
                        <p>You haven't saved any outfits yet.</p>
                    {/if}
                    <ul class="avatar-outfit-list">
                        {#each outfits as outfit (outfit.id)}
                            <li>
                                <strong>{outfit.name}</strong>
                                <button type="button" disabled={outfitBusy} onclick={() => useOutfit(outfit.id)}>Wear</button>
                                <button type="button" disabled={outfitBusy} onclick={() => removeOutfit(outfit.id)}>Delete</button>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}
        </div>
    </div>
{/if}
</main>
