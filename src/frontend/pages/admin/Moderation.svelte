<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { type Flash } from "./util";
    import Layout from "./Layout.svelte";

    const types: [string, string][] = [
        ["reminder", "Reminder"],
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
    let offenses = $state<{ label: string, body: string }[]>([]);
    let busy = $state(false);
    let flash = $state<Flash>(null);

    const labels = ["Forum Post", "Forum Thread", "Message", "Chat", "Status", "Comment", "Username", "Place", "Item", "Group"];

    const note = (t: string, message: string) => flash = {
        type: t,
        message
    };

    const addOffense = () => offenses.push({
        label: "",
        body: ""
    });

    const submit = async (e: Event) => {
        e.preventDefault();
        busy = true;
        try {
            await api("/admin/moderation", {
                username,
                type,
                reason,
                offenses: offenses.filter(o => o.body.trim() !== "")
            });
            note("success", `${types.find(t => t[0] === type)?.[1]} applied to ${username}.`);
            username = "";
            reason = "";
            offenses = [];
        } catch (err: any) {
            note("danger", err.message);
        }
        busy = false;
    };
</script>

<Layout title="Moderation">
    <div class="admin-heading">
        <h1>Moderation</h1>
        <p>Apply an account reminder, warning, temporary ban, or deletion.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="row g-4">
        <div class="col-lg-7">
            <div class="card">
                <div class="card-header"><span class="admin-card-title">New moderation action</span></div>
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

                        <div class="mb-3">
                            <span class="form-label d-block">Offending items</span>
                            {#each offenses as offense, i}
                                <div class="border rounded p-2 mb-2">
                                    <div class="d-flex gap-2 mb-2">
                                        <input class="form-control form-control-sm" list="offense-labels" maxlength="40" placeholder="Label, e.g. Forum Post" aria-label="Label" bind:value={offense.label}>
                                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick={() => offenses.splice(i, 1)}>Remove</button>
                                    </div>
                                    <textarea class="form-control form-control-sm" rows="2" maxlength="4000" placeholder="The offending post, message or name" aria-label="Offending content" bind:value={offense.body}></textarea>
                                </div>
                            {/each}
                            <datalist id="offense-labels">
                                {#each labels as label}
                                    <option value={label}></option>
                                {/each}
                            </datalist>
                            <button type="button" class="btn btn-sm btn-outline-secondary" onclick={addOffense} disabled={offenses.length >= 10}>Add offending item</button>
                            <div class="form-text">Shown to the user with the moderator note. Up to 10.</div>
                        </div>

                        <button class="btn btn-danger" type="submit" disabled={busy}>Apply action</button>
                        <a href="/admi/viewmoderation" class="btn btn-outline-secondary">View active actions</a>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-lg-5">
            <div class="card">
                <div class="card-header"><span class="admin-card-title">Notes</span></div>
                <div class="card-body small text-secondary">
                    <p class="mb-2">Temporary bans store a real expiration timestamp, so 1/3/7/14 day bans expire at the correct time.</p>
                    <p class="mb-2">Account deletion does not expire automatically.</p>
                    <p class="mb-0">Reminders and warnings can be dismissed by the user right away.</p>
                </div>
            </div>
        </div>
    </div>
</Layout>
