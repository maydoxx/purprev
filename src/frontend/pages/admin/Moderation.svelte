<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { type Flash } from "./util";
    import Layout from "./Layout.svelte";

    const types: [string, string][] = [
        ["warning", "Warning"],
        ["ban1d", "Ban for 1 day"],
        ["ban3d", "Ban for 3 days"],
        ["ban7d", "Ban for 7 days"],
        ["ban14d", "Ban for 14 days"],
        ["account_deletion", "Account deletion"]
    ];

    let username = $state(router.query.username ?? "");
    let type = $state("warning");
    let reason = $state("");
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const note = (t: string, message: string) => flash = {
        type: t,
        message
    };

    const submit = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            await api("/admin/moderation", {
                username,
                type,
                reason
            });
            note("success", `${types.find(t => t[0] === type)?.[1]} applied to ${username}.`);
            username = "";
            reason = "";
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };
</script>

<Layout title="Moderation">
    <div class="admin-heading">
        <h1>Moderation</h1>
        <p>Apply an account warning, temporary ban, or deletion.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="row g-4">
        <div class="col-lg-7">
            <div class="card">
                <div class="card-header bg-white"><span class="admin-card-title">New moderation action</span></div>
                <div class="card-body">
                    <form onsubmit={submit}>
                        <div class="mb-3">
                            <label class="form-label" for="username">Username</label>
                            <input class="form-control" id="username" bind:value={username} required>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="type">Action</label>
                            <select class="form-select" id="type" bind:value={type}>
                                {#each types as [value, label]}
                                    <option {value}>{label}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="reason">Moderator note</label>
                            <textarea class="form-control" id="reason" rows="4" bind:value={reason} required></textarea>
                        </div>

                        <button class="btn btn-danger" type="submit" disabled={busy}>Apply action</button>
                        <a href="/admi/viewmoderation" class="btn btn-outline-secondary">View active actions</a>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-lg-5">
            <div class="card">
                <div class="card-header bg-white"><span class="admin-card-title">Notes</span></div>
                <div class="card-body small text-secondary">
                    <p class="mb-2">Temporary bans store a real expiration timestamp, so 1/3/7/14 day bans expire at the correct time.</p>
                    <p class="mb-0">Account deletion does not expire automatically.</p>
                </div>
            </div>
        </div>
    </div>
</Layout>
