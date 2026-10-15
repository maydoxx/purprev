<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { rows, total, pages, num, adminDate, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const tabs: [string, string][] = [
        ["pending", "Waiting"],
        ["approved", "Approved"],
        ["denied", "Denied"],
        ["all", "All"]
    ];

    const which = $derived(tabs.some(t => t[0] === router.query.status) ? router.query.status! : "pending");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));

    let data = $state<any>(null);
    let flash = $state<Flash>(null);
    let busy = $state<Record<number, boolean>>({});
    let settings = $state<any>(null);
    let expanded = $state<Record<number, boolean>>({});

    api("/admin/settings").then(d => settings = d).catch(() => {});

    const toggle = async (on: boolean) => {
        try {
            settings = await api("/admin/settings", {
                applications_enabled: on
            }, "PATCH");
            note("success", `Applications ${on ? "open" : "closed"}.`);
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    const load = () => api(`/admin/applications?status=${which}&page=${page}`).then(d => data = d).catch(err => note("danger", err.message));

    $effect(() => {
        which;
        page;
        load();
    });

    const decide = async (a: any, verdict: "approve" | "deny") => {
        let reason = "";
        if (verdict === "deny") {
            const r = prompt(`Deny ${a.name}? Give a reason, they get to see it. Leave it empty for none.`);
            if (r === null) return;
            reason = r.trim();
        }
        busy[a.id] = true;
        try {
            const d = await api(`/admin/applications/${a.id}/${verdict}`, {
                reason
            });
            note("success", verdict === "approve" ? `${a.name} approved, their account is #${d.user_id}.` : `${a.name} denied.`);
            load();
        } catch (err: any) {
            note("danger", err.message);
        }
        busy[a.id] = false;
    };

    const url = (p: number) => `/admi/applications?status=${which}&page=${p}`;
</script>

<Layout title="Applications">
    <div class="admin-heading">
        <h1>Applications</h1>
        <p>People asking to join. Approving creates their account with the username and password they picked.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        {#each tabs as [key, label]}
            <a href="/admi/applications?status={key}" class="btn" class:btn-primary={which === key} class:btn-outline-secondary={which !== key}>{label}</a>
        {/each}
        <span class="spacer"></span>
        <span class="admin-muted">{num(total(data))} {which === "all" ? "in total" : which}</span>
        <label class="admin-switch">
            <input type="checkbox" role="switch" checked={settings?.applications_enabled ?? true} disabled={!settings} onchange={e => toggle((e.currentTarget as HTMLInputElement).checked)}>
            <span>{settings ? settings.applications_enabled ? "Applications open" : "Applications closed" : "…"}</span>
        </label>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table admin-table align-top">
                <thead>
                    <tr>
                        <th>Who</th>
                        <th>Why</th>
                        <th>Sent</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows(data) as a (a.id)}
                        <tr>
                            <td class="admin-app-who">
                                <div class="fw-semibold">{a.name} <span class="admin-muted">#{a.id}</span></div>
                                <div class="admin-muted">discord {a.discord}</div>
                                <div class="admin-muted admin-app-text">{a.socials}</div>
                                <div class="admin-muted admin-key">{a.ip}</div>
                            </td>
                            <td class="admin-app-why" class:open={expanded[a.id]}>
                                <div class="admin-muted">Found us</div>
                                <div class="admin-app-text">{a.found}</div>
                                <div class="admin-muted mt-2">Why NoneRev</div>
                                <div class="admin-app-text">{a.why}</div>
                                <div class="admin-muted mt-2">Other revivals</div>
                                <div class="admin-app-text">{a.revivals || "none"}</div>
                                <div class="admin-muted mt-2">About them</div>
                                <div class="admin-app-text">{a.about}</div>
                                <button type="button" class="admin-app-more" onclick={() => expanded[a.id] = !expanded[a.id]}>{expanded[a.id] ? "Show less" : "Show more"}</button>
                            </td>
                            <td class="admin-muted" style="white-space:nowrap">{adminDate(a.created_at)}</td>
                            <td style="white-space:nowrap">
                                {#if a.status === "pending"}
                                    <span class="admin-pill">waiting</span>
                                {:else if a.status === "approved"}
                                    <span class="admin-pill ok">approved</span>
                                    <div class="admin-muted">by {a.decided_by}</div>
                                    {#if a.user_id}<div><a href="/user?id={a.user_id}">account #{a.user_id}</a></div>{/if}
                                {:else}
                                    <span class="admin-pill danger">denied</span>
                                    <div class="admin-muted">by {a.decided_by}</div>
                                    {#if a.reason}<div class="admin-muted admin-app-text">{a.reason}</div>{/if}
                                {/if}
                            </td>
                            <td class="admin-actions">
                                {#if a.status === "pending"}
                                    <button type="button" class="btn btn-sm btn-primary" disabled={busy[a.id]} onclick={() => decide(a, "approve")}>Approve</button>
                                    <button type="button" class="btn btn-sm btn-outline-danger" disabled={busy[a.id]} onclick={() => decide(a, "deny")}>Deny</button>
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="admin-empty">Nothing here.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="Application pages" />
</Layout>
