<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, adminDate, toInput, type Flash } from "./util";
    import Layout from "./Layout.svelte";

    const styles: [string, string][] = [
        ["info", "Orange (notice)"],
        ["warning", "Red (warning)"],
        ["success", "Green (good news)"]
    ];

    const stateBadge: Record<string, string> = {
        Live: "success",
        Off: "secondary",
        Scheduled: "info",
        Expired: "warning"
    };

    const edit = $derived(Number(router.query.edit) || 0);

    const blank = () => ({
        id: 0,
        message: "",
        linkText: "",
        linkUrl: "",
        style: "info",
        enabled: true,
        dismissible: false,
        startsAt: "",
        endsAt: ""
    });

    let data = $state<any>(null);
    let form = $state<any>(blank());
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api("/admin/banners").then(d => data = d).catch(err => note("danger", err.message));
    load();

    $effect(() => {
        if (!edit) {
            form = blank();
            return;
        }
        const b = rows(data).find(b => b.id === edit);
        if (!b) return;
        form = {
            id: b.id,
            message: b.message ?? "",
            linkText: b.linkText ?? "",
            linkUrl: b.linkUrl ?? "",
            style: b.style ?? "info",
            enabled: Number(b.enabled) === 1 || b.enabled === true,
            dismissible: Number(b.dismissible) === 1 || b.dismissible === true,
            startsAt: toInput(b.startsAt),
            endsAt: toInput(b.endsAt)
        };
    });

    const save = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            const body = {
                message: form.message,
                linkText: form.linkText,
                linkUrl: form.linkUrl,
                style: form.style,
                enabled: form.enabled,
                dismissible: form.dismissible,
                startsAt: form.startsAt,
                endsAt: form.endsAt
            };
            if (form.id > 0) {
                await api(`/admin/banners/${form.id}`, body, "PATCH");
                note("success", `Banner #${form.id} saved.`);
            } else {
                const d = await api("/admin/banners", body);
                note("success", d?.id ? `Banner #${d.id} created.` : "Banner created.");
                form = blank();
            }
            router.go("/admi/banners");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };

    const toggle = async (b: any) => {
        try {
            await api(`/admin/banners/${b.id}/toggle`, {});
            note("success", `Banner #${b.id} ${on(b) ? "turned off." : "turned on."}`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this banner?")) return;
        try {
            await api(`/admin/banners/${id}`, undefined, "DELETE");
            note("success", `Banner #${id} deleted.`);
            if (edit === id) router.go("/admi/banners");
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const on = (b: any) => Number(b.enabled) === 1 || b.enabled === true;

    const stateOf = (b: any) => {
        if (!on(b)) return "Off";
        const now = Date.now() / 1000;
        if (Number(b.startsAt) > now) return "Scheduled";
        if (Number(b.endsAt) > 0 && Number(b.endsAt) < now) return "Expired";
        return "Live";
    };
</script>

<Layout title="Banners">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Banners</h1>
            <p>The strip that shows under the navbar on every page.</p>
        </div>
        <a href="/home" class="btn btn-outline-secondary btn-sm">Back to site</a>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="card mb-4">
        <div class="card-body">
            <h2 class="h5 mb-3">{form.id > 0 ? `Editing banner #${form.id}` : "New banner"}</h2>

            <form onsubmit={save} class="row g-3">
                <div class="col-12">
                    <label class="form-label" for="banner-message">Message</label>
                    <textarea class="form-control" id="banner-message" rows="2" maxlength="500" placeholder="Servers are going down for updates at 8pm." required bind:value={form.message}></textarea>
                </div>

                <div class="col-md-4">
                    <label class="form-label" for="banner-style">Colour</label>
                    <select class="form-select" id="banner-style" bind:value={form.style}>
                        {#each styles as [value, label]}
                            <option {value}>{label}</option>
                        {/each}
                    </select>
                </div>

                <div class="col-md-4">
                    <label class="form-label" for="banner-link-text">Link text <span class="text-muted">(optional)</span></label>
                    <input type="text" class="form-control" id="banner-link-text" maxlength="120" bind:value={form.linkText} placeholder="Read more">
                </div>

                <div class="col-md-4">
                    <label class="form-label" for="banner-link-url">Link URL <span class="text-muted">(optional)</span></label>
                    <input type="text" class="form-control" id="banner-link-url" maxlength="255" bind:value={form.linkUrl} placeholder="/blog">
                </div>

                <div class="col-md-4">
                    <label class="form-label" for="banner-starts">Show from <span class="text-muted">(optional)</span></label>
                    <input type="datetime-local" class="form-control" id="banner-starts" bind:value={form.startsAt}>
                </div>

                <div class="col-md-4">
                    <label class="form-label" for="banner-ends">Show until <span class="text-muted">(optional)</span></label>
                    <input type="datetime-local" class="form-control" id="banner-ends" bind:value={form.endsAt}>
                </div>

                <div class="col-md-4 d-flex align-items-end">
                    <div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="banner-enabled" bind:checked={form.enabled}>
                            <label class="form-check-label" for="banner-enabled">Enabled</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="banner-dismissible" bind:checked={form.dismissible}>
                            <label class="form-check-label" for="banner-dismissible">Let people close it</label>
                        </div>
                    </div>
                </div>

                <div class="col-12 d-flex gap-2">
                    <button type="submit" class="btn btn-primary btn-sm" disabled={busy}>{form.id > 0 ? "Save changes" : "Create banner"}</button>
                    {#if form.id > 0}
                        <a href="/admi/banners" class="btn btn-outline-secondary btn-sm">Cancel</a>
                    {/if}
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Message</th>
                        <th>Colour</th>
                        <th>State</th>
                        <th>Window</th>
                        <th>Updated</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as b (b.id)}
                        {@const state = stateOf(b)}
                        <tr>
                            <td>{b.id}</td>
                            <td>
                                {b.message}
                                {#if b.linkUrl && b.linkText}
                                    <span class="text-muted small">({b.linkText} &rarr; {b.linkUrl})</span>
                                {/if}
                                {#if Number(b.dismissible) === 1 || b.dismissible === true}
                                    <span class="badge bg-light text-dark">closeable</span>
                                {/if}
                            </td>
                            <td><span class="badge bg-secondary">{b.style}</span></td>
                            <td><span class="badge bg-{stateBadge[state]}">{state}</span></td>
                            <td class="small text-muted">
                                {#if !(Number(b.startsAt) > 0) && !(Number(b.endsAt) > 0)}
                                    Always
                                {:else}
                                    {adminDate(b.startsAt)} &rarr; {adminDate(b.endsAt)}
                                {/if}
                            </td>
                            <td class="small text-muted">{adminDate(b.updatedAt)}</td>
                            <td class="admin-actions">
                                <div class="d-flex gap-1">
                                    <a href="/admi/banners?edit={b.id}" class="btn btn-sm btn-outline-primary">Edit</a>
                                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick={() => toggle(b)}>{on(b) ? "Disable" : "Enable"}</button>
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => remove(b.id)}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="7" class="text-center text-muted py-5">No banners yet. Make one above.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</Layout>
