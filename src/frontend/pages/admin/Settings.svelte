<script lang="ts">
    import { api } from "../../api";
    import { num, type Flash } from "./util";
    import Layout from "./Layout.svelte";

    let settings = $state<any>(null);
    let stats = $state<any>(null);
    let flash = $state<Flash>(null);
    let rendering = $state(false);

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    api("/admin/settings").then(d => settings = d).catch(err => note("danger", err.message));
    api("/admin/stats").then(d => stats = d).catch(() => {});

    const toggle = async (name: string, label: string, on: boolean) => {
        try {
            settings = await api("/admin/settings", {
                [name]: on
            }, "PATCH");
            note("success", `${label} turned ${on ? "on" : "off"}.`);
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const renderAll = async () => {
        if (!confirm("Re-render every user's avatar? This queues one render per user on RCCManager.")) return;
        rendering = true;
        try {
            const d = await api("/admin/render/avatars", {});
            note("success", `Queued ${num(d.queued)} avatar renders. They finish in the background.`);
        } catch (err: any) {
            note("danger", err.message);
        }
        rendering = false;
    };

    const checked = (e: Event) => (e.currentTarget as HTMLInputElement).checked;
</script>

<Layout title="Settings">
    <div class="admin-heading">
        <h1>Settings</h1>
        <p>Site wide switches and maintenance jobs.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="card mb-4">
        <div class="card-header"><span class="admin-card-title">Signups</span></div>
        <div class="admin-settings">
            <div class="admin-setting">
                <div>
                    <h4>Registration open</h4>
                    <p>When off, the signup page and the app say registration is closed. Invite keys still work.</p>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" aria-label="Registration open" checked={settings?.registration_enabled ?? true} disabled={!settings} onchange={e => toggle("registration_enabled", "Registration", checked(e))}>
                </div>
            </div>
            <div class="admin-setting">
                <div>
                    <h4>Users can make invite keys</h4>
                    <p>Lets every account generate keys from their settings. Off means only admins hand out keys.</p>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" aria-label="Users can make invite keys" checked={settings?.invites_enabled ?? true} disabled={!settings} onchange={e => toggle("invites_enabled", "User invite keys", checked(e))}>
                </div>
            </div>
            <div class="admin-setting">
                <div>
                    <h4>Applications open</h4>
                    <p>People without a key can apply on /apply. Each one lands in Discord and under Applications.</p>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" aria-label="Applications open" checked={settings?.applications_enabled ?? true} disabled={!settings} onchange={e => toggle("applications_enabled", "Applications", checked(e))}>
                </div>
            </div>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-header"><span class="admin-card-title">Rendering</span></div>
        <div class="admin-settings">
            <div class="admin-setting">
                <div>
                    <h4>Re-render all avatars</h4>
                    <p>Queues a fresh avatar and headshot for every user on RCCManager. Use it after changing the render setup.</p>
                </div>
                <button type="button" class="btn btn-outline-primary" disabled={rendering || !stats || stats.rcc !== "up"} onclick={renderAll}>{rendering ? "Queuing…" : "Re-render"}</button>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header"><span class="admin-card-title">RCCManager</span></div>
        <div class="admin-settings">
            <div class="admin-setting">
                <div>
                    <h4>Status</h4>
                    <p>{stats ? stats.rcc === "up" ? `Up, ${num(stats.servers)} game server${stats.servers === 1 ? "" : "s"} running with ${num(stats.players)} playing.` : stats.rcc === "down" ? "The manager answers but RCCService is down." : "The manager is unreachable, check RCCMANAGER_HOST and the password." : "Checking…"}</p>
                </div>
                <span class="admin-pill" class:ok={stats?.rcc === "up"} class:danger={stats && stats.rcc !== "up"}>{stats ? stats.rcc : "…"}</span>
            </div>
        </div>
    </div>
</Layout>
