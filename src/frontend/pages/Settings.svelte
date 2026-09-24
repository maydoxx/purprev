<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";

    let tab = $state("account");
    let open = $state<Record<string, boolean>>({});
    let msg = $state<Record<string, { text: string; ok: boolean }>>({});

    let newEmail = $state(session.me?.email ?? "");
    let newBio = $state(session.me?.about ?? "");
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let inviteKey = $state("");

    const send = async (which: string, path: string, body: unknown, done: string) => {
        try {
            await api(path, body);
            msg[which] = {
                text: done,
                ok: true
            };
            await session.refresh();
        } catch (err: any) {
            msg[which] = {
                text: err.message,
                ok: false
            };
        }
    };

    const generate = async () => {
        try {
            inviteKey = (await api("/user/invites/generate", {})).key;
            msg.invite = {
                text: "Invite key generated.",
                ok: true
            };
        } catch (err: any) {
            msg.invite = {
                text: err.message,
                ok: false
            };
        }
    };

    const copy = () => navigator.clipboard.writeText(inviteKey);
</script>

<svelte:head>
    <title>My Settings - NoneRev</title>
    <link rel="stylesheet" href="/css/settings.css">
</svelte:head>

{#snippet message(which: string)}
    <div class="settings-message" class:success={msg[which]?.ok} class:error={msg[which] && !msg[which].ok} style:display={msg[which] ? "block" : "none"}>{msg[which]?.text ?? ""}</div>
{/snippet}

<main class="settings-page" id="user-account">
    <div class="settings-title-row">
        <h1>My Settings</h1>
    </div>

    <div class="settings-layout">
        <aside class="settings-navigation">
            <button type="button" class="settings-nav-item" class:active={tab === "account"} onclick={() => tab = "account"}>Account Info</button>
            <button type="button" class="settings-nav-item" class:active={tab === "security"} onclick={() => tab = "security"}>Security</button>
            <button type="button" class="settings-nav-item" class:active={tab === "invites"} onclick={() => tab = "invites"}>Invites</button>
        </aside>

        <section class="settings-content">
            <div class="settings-panel" class:active={tab === "account"}>
                <div class="settings-panel-header">
                    <h2>Account Info</h2>
                </div>

                <div class="settings-card">
                    <div class="settings-row">
                        <div class="settings-row-main">
                            <div class="settings-label">Username</div>
                            <div class="settings-value">{session.me?.username}</div>
                        </div>
                    </div>

                    <div class="settings-row">
                        <div class="settings-row-main">
                            <div class="settings-label">Email Address</div>
                            <div class="settings-value">{session.me?.email || "Not set"}</div>
                        </div>
                        <button type="button" class="settings-edit-btn" onclick={() => open.email = !open.email}>Edit</button>
                    </div>

                    <div class="settings-editor" style:display={open.email ? "block" : "none"}>
                        <form onsubmit={e => { e.preventDefault(); send("email", "/user/settings/changeemail", { newEmail }, "Email updated."); }}>
                            <label for="newEmail">Email Address</label>
                            <input type="email" id="newEmail" bind:value={newEmail} required>
                            <div class="settings-editor-actions">
                                <button type="submit" class="settings-save-btn">Save</button>
                                <button type="button" class="settings-cancel-btn" onclick={() => open.email = false}>Cancel</button>
                            </div>
                            {@render message("email")}
                        </form>
                    </div>

                    <div class="settings-row settings-row-bio">
                        <div class="settings-row-main">
                            <div class="settings-label">Personal Blurb</div>
                            <div class="settings-value settings-bio-value" style="white-space: pre-line">{session.me?.about || "No bio yet."}</div>
                        </div>
                        <button type="button" class="settings-edit-btn" onclick={() => open.bio = !open.bio}>Edit</button>
                    </div>

                    <div class="settings-editor" style:display={open.bio ? "block" : "none"}>
                        <form onsubmit={e => { e.preventDefault(); send("bio", "/user/settings/changebio", { newBio }, "Bio updated."); }}>
                            <label for="newBio">Personal Blurb</label>
                            <textarea id="newBio" bind:value={newBio} maxlength="500" rows="5"></textarea>
                            <div class="settings-editor-actions">
                                <button type="submit" class="settings-save-btn">Save</button>
                                <button type="button" class="settings-cancel-btn" onclick={() => open.bio = false}>Cancel</button>
                            </div>
                            {@render message("bio")}
                        </form>
                    </div>
                </div>
            </div>

            <div class="settings-panel" class:active={tab === "security"}>
                <div class="settings-panel-header">
                    <h2>Security</h2>
                </div>

                <div class="settings-card">
                    <div class="settings-row">
                        <div class="settings-row-main">
                            <div class="settings-label">Password</div>
                            <div class="settings-value">********</div>
                        </div>
                        <button type="button" class="settings-edit-btn" onclick={() => open.password = !open.password}>Change</button>
                    </div>

                    <div class="settings-editor" style:display={open.password ? "block" : "none"}>
                        <form onsubmit={e => { e.preventDefault(); send("password", "/user/settings/changepassword", { currentPassword, newPassword, confirmPassword }, "Password changed."); }}>
                            <label for="currentPassword">Current Password</label>
                            <input type="password" id="currentPassword" bind:value={currentPassword} autocomplete="current-password" required>
                            <label for="newPassword">New Password</label>
                            <input type="password" id="newPassword" bind:value={newPassword} minlength="8" autocomplete="new-password" required>
                            <label for="confirmPassword">Confirm New Password</label>
                            <input type="password" id="confirmPassword" bind:value={confirmPassword} minlength="8" autocomplete="new-password" required>
                            <div class="settings-editor-actions">
                                <button type="submit" class="settings-save-btn">Change Password</button>
                                <button type="button" class="settings-cancel-btn" onclick={() => open.password = false}>Cancel</button>
                            </div>
                            {@render message("password")}
                        </form>
                    </div>
                </div>
            </div>

            <div class="settings-panel" class:active={tab === "invites"}>
                <div class="settings-panel-header">
                    <h2>Invites</h2>
                </div>

                <div class="settings-card">
                    <div class="settings-row settings-invite-row">
                        <div class="settings-row-main">
                            <div class="settings-label">Invite Key</div>
                            <div class="settings-value">Generate an invite key to invite someone to NoneRev.</div>
                        </div>
                        <button type="button" class="settings-primary-btn" onclick={generate}>Generate</button>
                    </div>

                    <div class="settings-invite-result" style:display={inviteKey ? "block" : "none"}>
                        <label for="inviteKey">Your Invite Key</label>
                        <div class="settings-key-wrap">
                            <input type="text" id="inviteKey" value={inviteKey} readonly>
                            <button type="button" class="settings-copy-btn" onclick={copy}>Copy</button>
                        </div>
                    </div>
                    <div class="settings-message settings-message-block" class:success={msg.invite?.ok} class:error={msg.invite && !msg.invite.ok} style:display={msg.invite ? "block" : "none"}>{msg.invite?.text ?? ""}</div>
                </div>
            </div>
        </section>
    </div>
</main>
