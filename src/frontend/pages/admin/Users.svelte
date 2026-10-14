<script lang="ts">
    import { api } from "../../api";
    import { router } from "../../router.svelte";
    import { session } from "../../session.svelte";
    import { rows, total, pages, num, adminDate, staffRank, type Flash } from "./util";
    import Layout from "./Layout.svelte";
    import Pagination from "./Pagination.svelte";

    const q = $derived(router.query.q ?? "");
    const page = $derived(Math.max(1, Number(router.query.page) || 1));
    const status = $derived(router.query.status ?? "all");

    let search = $state("");
    let data = $state<any>(null);
    let users = $state<any[]>([]);
    let flash = $state<Flash>(null);

    let open = $state(0);
    let edit = $state<any>(null);
    let history = $state<any>(null);
    let inventory = $state<any[]>([]);
    let inventoryQuery = $state("");
    let itemId = $state("");
    let saving = $state(false);
    let resetLink = $state("");
    let selectedUserIds = $state<number[]>([]);
    let bulkAction = $state("warning");
    let bulkReason = $state("");

    const note = (type: string, message: string) => flash = {
        type,
        message
    };

    $effect(() => {
        search = q;
    });

    const load = () => api(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&status=${encodeURIComponent(status)}`).then(d => {
        data = d;
        users = rows(d);
        selectedUserIds = [];
    }).catch(err => note("danger", err.message));

    $effect(() => {
        q;
        page;
        status;
        load();
    });

    const toggle = async (u: any) => {
        if (open === u.id) {
            open = 0;
            resetLink = "";
            return;
        }
        open = u.id;
        resetLink = "";
        edit = {
            admin: Math.min(5, Number(u.admin)),
            currency: Number(u.currency),
            tix: Number(u.tix),
            membership: u.membership ?? "None",
            membership_days: "",
            username: u.username
        };
        history = null;
        inventory = [];
        inventoryQuery = "";
        itemId = "";
        try {
            history = await api(`/admin/users/${u.id}/history`);
            await loadItems(u.id);
        } catch (err: any) {
            note("danger", err.message);
        }
    };

    const loadItems = async (userId: number) => {
        inventory = rows(await api(`/admin/users/${userId}/items?q=${encodeURIComponent(inventoryQuery)}`));
    };

    const changeUsername = async (u: any) => {
        saving = true;
        try {
            await api(`/admin/users/${u.id}/username`, { username: edit.username }, "POST");
            note("success", `${u.username} is now ${edit.username}.`);
            u.username = edit.username;
            history = await api(`/admin/users/${u.id}/history`);
            await load();
        } catch (err: any) {
            note("danger", err.message);
        }
        saving = false;
    };

    const createPasswordResetLink = async (u: any) => {
        saving = true;
        try {
            const result = await api(`/admin/users/${u.id}/password-reset`, {}, "POST");
            resetLink = result.url;
            note("success", `Password reset link created for ${u.username}. It expires in 1 hour and can only be used once.`);
        } catch (err: any) {
            note("danger", err.message);
        }
        saving = false;
    };

    const copyResetLink = async () => {
        await navigator.clipboard.writeText(resetLink);
        note("success", "Password reset link copied.");
    };

    const addItem = async (u: any) => {
        const id = Number(itemId);
        if (!Number.isInteger(id) || id < 1) {
            note("danger", "Enter a valid catalog item ID.");
            return;
        }
        saving = true;
        try {
            await api(`/admin/users/${u.id}/items`, { item_id: id }, "POST");
            note("success", `Added item #${id} to ${u.username}.`);
            itemId = "";
            await loadItems(u.id);
        } catch (err: any) {
            note("danger", err.message);
        }
        saving = false;
    };

    const removeItem = async (u: any, item: any) => {
        if (!confirm(`Remove "${item.name}" from ${u.username}?`)) return;
        saving = true;
        try {
            await api(`/admin/users/${u.id}/items/${item.id}`, undefined, "DELETE");
            note("success", `Removed ${item.name} from ${u.username}.`);
            await loadItems(u.id);
        } catch (err: any) {
            note("danger", err.message);
        }
        saving = false;
    };

    const save = async (u: any) => {
        if (u.id === session.me?.id && Number(edit.admin) < 1) {
            note("danger", "You cannot remove your own admin access here.");
            return;
        }
        const changes: string[] = [];
        if (Number(edit.admin) !== Number(u.admin)) {
            changes.push(`Staff rank: ${staffRank(u.admin)} → ${staffRank(edit.admin)}`);
            if (Number(u.admin) > 0 && Number(edit.admin) === 0) changes.push("WARNING: this removes the user's staff access.");
        }
        if (Number(edit.currency) !== Number(u.currency)) changes.push(`Nonebux: ${num(u.currency)} → ${num(edit.currency)}`);
        if (Number(edit.tix) !== Number(u.tix)) changes.push(`Tix: ${num(u.tix)} → ${num(edit.tix)}`);
        if (edit.membership !== (u.membership ?? "None")) changes.push(`Builders Club: ${u.membership ?? "None"} → ${edit.membership}`);
        if (edit.membership_days !== "") changes.push(`Club duration: ${edit.membership_days} days`);
        if (changes.length && !confirm(`Review changes for ${u.username}:\n\n${changes.join("\n")}\n\nApply these changes?`)) return;
        saving = true;
        try {
            await api(`/admin/users/${u.id}`, {
                admin_level: Number(edit.admin),
                currency: Number(edit.currency),
                tix: Number(edit.tix),
                membership: edit.membership,
                membership_days: edit.membership_days === "" ? undefined : Number(edit.membership_days)
            }, "PATCH");
            note("success", `${u.username} updated.`);
            if (u.id === session.me?.id) session.refresh();
            await load();
        } catch (err: any) {
            note("danger", err.message);
        }
        saving = false;
    };

    const submit = (e: Event) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (status !== "all") params.set("status", status);
        router.go("/admi/users" + (params.size ? "?" + params.toString() : ""));
    };

    const setStatus = (value: string) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (value !== "all") params.set("status", value);
        router.go("/admi/users" + (params.size ? "?" + params.toString() : ""));
    };

    const url = (p: number) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (status !== "all") params.set("status", status);
        params.set("page", String(p));
        return `/admi/users?${params.toString()}`;
    };
    const toggleUserSelection = (id: number) => {
        selectedUserIds = selectedUserIds.includes(id)
            ? selectedUserIds.filter(selectedId => selectedId !== id)
            : [...selectedUserIds, id];
    };
    const togglePageSelection = () => {
        const pageIds = users.filter(u => Number(u.id) !== Number(session.me?.id)).map(u => Number(u.id));
        const allSelected = pageIds.length > 0 && pageIds.every(id => selectedUserIds.includes(id));
        selectedUserIds = allSelected ? [] : pageIds;
    };
    const applyBulkModeration = async () => {
        const selected = users.filter(u => selectedUserIds.includes(Number(u.id)));
        if (!selected.length || !bulkReason.trim()) {
            note("danger", "Select at least one account and enter a moderation reason.");
            return;
        }
        const actionLabel = ({
            warning: "warning",
            ban1d: "1 day ban",
            ban3d: "3 day ban",
            ban7d: "7 day ban",
            ban14d: "14 day ban"
        }[bulkAction] ?? "moderation action");
        const targets = selected.map(u => `${u.username} (#${u.id})`).join(", ");
        if (!confirm(`Review bulk moderation\n\nAction: ${actionLabel}\nReason: ${bulkReason.trim()}\nAccounts (${selected.length}): ${targets}\n\nApply this action to every listed account?`)) return;
        saving = true;
        try {
            await api("/admin/moderation/bulk", {
                user_ids: selected.map(u => Number(u.id)),
                type: bulkAction,
                reason: bulkReason.trim()
            }, "POST");
            note("success", `Applied ${actionLabel} to ${selected.length} account${selected.length === 1 ? "" : "s"}.`);
            selectedUserIds = [];
            bulkReason = "";
            await load();
        } catch (err: any) {
            note("danger", err.message);
        }
        saving = false;
    };
    const pic = (id: number) => `/api/user/getProfilePicture?userId=${id}&type=headshot`;
    const club = (u: any) => u.membership && u.membership !== "None" ? u.membership : "";
    const when = (t: any) => adminDate(t);
