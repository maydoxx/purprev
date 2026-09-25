<script lang="ts">
    import { api } from "../../api";
    import { session } from "../../session.svelte";
    import { rows, total, num } from "./util";
    import Layout from "./Layout.svelte";

    let users = $state<any>(null);
    let items = $state<any>(null);
    let moderation = $state<any>(null);
    let invites = $state<any>(null);
    let servers = $state<any>(null);

    api("/admin/users").then(d => users = d).catch(() => {});
    api("/admin/catalog").then(d => items = d).catch(() => {});
    api("/admin/moderation").then(d => moderation = d).catch(() => {});
    api("/admin/invitekeys").then(d => invites = d).catch(() => {});

    const loadServers = () => api("/admin/servers").then(d => servers = d).catch(() => {});
    loadServers();

    const shutDown = async (jobId: string) => {
        if (!confirm("Shut down this game server? Everyone in it gets kicked.")) return;
        try {
            await api(`/admin/servers/${jobId}`, undefined, "DELETE");
            await loadServers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const rccState = $derived(!servers ? "unknown" : servers.health?.rcc === "up" ? "up" : "down");

    const recentUsers = $derived(rows(users).slice(0, 6));
    const recentItems = $derived(rows(items).slice(0, 6));

    const price = (p: any) => p == null ? "Off Sale" : Number(p) === 0 ? "Free" : num(p);
</script>

{#snippet stat(label: string, value: string)}
    <div class="col-6 col-lg">
        <div class="card admin-stat-card h-100">
            <div class="card-body">
                <div class="admin-stat-label">{label}</div>
                <div class="admin-stat-number">{value}</div>
            </div>
        </div>
    </div>
{/snippet}

<Layout title="Admin Panel">
    <div class="admin-heading d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
            <h1>Admin Panel</h1>
            <p>Signed in as {session.me?.username}.</p>
        </div>
        <a href="/home" class="btn btn-outline-secondary btn-sm">Back to site</a>
    </div>

    <div class="row g-3 mb-4">
        {@render stat("Users", num(total(users)))}
        {@render stat("Game servers", servers ? num(servers.servers.length) : "—")}
        {@render stat("Catalog items", num(total(items)))}
        {@render stat("Active actions", num(total(moderation)))}
        {@render stat("Invite keys", num(total(invites)))}
    </div>

    <div class="row g-4 mb-4">
        <div class="col-lg-5">
            <div class="card h-100">
                <div class="card-header bg-white">
                    <span class="admin-card-title">Quick actions</span>
                </div>
                <div class="card-body d-grid gap-2">
                    <a href="/admi/catalog" class="btn btn-primary text-start"><i class="bi bi-bag me-2"></i>Manage catalog</a>
                    <a href="/admi/blog" class="btn btn-outline-primary text-start"><i class="bi bi-newspaper me-2"></i>Manage blog</a>
                    <a href="/admi/users" class="btn btn-outline-primary text-start"><i class="bi bi-people me-2"></i>Manage users</a>
                    <a href="/admi/moderation" class="btn btn-outline-secondary text-start"><i class="bi bi-shield-exclamation me-2"></i>Moderate a user</a>
                    <a href="/admi/invitekeys" class="btn btn-outline-secondary text-start"><i class="bi bi-key me-2"></i>Invite keys</a>
                </div>
            </div>
        </div>

        <div class="col-lg-7">
            <div class="card h-100">
                <div class="card-header bg-white d-flex justify-content-between align-items-center">
                    <span class="admin-card-title">Newest users</span>
                    <a href="/admi/users" class="small">View all</a>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover mb-0 admin-table">
                        <thead class="table-light">
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Admin</th>
                                <th class="text-end">Nonebux</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each recentUsers as u}
                                <tr>
                                    <td>{u.id}</td>
                                    <td><a href="/user?id={u.id}">{u.username}</a></td>
                                    <td>{u.admin}</td>
                                    <td class="text-end">{num(u.currency)}</td>
                                </tr>
                            {:else}
                                <tr><td colspan="4" class="text-center text-muted py-4">No users yet.</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <span class="admin-card-title">Running game servers</span>
            <span class="admin-muted">rcc is {rccState}</span>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Place</th>
                        <th>Job</th>
                        <th>Port</th>
                        <th>Players</th>
                        <th>Started</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each servers?.servers ?? [] as s}
                        <tr>
                            <td><a href="/game?id={s.placeId}">{s.title || s.placeId}</a></td>
                            <td class="admin-key">{s.jobId}{s.ready ? "" : " (starting)"}</td>
                            <td>{s.port}</td>
                            <td>{s.players}</td>
                            <td>{new Date(s.startedAt).toLocaleString("en-US")}</td>
                            <td class="admin-actions"><button type="button" class="btn btn-sm btn-outline-danger" onclick={() => shutDown(s.jobId)}>Shut down</button></td>
                        </tr>
                    {:else}
                        <tr><td colspan="6" class="text-center text-muted py-4">No game servers are running.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <span class="admin-card-title">Newest catalog items</span>
            <a href="/admi/catalog" class="small">Manage catalog</a>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 admin-table">
                <thead class="table-light">
                    <tr>
                        <th></th>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Creator</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    {#each recentItems as item}
                        <tr>
                            <td style="width:70px"><img class="admin-thumb" src={item.thumbnail || "/img/pending.png"} alt=""></td>
                            <td>{item.name}</td>
                            <td>{item.category}</td>
                            <td>{item.creator_name || "Unknown"}</td>
                            <td>{price(item.price)}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="5" class="text-center text-muted py-4">No catalog items yet.</td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</Layout>
