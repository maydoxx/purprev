<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { shortDate } from "../catalog";
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

    const categoryRows: [string, string][][] = [
        [
            ["Face", "Faces"],
            ["Hat", "Hats"],
            ["T-Shirt", "T-Shirts"],
            ["Shirt", "Shirts"],
            ["Pants", "Pants"],
            ["Gear", "Gear"]
        ],
        [
            ["Head", "Heads"],
            ["Torso", "Torsos"],
            ["LeftArm", "Left Arms"],
            ["RightArm", "Right Arms"],
            ["LeftLeg", "Left Legs"],
            ["RightLeg", "Right Legs"]
        ],
        [
            ["Package", "Packages"]
        ]
    ];

    const createLinks: Record<string, string> = {
        "T-Shirt": "/develop/t-shirts",
        Shirt: "/develop/shirts",
        Pants: "/develop/pants"
    };

    const swatches = [
        45, 42, 232, 102, 23, 195, 196, 140,
        118, 116, 151, 200, 135, 211, 43, 107,
        6, 29, 119, 37, 210, 48, 28, 141,
        3, 226, 115, 24, 191, 190, 121, 105,
        100, 125, 101, 154, 221, 124, 41, 21,
        9, 220, 126, 153, 218, 198, 268, 104,
        5, 36, 18, 106, 38, 216, 217, 192,
        50, 1, 208, 103, 194, 199, 26, 149
    ];

    const modalText = {
        create: ["Create New Outfit", "An outfit will be created from your avatar's current appearance.", "Create"],
        rename: ["Rename Outfit", "Choose a new name for this outfit.", "Rename"],
        update: ["Update Outfit", "This outfit will be updated to your avatar's current appearance.", "Update"]
    };

    const wearable = ["Hat", "Face", "Shirt", "Pants", "T-Shirt", "Package", "Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"];
    const itemCategoryName: Record<string, string> = {
        LeftArm: "Left Arm",
        RightArm: "Right Arm",
        LeftLeg: "Left Leg",
        RightLeg: "Right Leg"
    };
    const PER_PAGE = 8;

    let data = $state<any>(null);
    let threeD = $state(false);
    let outfits = $state<any[]>([]);
    let view = $state("wardrobe");
    let outfitName = $state("");
    let outfitBusy = $state(false);
    let modal = $state<keyof typeof modalText | null>(null);
    let target = $state<any>(null);
    let outfitMenu = $state<number | null>(null);
    let outfitPage = $state(1);
    let part = $state<string | null>(null);
    let category = $state("Hat");
    let page = $state(1);
    let wearPage = $state(1);
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

    const watchOutfit = async (outfitId: number, old = "") => {
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                await loadOutfits();
            } catch {
                continue;
            }
            const outfit = outfits.find(o => o.id === outfitId);
            if (!outfit || (outfit.thumbnail && outfit.thumbnail !== old)) {
                return;
            }
        }
    };

    const openModal = (kind: keyof typeof modalText, outfit: any = null) => {
        outfitMenu = null;
        target = outfit;
        outfitName = kind === "rename" ? outfit.name : "";
        modal = kind;
    };

    const saveOutfit = async (e: Event) => {
        e.preventDefault();
        outfitBusy = true;
        try {
            if (modal === "rename") {
                await api(`/user/avatar/outfits/${target.id}/rename`, {
                    name: outfitName.trim()
                });
                status = "Outfit renamed.";
            } else if (modal === "update") {
                await api(`/user/avatar/outfits/${target.id}/update`, {});
                status = "Outfit updated.";
                watchOutfit(target.id, target.thumbnail);
            } else {
                const res = await api("/user/avatar/outfits", {
                    name: outfitName.trim()
                });
                outfitPage = 1;
                status = "Outfit saved.";
                watchOutfit(res.id);
            }
            statusError = false;
            outfitName = "";
            modal = null;
            await loadOutfits();
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        outfitBusy = false;
    };

    const useOutfit = async (outfitId: number) => {
        outfitMenu = null;
        if (outfitBusy) return;
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
        outfitMenu = null;
        if (outfitBusy) return;
        outfitBusy = true;
        try {
            await api(`/user/avatar/outfits/${outfitId}`, undefined, "DELETE");
            await loadOutfits();
            outfitPage = Math.min(outfitPage, outfitPages);
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
        outfitBusy = false;
    };

    const shown = $derived(data ? data.owned.filter((i: any) => i.category === category) : []);
    const pages = $derived(Math.ceil(shown.length / PER_PAGE));
    const pageItems = $derived(shown.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    const wearPages = $derived(data ? Math.ceil(data.wearing.length / PER_PAGE) : 0);
    const wearItems = $derived(data ? data.wearing.slice((wearPage - 1) * PER_PAGE, wearPage * PER_PAGE) : []);
    const outfitPages = $derived(Math.max(1, Math.ceil(outfits.length / PER_PAGE)));
    const outfitItems = $derived(outfits.slice((outfitPage - 1) * PER_PAGE, outfitPage * PER_PAGE));
    const rig = $derived(data?.avatar_type === "R15" ? "R15" : "R6");

    const hex = (n: number) => {
        const c = data.palette[n];
        return c ? "#" + [c[0], c[1], c[2]].map(v => v.toString(16).padStart(2, "0")).join("") : "#000";
    };
    const name = (n: number) => data.palette[n]?.[3] ?? "";

    const paint = async (n: number) => {
        if (!part) return;
        const key = part;
        part = null;
        try {
            const res = await api("/user/avatar/colors", {
                [key]: n
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
            wearPage = Math.min(wearPage, Math.max(1, wearPages));
            watchRender();
        } catch (err: any) {
            statusError = true;
            status = err.message;
        }
    };

    const pickCategory = (e: Event, key: string) => {
        e.preventDefault();
        category = key;
        page = 1;
    };

    const go = (e: Event, set: (p: number) => void, to: number, total: number) => {
        e.preventDefault();
        if (to >= 1 && to <= total) {
            set(to);
        }
    };

    const pagerLinks = (current: number, total: number) => {
        const start = Math.floor((current - 1) / 5) * 5 + 1;
        const end = Math.min(start + 4, total);
        const links: [string, number][] = [["First", 1], ["Previous", current - 1]];
        if (start > 1) {
            links.push(["...", start - 1]);
        }
        for (let p = start; p <= end; p++) {
            links.push([String(p), p]);
        }
        if (end < total) {
            links.push(["...", end + 1]);
        }
        links.push(["Next", current + 1], ["Last", total]);
        return links;
    };

    const closeMenus = (e: MouseEvent) => {
        if (outfitMenu !== null && !(e.target as HTMLElement).closest(".outfit-menu")) {
            outfitMenu = null;
        }
    };

    const thumb = (item: any) => item.thumbnail || "/img/pending.png";
    const canWear = (item: any) => wearable.includes(item.category) && (item.asset_id || item.package_parts);
</script>

<svelte:head>
    <title>Avatar - NoneRev</title>
    <link rel="stylesheet" href="/css/avatar.css">
</svelte:head>

<svelte:window onclick={closeMenus} />

{#snippet tile(item: any, mode: "wardrobe" | "wearing")}
    <div class="asset-tile">
        <div class="asset-thumb">
            <a href="/catalog/item?id={item.id}"><img src={thumb(item)} alt={item.name}></a>
            {#if mode === "wearing"}
                <div class="asset-button">
                    <button type="button" class="btn-small" onclick={() => wear(item.id, false)}>Remove</button>
                </div>
            {:else if canWear(item)}
                <div class="asset-button">
                    <button type="button" class="btn-small" disabled={!!item.wearing} onclick={() => wear(item.id, true)}>{item.wearing ? "Wearing" : "Wear"}</button>
                </div>
            {/if}
        </div>
        <div class="asset-details">
            <div class="asset-name"><a href="/catalog/item?id={item.id}">{item.name}</a></div>
            {#if mode === "wearing"}
                <div class="asset-type"><span class="asset-type-label">Type:</span> <span>{itemCategoryName[item.category] ?? item.category}</span></div>
            {:else if !canWear(item)}
                <div class="asset-type"><span class="asset-type-label">Not wearable</span></div>
            {/if}
        </div>
    </div>
{/snippet}

{#snippet pager(current: number, total: number, set: (p: number) => void)}
    <div class="avatar-pager">
        <span>
            {#each pagerLinks(current, total) as [label, to]}
                {#if label === String(current)}
                    <span>{label}</span>
                {:else}
                    <a href="#" class:disabled={to < 1 || to > total || to === current} onclick={e => go(e, set, to, total)}>{label}</a>
                {/if}
            {/each}
        </span>
    </div>
{/snippet}

<main class="avatar-page">
{#if data}
    <h1>Avatar Customizer</h1>

    <div class="avatar-left">
        <div class="avatar-holder">
            {#if threeD}
                {#key avatarVersion}
                    <Avatar3D userId={me.id} size={352} />
                {/key}
            {:else}
                <img src="/api/user/getProfilePicture?userId={me.id}&type=full{avatarVersion ? `&v=${avatarVersion}` : ""}" alt={me.username}>
            {/if}
            <button type="button" class="btn-control-small avatar-view-toggle" onclick={() => threeD = !threeD}>{threeD ? "2D" : "3D"}</button>
        </div>

        <div class="avatar-redraw">
            Something wrong with your avatar?<br>
            <a href="#" onclick={redraw}>Click here to re-draw it!</a>
            {#if status}
                <div class="avatar-status" class:error={statusError}>{status}</div>
            {/if}
        </div>

        <div class="avatar-type">
            <h2>Avatar Type (BETA)</h2>
            <div class="avatar-type-options">
                {#each ["R6", "R15"] as type}
                    <label class="avatar-type-option" class:selected={rig === type}>
                        <input type="radio" name="avatar-type" value={type} checked={rig === type} onchange={() => setType(type)}><span>{type}</span>
                    </label>{" "}
                {/each}
            </div>
        </div>
        <div class="avatar-type-note">Note that gear, body parts, and some hats are not yet R15 compatible.</div>

        <h2 class="avatar-colors-title">Colors</h2>
        <div class="avatar-mannequin">
            <p>Click a body part to change its color:</p>
            <div class="mannequin-frame">
                <div class="mannequin-parts">
                    {#each parts as [key, label]}
                        <button type="button" class="mannequin-part" data-part={key} title="{label}: {name(data.colors[key])}"
                            style="background-color: {hex(data.colors[key])}" onclick={() => part = key}></button>
                    {/each}
                </div>
            </div>
        </div>
    </div>

    <div class="avatar-right">
        <a class="btn-get-more" href="/catalog">Get More</a>
        <div class="get-more-text">Explore the catalog to find more clothes!</div>

        <div class="avatar-tabs">
            <button type="button" class:tab-active={view === "wardrobe"} onclick={() => view = "wardrobe"}>Wardrobe</button>
            <button type="button" class:tab-active={view === "outfits"} onclick={() => view = "outfits"}>Outfits</button>
        </div>

        <div class="avatar-tab-panel">
            {#if view === "wardrobe"}
                <div class="wardrobe-categories">
                    {#each categoryRows as row, i}
                        {#if i > 0}<br>{/if}
                        {#each row as [key, label]}
                            <a href="#" class:selected={category === key} onclick={e => pickCategory(e, key)}>{label}</a>{" "}
                        {/each}
                    {/each}
                    {#if createLinks[category]}
                        <div class="wardrobe-create"><a href={createLinks[category]}>Create</a></div>
                    {/if}
                </div>

                <div class="wardrobe-content">
                    {#if data.owned.length === 0}
                        <div class="avatar-empty">You do not own any items yet. Visit the <a href="/catalog">catalog</a> to get some.</div>
                    {:else if pageItems.length === 0}
                        <div class="avatar-empty">No items in this category.</div>
                    {/if}
                    {#each pageItems as item (item.id)}
                        {@render tile(item, "wardrobe")}
                    {/each}
                </div>
                {@render pager(page, pages, p => page = p)}
            {:else}
                <div class="outfits-banner">
                    <div class="outfits-banner-right">
                        <button type="button" class="btn-control-large" onclick={() => openModal("create")}>Create New Outfit</button>
                    </div>
                </div>

                <div class="outfits-container">
                    {#if outfits.length === 0}
                        <div class="avatar-empty">You haven't saved any outfits yet.</div>
                    {/if}
                    {#each outfitItems as outfit (outfit.id)}
                        <div class="outfit-tile">
                            <div class="outfit-menu">
                                <button type="button" class="outfit-gear" class:active={outfitMenu === outfit.id} aria-label="Outfit options"
                                    onclick={() => outfitMenu = outfitMenu === outfit.id ? null : outfit.id}></button>
                                {#if outfitMenu === outfit.id}
                                    <ul class="outfit-menu-list">
                                        <li><button type="button" onclick={() => useOutfit(outfit.id)}>Wear</button></li>
                                        <li><button type="button" onclick={() => openModal("rename", outfit)}>Rename</button></li>
                                        <li><button type="button" onclick={() => openModal("update", outfit)}>Update</button></li>
                                        <li><button type="button" onclick={() => removeOutfit(outfit.id)}>Delete</button></li>
                                        <li><a href={outfit.thumbnail || undefined} download="{outfit.name}.png" target="_blank" onclick={() => outfitMenu = null}>Download as image</a></li>
                                    </ul>
                                {/if}
                            </div>
                            <button type="button" class="outfit-avatar" title="Wear" onclick={() => useOutfit(outfit.id)}>
                                <img src={thumb(outfit)} alt={outfit.name}>
                            </button>
                            <div class="outfit-name" title={outfit.name}>{outfit.name}</div>
                            <div>Created:</div>
                            <div>{shortDate(outfit.created_at)}</div>
                        </div>
                    {/each}
                </div>

                {#if outfitPages > 1}
                    <div class="outfits-pager">
                        <button type="button" class="btn-control-small" disabled={outfitPage <= 1} aria-label="Previous page" onclick={() => outfitPage--}>&#9664;</button>
                        Page {outfitPage} of {outfitPages}
                        <button type="button" class="btn-control-small" disabled={outfitPage >= outfitPages} aria-label="Next page" onclick={() => outfitPage++}>&#9654;</button>
                    </div>
                {/if}
            {/if}
        </div>

        <div class="avatar-divider"></div>
        <h2>Currently Wearing</h2>
        <div class="wearing-content">
            {#if data.wearing.length === 0}
                <div class="avatar-empty">You are not wearing any items from your wardrobe.</div>
            {/if}
            {#each wearItems as item (item.id)}
                {@render tile(item, "wearing")}
            {/each}
        </div>
        {@render pager(wearPage, wearPages, p => wearPage = p)}
    </div>

    {#if part}
        <div class="color-modal">
            <button type="button" class="avatar-modal-close" aria-label="Close" onclick={() => part = null}></button>
            <div class="color-modal-title">Choose a {parts.find(p => p[0] === part)?.[1]} Color</div>
            <div class="color-modal-swatches">
                {#each swatches.filter(n => data.palette[n]) as n}
                    <button type="button" class="color-swatch" title={name(n)} style="background-color: {hex(n)}" onclick={() => paint(n)}></button>
                {/each}
            </div>
        </div>
    {/if}

    {#if modal}
        {@const [title, message, action] = modalText[modal]}
        <div class="avatar-overlay"></div>
        <div class="outfit-modal">
            <button type="button" class="avatar-modal-close" aria-label="Close" onclick={() => modal = null}></button>
            <div class="outfit-modal-title">{title}</div>
            <form class="outfit-modal-body" onsubmit={saveOutfit}>
                <div class="outfit-modal-message">
                    <p>{message}</p>
                    {#if modal !== "update"}
                        <label>Name: <input type="text" bind:value={outfitName} maxlength="60" required></label>
                    {/if}
                </div>
                <div class="outfit-modal-buttons">
                    <button type="submit" class="btn-large btn-large-purple" disabled={outfitBusy}>{action}</button>
                    <button type="button" class="btn-large btn-large-gray" onclick={() => modal = null}>Cancel</button>
                </div>
            </form>
        </div>
    {/if}
{/if}
</main>