</script>

<Layout title="Users">
    <div class="admin-heading">
        <h1>Users</h1>
        <p>{num(total(data))} account{total(data) === 1 ? "" : "s"}. Open a row to edit, see who invited them and who shares their IP.</p>
    </div>

    {#if flash}
        <div class="alert alert-{flash.type}">{flash.message}</div>
    {/if}

    <div class="admin-toolbar">
        <form onsubmit={submit}>
            <input type="search" class="form-control" bind:value={search} placeholder="Username, email, or user ID">
            <button class="btn btn-primary" type="submit">Search</button>
            {#if q}<a href="/admi/users" class="btn btn-outline-secondary">Clear</a>{/if}
            <select class="form-select" aria-label="Filter users by status" value={status} onchange={(event) => setStatus(event.currentTarget.value)}>
                <option value="all">All accounts</option>
                <option value="admin">Staff</option>
                <option value="banned">Banned users</option>
                <option value="recent">Recent signups (7 days)</option>
                <option value="moderated">Moderated</option>
                <option value="membership">Membership</option>
            </select>
        </form>
        <span class="spacer"></span>
        <a href="/admi/moderation" class="btn btn-outline-danger">Moderate someone</a>
    </div>

    <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-2 align-items-end">
            <div>
                <label for="bulk-action">Bulk action</label>
                <select id="bulk-action" class="form-select" bind:value={bulkAction}>
                    <option value="warning">Warning</option>
                    <option value="ban1d">1 day ban</option>
                    <option value="ban3d">3 day ban</option>
                    <option value="ban7d">7 day ban</option>
                    <option value="ban14d">14 day ban</option>
                </select>
            </div>
            <div class="flex-grow-1">
                <label for="bulk-reason">Reason</label>
                <input id="bulk-reason" class="form-control" maxlength="1000" bind:value={bulkReason} placeholder="Reason for this action">
            </div>
            <button type="button" class="btn btn-danger" disabled={saving || selectedUserIds.length === 0} onclick={applyBulkModeration}>Review and moderate ({selectedUserIds.length})</button>
            <span class="admin-muted">Selections apply to this page only.</span>
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover admin-table align-middle">
                <thead>
                    <tr>
                        <th><input type="checkbox" aria-label="Select all eligible accounts on this page" checked={users.some(u => Number(u.id) !== Number(session.me?.id)) && users.filter(u => Number(u.id) !== Number(session.me?.id)).every(u => selectedUserIds.includes(Number(u.id)))} onchange={togglePageSelection}></th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Nonebux</th>
                        <th>Tix</th>
                        <th>Invited by</th>
                        <th>Joined</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each users as u (u.id)}
                        <tr class:table-active={open === u.id}>
                            <td><input type="checkbox" aria-label="Select {u.username}" disabled={Number(u.id) === Number(session.me?.id)} checked={selectedUserIds.includes(Number(u.id))} onchange={() => toggleUserSelection(Number(u.id))}></td>
                            <td>
                                <div class="admin-user">
                                    <img class="admin-avatar" src={pic(u.id)} alt="">
                                    <div>
                                        <a href="/user?id={u.id}">{u.username}</a> <span class="admin-muted">#{u.id}</span>
                                        <div class="admin-muted">{u.email || "no email"}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                {#if u.ongoing_action_id != null}<span class="admin-pill danger">Moderated</span>{/if}
                                {#if Number(u.admin) > 0}<span class="admin-pill admin">{staffRank(u.admin)}</span>{/if}
                                {#if club(u)}<span class="admin-pill {club(u).toLowerCase()}" title={Number(u.membership_expires) > 0 ? `until ${adminDate(u.membership_expires)}` : "never expires"}>{club(u)}</span>{/if}
                                {#if u.ongoing_action_id == null && Number(u.admin) === 0 && !club(u)}<span class="admin-muted">—</span>{/if}
                            </td>
                            <td>{num(u.currency)}</td>
                            <td>{num(u.tix)}</td>
                            <td>
                                {#if u.invited_by}<a href="/user?id={u.invited_by_id}">{u.invited_by}</a>{:else}<span class="admin-muted">—</span>{/if}
                                {#if Number(u.invited) > 0}<div class="admin-muted">brought {u.invited}</div>{/if}
                            </td>
                            <td class="admin-muted">{Number(u.created_at) > 0 ? adminDate(u.created_at) : "—"}</td>
                            <td class="admin-actions">
                                <button type="button" class="btn btn-sm" class:btn-primary={open === u.id} class:btn-outline-primary={open !== u.id} onclick={() => toggle(u)}>{open === u.id ? "Close" : "Edit"}</button>
                                <a class="btn btn-sm btn-outline-danger" href="/admi/moderation?username={encodeURIComponent(u.username)}">Moderate</a>
                            </td>
                        </tr>
                        {#if open === u.id && edit}
                            <tr class="admin-editor">
                                <td colspan="8">
                                    <div class="row g-3 align-items-end mb-3">
                                        <div class="col-sm-3 col-lg-2">
                                            <label for="admin-{u.id}">Staff rank</label>
                                            <select id="admin-{u.id}" class="form-select" bind:value={edit.admin}>
                                                <option value={0}>No staff rank</option>
                                                <option value={1}>Trial Moderator</option>
                                                <option value={2}>Moderator</option>
                                                <option value={3}>Senior Moderator</option>
                                                <option value={4}>Trial Administrator</option>
                                                <option value={5}>Administrator</option>
                                            </select>
                                        </div>
                                        <div class="col-sm-4 col-lg-2">
                                            <label for="bux-{u.id}">Nonebux</label>
                                            <input id="bux-{u.id}" type="number" class="form-control" min="0" bind:value={edit.currency}>
                                        </div>
                                        <div class="col-sm-4 col-lg-2">
                                            <label for="tix-{u.id}">Tix</label>
                                            <input id="tix-{u.id}" type="number" class="form-control" min="0" max="2000000000" bind:value={edit.tix}>
                                        </div>
                                        <div class="col-sm-3 col-lg-2">
                                            <label for="club-{u.id}">Builders Club</label>
                                            <select id="club-{u.id}" class="form-select" bind:value={edit.membership}>
                                                <option value="None">None</option>
                                                <option value="BC">BC</option>
                                                <option value="TBC">TBC</option>
                                                <option value="OBC">OBC</option>
                                            </select>
                                        </div>
                                        <div class="col-sm-3 col-lg-2">
                                            <label for="days-{u.id}">Club days</label>
                                            <input id="days-{u.id}" type="number" class="form-control" min="0" placeholder={Number(u.membership_expires) > 0 ? `until ${new Date(Number(u.membership_expires) * 1000).toLocaleDateString("en-US")}` : "keep"} title="days until it expires, 0 = never, blank = keep" bind:value={edit.membership_days}>
                                        </div>
                                        <div class="col-auto">
                                            <button type="button" class="btn btn-primary" disabled={saving} onclick={() => save(u)}>Save</button>
                                        </div>
                                    </div>

                                    <div class="row g-3 align-items-end mb-3">
                                        <div class="col-sm-5 col-lg-4">
                                            <label for="username-{u.id}">Username</label>
                                            <input id="username-{u.id}" class="form-control" maxlength="20" bind:value={edit.username}>
                                        </div>
                                        <div class="col-auto">
                                            <button type="button" class="btn btn-outline-primary" disabled={saving || edit.username === u.username} onclick={() => changeUsername(u)}>Change username</button>
                                        </div>
                                    </div>

                                    <div class="row g-3 align-items-end mb-3">
                                        <div class="col-auto">
                                            <button type="button" class="btn btn-outline-danger" disabled={saving} onclick={() => createPasswordResetLink(u)}>Generate password reset link</button>
                                        </div>
                                        {#if resetLink}
                                            <div class="col-12">
                                                <label for="reset-link-{u.id}">Share this one-time link with the user</label>
                                                <div class="input-group">
                                                    <input id="reset-link-{u.id}" class="form-control" readonly value={resetLink} onfocus={(event) => event.currentTarget.select()}>
                                                    <button type="button" class="btn btn-outline-secondary" onclick={copyResetLink}>Copy link</button>
                                                </div>
                                            </div>
                                        {/if}
                                        <div class="col-12 admin-muted">The link expires after 1 hour. Creating another link invalidates the previous one.</div>
                                    </div>

                                    <div class="admin-history mb-3">
                                        <strong>Inventory</strong>
                                        <div class="row g-2 align-items-end mt-1 mb-2">
                                            <div class="col-sm-5 col-lg-4">
                                                <label for="item-id-{u.id}">Catalog item ID to add</label>
                                                <input id="item-id-{u.id}" type="number" min="1" class="form-control" bind:value={itemId}>
                                            </div>
                                            <div class="col-auto">
                                                <button type="button" class="btn btn-outline-primary" disabled={saving} onclick={() => addItem(u)}>Add item</button>
                                            </div>
                                            <div class="col-sm-5 col-lg-4">
                                                <label for="inventory-search-{u.id}">Find owned items</label>
                                                <input id="inventory-search-{u.id}" class="form-control" placeholder="Name or item ID" bind:value={inventoryQuery} onkeydown={(event) => { if (event.key === "Enter") { event.preventDefault(); loadItems(u.id); } }}>
                                            </div>
                                            <div class="col-auto">
                                                <button type="button" class="btn btn-outline-secondary" disabled={saving} onclick={() => loadItems(u.id)}>Search</button>
                                            </div>
                                        </div>
                                        {#each inventory as item (item.id)}
                                            <div class="d-flex align-items-center gap-2 py-1">
                                                <span>{item.name} <span class="admin-muted">#{item.id} · {item.category}</span></span>
                                                {#if item.serial_number}<span class="admin-muted">Serial #{item.serial_number}</span>{/if}
                                                <button type="button" class="btn btn-sm btn-outline-danger ms-auto" disabled={saving} onclick={() => removeItem(u, item)}>Remove</button>
                                            </div>
                                        {:else}
                                            <div class="admin-muted">No matching items found. Showing at most 50 results.</div>
                                        {/each}
                                    </div>

                                    {#if !history}
                                        <span class="admin-muted">Loading history…</span>
                                    {:else}
                                        <div class="row g-3 admin-history">
                                            <div class="col-md-4">
                                                <strong>Invited by</strong>
                                                <div>{#if history.invitedBy}<a href="/user?id={history.invitedBy.created_by}">{history.invitedBy.creator_name || history.invitedBy.created_by}</a> on {when(history.invitedBy.used_at)} from <code>{history.invitedBy.ip}</code>{:else}<span class="admin-muted">no record, older account</span>{/if}</div>
                                                <strong class="mt-3">Invited ({history.invited.length})</strong>
                                                {#each history.invited as i (i.id)}
                                                    <div><a href="/user?id={i.id}">{i.username || i.id}</a>{#if i.ongoing_action_id != null} <span class="admin-pill danger">Moderated</span>{/if} <span class="admin-muted">{when(i.used_at)} · {i.ip}</span></div>
                                                {:else}
                                                    <div class="admin-muted">nobody</div>
                                                {/each}
                                            </div>
                                            <div class="col-md-4">
                                                <strong>Same IP ({history.sameIp.length})</strong>
                                                {#each history.sameIp as s (s.id + s.ip)}
                                                    <div><a href="/user?id={s.id}">{s.username}</a>{#if s.ongoing_action_id != null} <span class="admin-pill danger">Moderated</span>{/if} <span class="admin-muted">{s.ip}</span></div>
                                                {:else}
                                                    <div class="admin-muted">{history.ips.length ? "nobody" : "no ip on record"}</div>
                                                {/each}
                                            </div>
                                            <div class="col-md-4">
                                                <strong>Old usernames ({history.usernames.length})</strong>
                                                {#each history.usernames as n}
                                                    <div>{n.old_username} → {n.new_username} <span class="admin-muted">{when(n.changed_at)}</span></div>
                                                {:else}
                                                    <div class="admin-muted">never changed</div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </td>
                            </tr>
                        {/if}
                    {:else}
                        <tr><td colspan="8" class="admin-empty">No users found.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <Pagination {page} totalPages={pages(data)} {url} label="User pages" />
</Layout>
