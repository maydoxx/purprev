<script lang="ts">
    import { api, apiForm } from "../../api";
    import { session } from "../../session.svelte";
    import { router } from "../../router.svelte";

    const tabs: Record<string, string> = {
        about: "About",
        store: "Store",
        games: "Games",
        affiliates: "Affiliates"
    };

    const id = $derived(Math.max(0, Number(router.query.id) || 0));
    const tab = $derived(tabs[router.query.tab ?? ""] ? router.query.tab! : "about");
    const memberRole = $derived(router.query.role ?? "");
    const memberPage = $derived(Math.max(1, Number(router.query.member_page) || 1));

    let group = $state<any>(null);
    let notFound = $state(false);
    let roles = $state<any[]>([]);
    let members = $state<any[]>([]);
    let memberPages = $state(1);
    let wall = $state<any[]>([]);
    let manage = $state<any[]>([]);
    let requests = $state<any[]>([]);

    let error = $state("");
    let success = $state("");
    let busy = $state(false);

    let shout = $state("");
    let post = $state("");
    let settingsForm = $state({
        description: "",
        approval_required: false,
        wall_enabled: true
    });
    let iconFile = $state<FileList | null>(null);
    let newRole = $state({
        role_name: "",
        rank: 2,
        can_post_wall: false,
        can_shout: false,
        can_delete_wall: false,
        can_manage_members: false
    });

    const me = $derived(session.me?.id ?? 0);
    const isOwner = $derived(!!group && me > 0 && group.owner_id === me);
    const isMember = $derived(!!group && me > 0 && (isOwner || !!group.is_member));
    const joinPending = $derived(!!group && !isMember && !!group.join_pending);
    const viewerRole = $derived(group?.viewer_role ?? "Guest");
    const viewerRank = $derived(group?.viewer_rank ?? 0);
    const can = (p: string) => !!group && me > 0 && (isOwner || !!group[`can_${p}`]);
    const memberCount = $derived(group?.member_count ?? 0);

    const settings = $derived(!!group && (isOwner || can("manage_members")) && "settings" in router.query);
    const settingsTabs = $derived<Record<string, string>>(isOwner ? {
        general: "General",
        roles: "Roles",
        members: "Members",
        requests: "Join Requests"
    } : {
        members: "Members",
        requests: "Join Requests"
    });
    const settingsTab = $derived(settingsTabs[router.query.settings_tab ?? ""] ? router.query.settings_tab! : Object.keys(settingsTabs)[0]);

    const list = (d: any) => Array.isArray(d) ? d : Array.isArray(d?.list) ? d.list : [];

    const url = (extra: Record<string, string | number> = {}, t = tab) => {
        const p = new URLSearchParams({
            id: String(id)
        });
        if (t !== "about") p.set("tab", t);
        for (const [k, v] of Object.entries(extra)) {
            if (v !== "") p.set(k, String(v));
        }
        return "/groups?" + p;
    };

    const load = async () => {
        try {
            const d = await api(`/groups/${id}`);
            group = d?.id ? d : null;
        } catch {
            group = null;
        }
        notFound = !group;
        if (!group) return;

        shout = group.shout ?? "";
        settingsForm = {
            description: group.description ?? "",
            approval_required: !!group.approval_required,
            wall_enabled: !!group.wall_enabled
        };
        roles = list(await api(`/groups/${id}/roles`).catch(() => []));
    };

    const loadMembers = async () => {
        const d = await api(`/groups/${id}/members?page=${memberPage}${memberRole ? `&role=${encodeURIComponent(memberRole)}` : ""}`).catch(() => null);
        members = list(d);
        memberPages = Math.max(1, d?.pages ?? 1);
    };

    const loadWall = async () => {
        wall = list(await api(`/groups/${id}/wall`).catch(() => []));
    };

    const loadSettings = async () => {
        const [m, r] = await Promise.all([
            api(`/groups/${id}/members?page=1`).catch(() => []),
            api(`/groups/${id}/requests`).catch(() => [])
        ]);
        manage = list(m).map((x: any) => ({
            ...x,
            role_id: x.role_id ?? roles.find(role => role.rank === x.rank)?.id
        }));
        requests = list(r);
    };

    $effect(() => {
        id;
        group = null;
        notFound = false;
        error = "";
        success = "";
        if (id > 0) load();
        else notFound = true;
    });

    $effect(() => {
        id;
        memberRole;
        memberPage;
        if (id > 0) loadMembers();
    });

    $effect(() => {
        id;
        if (id > 0) loadWall();
    });

    $effect(() => {
        if (settings) loadSettings();
    });

    const act = async (run: () => Promise<any>, done: string, after: () => Promise<any> = load) => {
        busy = true;
        error = "";
        success = "";
        try {
            await run();
            success = done;
            await after();
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const send = (path: string, body: unknown = {}) => api(`/groups/${id}${path}`, body);
    const del = (path: string) => api(`/groups/${id}${path}`, undefined, "DELETE");

    const join = () => act(() => send("/join"), group.approval_required ? "Join request sent." : "You joined the group.");
    const leave = () => act(() => send("/leave"), "You left the group.");
    const setShout = (e: Event) => {
        e.preventDefault();
        act(() => send("/shout", {
            shout
        }), "Group shout updated.");
    };
    const postWall = (e: Event) => {
        e.preventDefault();
        act(() => send("/wall", {
            body: post
        }), "", async () => {
            post = "";
            await loadWall();
        });
    };
    const deleteWall = (postId: number) => act(() => del(`/wall/${postId}`), "", loadWall);

    const saveSettings = (e: Event) => {
        e.preventDefault();
        act(async () => {
            if (iconFile?.[0]) {
                const fd = new FormData();
                fd.append("description", settingsForm.description);
                fd.append("approval_required", String(settingsForm.approval_required));
                fd.append("wall_enabled", String(settingsForm.wall_enabled));
                fd.append("icon", iconFile[0]);
                await apiForm(`/groups/${id}/settings`, fd, "PATCH");
                iconFile = null;
            } else {
                await api(`/groups/${id}/settings`, settingsForm, "PATCH");
            }
        }, "Group settings saved.");
    };

    const deleteGroup = () => {
        if (!confirm("Permanently delete this group? This cannot be undone.")) return;
        act(() => del(""), "", async () => router.go("/my/groups"));
    };

    const perms = (r: any) => ({
        can_post_wall: !!r.can_post_wall,
        can_shout: !!r.can_shout,
        can_delete_wall: !!r.can_delete_wall,
        can_manage_members: !!r.can_manage_members
    });

    const addRole = (e: Event) => {
        e.preventDefault();
        act(() => send("/roles", {
            role_name: newRole.role_name,
            rank: Number(newRole.rank),
            ...perms(newRole)
        }), "Role created.", async () => {
            newRole = {
                role_name: "",
                rank: 2,
                can_post_wall: false,
                can_shout: false,
                can_delete_wall: false,
                can_manage_members: false
            };
            await load();
        });
    };
    const updateRole = (e: Event, r: any) => {
        e.preventDefault();
        act(() => api(`/groups/${id}/roles/${r.id}`, {
            role_name: r.name,
            ...perms(r)
        }, "PATCH"), "Role updated.");
    };
    const deleteRole = (roleId: number) => {
        if (!confirm("Delete this role? Members with it will become Members.")) return;
        act(() => del(`/roles/${roleId}`), "Role deleted.");
    };

    const setRank = (e: Event, m: any) => {
        e.preventDefault();
        act(() => api(`/groups/${id}/members/${m.id}`, {
            role_id: Number(m.role_id)
        }, "PATCH"), "Member rank updated.", loadSettings);
    };
    const exile = (userId: number) => {
        if (!confirm("Exile this member and delete their wall posts?")) return;
        act(() => del(`/members/${userId}`), "Member exiled.", async () => {
            await load();
            await loadSettings();
        });
    };
    const approve = (userId: number) => act(() => send(`/requests/${userId}/approve`), "Join request approved.", async () => {
        await load();
        await loadSettings();
    });
    const deny = (userId: number) => act(() => send(`/requests/${userId}/deny`), "Join request declined.", loadSettings);

    const canManageThis = (m: any) => m.id !== group.owner_id && (isOwner || (m.rank ?? 0) < viewerRank);
    const roleOptions = $derived(roles.filter(r => r.rank !== 255 && (isOwner || r.rank < viewerRank)));

    const pic = (userId: number) => `/api/user/getProfilePicture?userId=${userId}&type=headshot`;
    const when = (t: number) => new Date(t * 1000).toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
</script>

<svelte:head>
    <title>{group ? group.name : notFound ? "Group Not Found" : "Group"} - NoneRev</title>
    <link rel="stylesheet" href="/css/groups.css">
</svelte:head>

{#snippet user(u: any)}
    <a href="/user?id={u.id}">
        <img src={pic(u.id)} alt="">
        <strong>{u.username}</strong>
    </a>
{/snippet}

{#snippet permBoxes(r: any, disabled: boolean)}
    <label><input type="checkbox" bind:checked={r.can_post_wall} {disabled}> Wall</label>
    <label><input type="checkbox" bind:checked={r.can_shout} {disabled}> Shout</label>
    <label><input type="checkbox" bind:checked={r.can_delete_wall} {disabled}> Moderate wall</label>
    <label><input type="checkbox" bind:checked={r.can_manage_members} {disabled}> Members</label>
{/snippet}

<main class="groups2016-page"><div class="groups2016-shell">
{#if notFound}
    <div class="groups2016-card groups-not-found">
        <h1>Group not found</h1>
        <p>This group doesn't exist.</p>
        <a href="/my/groups" class="groups2016-btn primary">Back to Groups</a>
    </div>
{:else if group}
    <div class="groups2016-top-action"><a class="groups2016-btn secondary" href="/my/groups?create=1">Create Group</a></div>
    {#if error}<div class="groups2016-alert error">{error}</div>{/if}
    {#if success}<div class="groups2016-alert success">{success}</div>{/if}

    <section class="groups2016-card group-header-card">
        <img class="group-header-icon" src={group.icon || "/img/pending.png"} alt={group.name}>
        <div class="group-header-main">
            <h1>{group.name}</h1>
            <div class="group-byline">By <a href="/user?id={group.owner_id}">{group.owner_username || "Unknown"}</a></div>
            <div class="group-header-stats">
                <div><span>Members</span><strong>{memberCount.toLocaleString()}</strong></div>
                <div><span>Rank</span><strong>{viewerRole}</strong></div>
            </div>
        </div>
        <div class="group-header-actions">
            {#if me > 0 && !isMember && !joinPending}
                <form onsubmit={e => { e.preventDefault(); join(); }}>
                    <button class="groups2016-btn primary" type="submit" disabled={busy}>{group.approval_required ? "Request to Join" : "Join Group"}</button>
                </form>
            {/if}
            {#if joinPending}
                <button class="groups2016-btn secondary" disabled>Request Pending</button>
            {/if}
            {#if me > 0 && isMember && !isOwner}
                <form onsubmit={e => { e.preventDefault(); leave(); }}>
                    <button class="groups2016-btn secondary" type="submit" disabled={busy}>Leave Group</button>
                </form>
            {/if}
            {#if isOwner || can("manage_members")}
                <a class="group-more-button" href={url({ settings: 1 }, "about")} title="Configure group">&bull;&bull;&bull;</a>
            {/if}
        </div>
    </section>

    <nav class="group-tabs">
        {#each Object.entries(tabs) as [key, label]}
            <a class:active={tab === key} href={url({}, key)}>{label}</a>
        {/each}
    </nav>

    {#if settings}
        <section class="group-section group-settings-section">
            <div class="group-section-heading">
                <h2>Configure Group</h2>
                <a class="groups2016-btn secondary" href={url({}, "about")}>Back to Group</a>
            </div>
            <div class="groups2016-card group-admin-card">
                <nav class="group-admin-tabs">
                    {#each Object.entries(settingsTabs) as [key, label]}
                        <a class:active={settingsTab === key} href={url({ settings: 1, settings_tab: key }, "about")}>{label}{key === "requests" && requests.length ? ` (${requests.length})` : ""}</a>
                    {/each}
                </nav>

                {#if settingsTab === "general"}
                    <form class="groups-settings-form group-admin-pane" onsubmit={saveSettings}>
                        <label for="group-description">Description</label>
                        <textarea id="group-description" bind:value={settingsForm.description} rows="6" maxlength="2000"></textarea>
                        <label for="group-icon">Group Emblem</label>
                        <div class="group-emblem-setting">
                            <img src={group.icon || "/img/pending.png"} alt="">
                            <input id="group-icon" type="file" bind:files={iconFile} accept="image/png,image/jpeg,image/webp">
                        </div>
                        <label class="group-check"><input type="checkbox" bind:checked={settingsForm.approval_required}> Manual approval required to join</label>
                        <label class="group-check"><input type="checkbox" bind:checked={settingsForm.wall_enabled}> Enable group wall</label>
                        <div class="groups-settings-actions"><button class="groups2016-btn primary" type="submit" disabled={busy}>Save</button></div>
                    </form>
                    <div class="group-danger-zone">
                        <h3>Delete Group</h3>
                        <p>Permanently deletes this group, its roles, join requests and wall posts.</p>
                        <button class="group-delete-button" type="button" disabled={busy} onclick={deleteGroup}>Delete Group</button>
                    </div>
                {:else if settingsTab === "roles"}
                    <div class="group-admin-pane">
                        <h3>Roles</h3>
                        {#each roles as r (r.id)}
                            <form class="group-role-row" onsubmit={e => updateRole(e, r)}>
                                <div class="group-role-rank">Rank {r.rank}</div>
                                <input type="text" bind:value={r.name} maxlength="32" readonly={r.rank === 255}>
                                {@render permBoxes(r, r.rank === 255)}
                                {#if r.rank !== 255}<button class="groups2016-btn secondary" type="submit" disabled={busy}>Save</button>{/if}
                            </form>
                            {#if r.rank !== 1 && r.rank !== 255}
                                <div class="group-role-delete"><button type="button" disabled={busy} onclick={() => deleteRole(r.id)}>Delete role</button></div>
                            {/if}
                        {/each}
                        <h3>Create Role</h3>
                        <form class="group-role-create" onsubmit={addRole}>
                            <input type="text" bind:value={newRole.role_name} maxlength="32" placeholder="Role name" required>
                            <input type="number" bind:value={newRole.rank} min="2" max="254" placeholder="Rank" required>
                            {@render permBoxes(newRole, false)}
                            <button class="groups2016-btn primary" type="submit" disabled={busy}>Create Role</button>
                        </form>
                    </div>
                {:else if settingsTab === "members"}
                    <div class="group-admin-pane">
                        <h3>Members</h3>
                        {#if manage.length === 0}
                            <div class="groups-empty compact">No members found.</div>
                        {/if}
                        {#each manage as m (m.id)}
                            <div class="group-manage-member">
                                {@render user(m)}
                                <span>{m.role}</span>
                                {#if canManageThis(m)}
                                    <form onsubmit={e => setRank(e, m)}>
                                        <select bind:value={m.role_id}>
                                            {#each roleOptions as r}
                                                <option value={r.id}>{r.name}</option>
                                            {/each}
                                        </select>
                                        <button class="groups2016-btn secondary" type="submit" disabled={busy}>Set Rank</button>
                                    </form>
                                    <form onsubmit={e => { e.preventDefault(); exile(m.id); }}>
                                        <button class="group-danger-link" type="submit" disabled={busy}>Exile</button>
                                    </form>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="group-admin-pane">
                        <h3>Join Requests</h3>
                        {#if requests.length === 0}
                            <div class="groups-empty compact">No pending requests.</div>
                        {:else}
                            {#each requests as r (r.user_id)}
                                <div class="group-join-request">
                                    {@render user({ id: r.user_id, username: r.username })}
                                    <span>{when(r.created_at)}</span>
                                    <form onsubmit={e => { e.preventDefault(); approve(r.user_id); }}>
                                        <button class="groups2016-btn primary" type="submit" disabled={busy}>Accept</button>
                                    </form>
                                    <form onsubmit={e => { e.preventDefault(); deny(r.user_id); }}>
                                        <button class="groups2016-btn secondary" type="submit" disabled={busy}>Decline</button>
                                    </form>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
        </section>
    {:else if tab === "about"}
        <section class="group-section group-shout-section">
            <h2>Shout</h2>
            <div class="groups2016-card group-shout-card">
                {#if can("shout")}
                    <form class="group-shout-form" onsubmit={setShout}>
                        <input type="text" bind:value={shout} maxlength="255" placeholder="Enter your shout">
                        <button class="groups2016-btn primary" type="submit" disabled={busy}>Group Shout</button>
                    </form>
                {:else if (group.shout ?? "").trim() !== ""}
                    <div class="group-shout-display">{group.shout}</div>
                {:else}
                    <div class="group-shout-empty">No group shout.</div>
                {/if}
            </div>
        </section>

        <section class="group-section">
            <h2>Description</h2>
            <div class="groups2016-card group-description" style="white-space: pre-line">{(group.description ?? "").trim() || "No description available."}</div>
        </section>

        <section class="group-section group-members-section">
            <div class="group-section-heading members-heading">
                <h2>Members ({memberCount.toLocaleString()})</h2>
                <div class="member-controls">
                    {#if memberPages > 1}
                        <a class="member-page-button" class:disabled={memberPage <= 1} href={url({ role: memberRole, member_page: Math.max(1, memberPage - 1) }, "about")}>&lsaquo;</a>
                        <span>Page {memberPage.toLocaleString()}</span>
                        <a class="member-page-button" class:disabled={memberPage >= memberPages} href={url({ role: memberRole, member_page: Math.min(memberPages, memberPage + 1) }, "about")}>&rsaquo;</a>
                    {/if}
                    <form onsubmit={e => e.preventDefault()}>
                        <select value={memberRole} onchange={e => router.go(url({ role: e.currentTarget.value }, "about"))}>
                            <option value="">All Members</option>
                            {#each roles as r}
                                <option value={r.name}>{r.name}</option>
                            {/each}
                        </select>
                    </form>
                </div>
            </div>
            <div class="groups2016-card members-card">
                {#if members.length === 0}
                    <div class="groups-empty compact">No members found.</div>
                {:else}
                    <div class="group-member-grid">
                        {#each members as m (m.id)}
                            <a class="group-member" href="/user?id={m.id}">
                                <img src={pic(m.id)} alt="">
                                <span>{m.username}</span>
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        </section>

        <section class="group-section group-wall-section" id="wall">
            <h2>Wall</h2>
            <div class="groups2016-card wall-card">
                {#if group.wall_enabled && can("post_wall")}
                    <form class="group-wall-form" onsubmit={postWall}>
                        <textarea bind:value={post} maxlength="500" rows="3" placeholder="Say something..."></textarea>
                        <button class="groups2016-btn primary" type="submit" disabled={busy}>Post</button>
                    </form>
                {:else if !group.wall_enabled}
                    <div class="wall-join-note">The group wall is disabled.</div>
                {:else if me > 0}
                    <div class="wall-join-note">Your rank cannot post on the group wall.</div>
                {/if}

                <div class="group-wall-list">
                    {#if wall.length === 0}
                        <div class="groups-empty compact">No wall posts yet.</div>
                    {:else}
                        {#each wall as p (p.id)}
                            <article class="group-wall-post">
                                <a href="/user?id={p.user_id}" class="wall-avatar"><img src={pic(p.user_id)} alt=""></a>
                                <div class="wall-post-main">
                                    <div class="wall-post-meta">
                                        <a href="/user?id={p.user_id}">{p.username}</a>
                                        <time>{when(p.created_at)}</time>
                                    </div>
                                    <div class="wall-post-body" style="white-space: pre-line">{p.body}</div>
                                </div>
                                {#if me > 0 && (can("delete_wall") || p.user_id === me)}
                                    <div class="wall-delete-form"><button type="button" title="Delete post" disabled={busy} onclick={() => deleteWall(p.id)}>&bull;&bull;&bull;</button></div>
                                {/if}
                            </article>
                        {/each}
                    {/if}
                </div>
            </div>
        </section>
    {:else}
        <section class="group-section">
            <h2>{tabs[tab]}</h2>
            <div class="groups2016-card groups-empty tab-placeholder">
                {#if tab === "store"}This group doesn't have any store items yet.{/if}
                {#if tab === "games"}This group doesn't have any games yet.{/if}
                {#if tab === "affiliates"}This group doesn't have any affiliates yet.{/if}
            </div>
        </section>
    {/if}
{/if}
</div></main>
