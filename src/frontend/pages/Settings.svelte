<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";

    type Tab = "account" | "security" | "privacy" | "billing" | "notifications" | "invites";
    const tabs: { id: Tab; label: string }[] = [
        { id: "account", label: "Account Info" },
        { id: "security", label: "Security" },
        { id: "privacy", label: "Privacy" },
        { id: "billing", label: "Billing" },
        { id: "notifications", label: "Notifications" },
        { id: "invites", label: "Invites" }
    ];

    let tab = $state<Tab>("account");
    let editingEmail = $state(false);
    let editingPassword = $state(false);
    let busy = $state(false);
    let notice = $state<{ text: string; ok: boolean } | null>(null);
    let newEmail = $state(session.me?.email ?? "");
    let newBio = $state(session.me?.about ?? "");
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let inviteKey = $state("");

    const show = (text: string, ok = true) => notice = { text, ok };

    const save = async (path: string, body: unknown, done: string) => {
        busy = true;
        notice = null;
        try {
            await api(path, body);
            await session.refresh();
            show(done);
            editingEmail = false;
            editingPassword = false;
            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
        } catch (err: any) {
            show(err.message, false);
        } finally {
            busy = false;
        }
    };

    const generate = async () => {
        busy = true;
        notice = null;
        try {
            inviteKey = (await api("/user/invites/generate", {})).key;
            show("Invite key generated.");
        } catch (err: any) {
            show(err.message, false);
        } finally {
            busy = false;
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(inviteKey);
            show("Invite key copied.");
        } catch {
            show("Could not copy the invite key.", false);
        }
    };
</script>

<svelte:head>
    <title>My Settings - NoneRev</title>
    <link rel="stylesheet" href="/css/settings.css">
</svelte:head>

<main class="settings-page" id="user-account">
    <h1>My Settings</h1>
    <div class="settings-layout">
        <nav class="settings-navigation" aria-label="Settings sections">
            {#each tabs as item}
                <button type="button" class:active={tab === item.id} onclick={() => { tab = item.id; notice = null; }}>{item.label}</button>
            {/each}
        </nav>

        <div class="settings-content">
            {#if notice}
                <div class="settings-message" class:success={notice.ok} class:error={!notice.ok} role="status">{notice.text}</div>
            {/if}

            {#if tab === "account"}
                <section class="settings-section">
                    <h2>Account Info</h2>
                    <div class="settings-card settings-account-card">
                        <div class="settings-info-row"><span>Username: <strong>{session.me?.username}</strong></span><span class="settings-readonly" title="Username changes are not available">✎</span></div>
                        <div class="settings-info-row"><span>Password: <strong>••••••••</strong></span><button type="button" class="settings-edit-icon" aria-label="Change password" onclick={() => { tab = "security"; editingPassword = true; }}>✎</button></div>
                        <div class="settings-info-row"><span>Email address: <strong>{session.me?.email || "Not set"}</strong></span><button type="button" class="settings-edit-icon" aria-label="Edit email address" onclick={() => editingEmail = !editingEmail}>✎</button></div>
                        {#if editingEmail}
                            <form class="settings-inline-editor" onsubmit={e => { e.preventDefault(); save("/user/settings/changeemail", { newEmail }, "Email updated."); }}>
                                <label for="settings-email">Email address</label>
                                <div class="settings-inline-controls"><input id="settings-email" type="email" bind:value={newEmail} required><button type="submit" disabled={busy}>Save</button><button type="button" onclick={() => editingEmail = false}>Cancel</button></div>
                            </form>
                        {/if}
                    </div>
                </section>

                <section class="settings-section">
                    <h2>Personal</h2>
                    <div class="settings-card settings-personal-card">
                        <form onsubmit={e => { e.preventDefault(); save("/user/settings/changebio", { newBio }, "Personal blurb saved."); }}>
                            <label class="settings-visually-hidden" for="settings-bio">Describe yourself</label>
                            <textarea id="settings-bio" bind:value={newBio} maxlength="1000" rows="4" placeholder="Describe yourself (1000 character limit)"></textarea>
                            <p class="settings-help">Do not provide any details that can be used to identify you outside NoneRev.</p>
                            <div class="settings-save-row"><button type="submit" disabled={busy}>Save</button></div>
                        </form>
                    </div>
                </section>

                <section class="settings-section">
                    <h2>Social Networks</h2>
                    <div class="settings-card settings-social-card">
                        <p>Social profile links are not available for NoneRev accounts yet.</p>
                        <label>Facebook<input type="text" placeholder="e.g. www.facebook.com/yourname" disabled></label>
                        <label>Twitter<input type="text" placeholder="e.g. @yourname" disabled></label>
                        <label>YouTube<input type="text" placeholder="e.g. youtube.com/yourchannel" disabled></label>
                    </div>
                </section>
            {:else if tab === "security"}
                <section class="settings-section">
                    <h2>Security</h2>
                    <div class="settings-card settings-security-card">
                        <div class="settings-info-row"><span>Password: <strong>••••••••</strong></span><button type="button" class="settings-edit-icon" onclick={() => editingPassword = !editingPassword}>✎</button></div>
                        {#if editingPassword}
                            <form class="settings-password-form" onsubmit={e => { e.preventDefault(); save("/user/settings/changepassword", { currentPassword, newPassword, confirmPassword }, "Password changed."); }}>
                                <label>Current password<input type="password" bind:value={currentPassword} autocomplete="current-password" required></label>
                                <label>New password<input type="password" bind:value={newPassword} minlength="8" autocomplete="new-password" required></label>
                                <label>Confirm new password<input type="password" bind:value={confirmPassword} minlength="8" autocomplete="new-password" required></label>
                                <button type="submit" disabled={busy}>Change Password</button>
                            </form>
                        {/if}
                    </div>
                </section>
            {:else if tab === "invites"}
                <section class="settings-section">
                    <h2>Invites</h2>
                    <div class="settings-card settings-invite-card">
                        <p>Generate a single-use invite key for someone joining NoneRev.</p>
                        <button type="button" disabled={busy} onclick={generate}>Generate Invite Key</button>
                        {#if inviteKey}<div class="settings-invite-result"><input aria-label="Invite key" value={inviteKey} readonly><button type="button" onclick={copy}>Copy</button></div>{/if}
                    </div>
                </section>
            {:else}
                <section class="settings-section">
                    <h2>{tabs.find(item => item.id === tab)?.label}</h2>
                    <div class="settings-card settings-empty-card">There are no {tabs.find(item => item.id === tab)?.label.toLowerCase()} options for this account yet.</div>
                </section>
            {/if}
        </div>
    </div>
</main>
