<script lang="ts">
    import { api } from "../api";
    import { session } from "../session.svelte";
    import { router } from "../router.svelte";
    import PrivacyPolicy from "./PrivacyPolicy.svelte";

    type SocialType = "discord" | "twitter" | "youtube";

    type RetentionItem = {
        description: string;
        retention: string;
        legal_basis: string;
    };

    type RetentionInfo = {
        policy_version: string;
        last_updated: string;
        retention_periods: Record<string, RetentionItem>;
        user_rights: Record<string, string>;
        contact: Record<string, string>;
    };

    const socials: { id: SocialType; title: string; blurb: string }[] = [
        {
            id: "discord",
            title: "Show my Discord on my profile",
            blurb: "When off, your Discord handle is hidden from everyone except you."
        },
        {
            id: "twitter",
            title: "Show my Twitter/X on my profile",
            blurb: "When off, your Twitter/X handle is hidden from everyone except you."
        },
        {
            id: "youtube",
            title: "Show my YouTube on my profile",
            blurb: "When off, your YouTube handle is hidden from everyone except you."
        }
    ];

    let notice = $state<{ text: string; ok: boolean } | null>(null);
    let busy = $state(false);
    let error = $state("");

    let restricted = $state(false);
    let socialsVisible = $state<Record<SocialType, boolean>>({
        discord: true,
        twitter: true,
        youtube: true
    });

    let retention = $state<RetentionInfo | null>(null);
    let retentionLoading = $state(false);

    let deletePassword = $state("");
    let deleteConfirm = $state("");

    const syncFromSession = () => {
        const me = session.me;
        if (!me) return;
        restricted = !!me.processing_restricted;
        socialsVisible = {
            discord: me.social_visibility?.discord !== false,
            twitter: me.social_visibility?.twitter !== false,
            youtube: me.social_visibility?.youtube !== false
        };
    };

    syncFromSession();
    $effect(() => {
        syncFromSession();
    });

    const flash = (text: string, ok = true) => {
        notice = { text, ok };
    };

    const fail = (err: unknown) => {
        flash(err instanceof Error ? err.message : "Something went wrong.", false);
    };

    $effect(() => {
        if (!notice) return;
        const timer = setTimeout(() => notice = null, 5000);
        return () => clearTimeout(timer);
    });

    const setRestricted = async (value: boolean) => {
        const previous = restricted;
        restricted = value;
        busy = true;
        try {
            await api("/user/privacy/restrict", { restrict: value });
            await session.refresh();
            flash(value ? "Processing restricted." : "Processing restriction lifted.");
        } catch (err) {
            restricted = previous;
            fail(err);
        } finally {
            busy = false;
        }
    };

    const setSocialVisible = async (type: SocialType, visible: boolean) => {
        const previous = socialsVisible[type];
        socialsVisible[type] = visible;
        busy = true;
        try {
            await api("/user/privacy/rectify", {
                social_visibility: { [type]: visible }
            }, "PATCH");
            await session.refresh();
            flash(visible ? "Link is now visible on your profile." : "Link is now hidden from your profile.");
        } catch (err) {
            socialsVisible[type] = previous;
            fail(err);
        } finally {
            busy = false;
        }
    };

    const exportData = async () => {
        busy = true;
        try {
            const res = await fetch("/api/user/privacy/export");
            if (!res.ok) {
                let message = "Export failed.";
                try {
                    message = (await res.json()).error ?? message;
                } catch {
                    // response was not json
                }
                throw new Error(message);
            }
            const blob = await res.blob();
            const disposition = res.headers.get("content-disposition") ?? "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match?.[1] ?? "nonerev-data-export.json";
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            flash("Your data export is downloading.");
        } catch (err) {
            fail(err);
        } finally {
            busy = false;
        }
    };

    const loadRetention = async () => {
        if (retention) {
            retention = null;
            return;
        }
        retentionLoading = true;
        try {
            retention = await api<RetentionInfo>("/user/privacy/retention");
        } catch (err) {
            fail(err);
        } finally {
            retentionLoading = false;
        }
    };

    const retentionRows = $derived(retention ? Object.entries(retention.retention_periods) : []);
    const canDelete = $derived(deleteConfirm.trim() === "DELETE MY ACCOUNT" && deletePassword.length > 0 && !busy);

    const deleteAccount = async () => {
        if (!canDelete) return;
        busy = true;
        error = "";
        try {
            await api("/user/settings/deleteaccount", {
                password: deletePassword,
                confirm: deleteConfirm.trim()
            });
            await session.refresh();
            router.replace("/");
        } catch (err) {
            error = err instanceof Error ? err.message : "Account deletion failed.";
            busy = false;
        }
    };
</script>

<svelte:head>
    <title>Privacy &amp; Data - NoneRev</title>
    <link rel="stylesheet" href="/css/tos.css">
    <link rel="stylesheet" href="/css/settings.css">
    <link rel="stylesheet" href="/css/privacy.css">
</svelte:head>

{#if session.me}
    <main class="settings-page privacy-page">
        <h1>Privacy &amp; Data</h1>

        {#if notice}
            <div class="settings-alert" class:error={!notice.ok} role="status">{notice.text}</div>
        {/if}

        <div class="settings-card privacy-intro">
            <p>NoneRev only collects what it needs to run your account, your games and the community around them. Here you can see what we hold, download a copy, control who can see your social links, restrict how we use your data, and delete your account.</p>
            <p class="settings-hint">These controls support your rights under the EU GDPR and Thailand's Personal Data Protection Act (PDPA). You can read the full <a class="settings-link" href="/info/privacy#policy">privacy policy</a> at the bottom of this page.</p>
        </div>

        <h3>Your data</h3>
        <div class="privacy-grid">
            <div class="settings-card privacy-tile">
                <h4>Download your data</h4>
                <p>Get a machine readable JSON file with your profile, games, uploaded assets, messages, trades and activity.</p>
                <button type="button" class="settings-btn" disabled={busy} onclick={exportData}>Download my data</button>
            </div>
            <div class="settings-card privacy-tile">
                <h4>Correct your information</h4>
                <p>Fix your blurb, social links, theme or profile details from your account settings at any time.</p>
                <a class="settings-btn" href="/my/settings?tab=account">Open account settings</a>
            </div>
        </div>

        <h3>Profile visibility</h3>
        <div class="settings-card">
            {#each socials as item (item.id)}
                <label class="privacy-toggle">
                    <span class="privacy-toggle-text">
                        <strong>{item.title}</strong>
                        <span class="settings-hint">{item.blurb}</span>
                    </span>
                    <input
                        type="checkbox"
                        checked={socialsVisible[item.id]}
                        disabled={busy}
                        aria-label={item.title}
                        onchange={e => setSocialVisible(item.id, e.currentTarget.checked)}
                    >
                </label>
            {/each}
        </div>

        <h3>Restrict processing</h3>
        <div class="settings-card">
            <label class="privacy-toggle">
                <span class="privacy-toggle-text">
                    <strong>Restrict processing</strong>
                    <span class="settings-hint">Ask us to pause any use of your data that is not strictly required to keep your account and games working.</span>
                </span>
                <input
                    type="checkbox"
                    checked={restricted}
                    disabled={busy}
                    aria-label="Restrict processing"
                    onchange={e => setRestricted(e.currentTarget.checked)}
                >
            </label>
        </div>

        <h3>Data retention</h3>
        <div class="settings-card">
            <div class="settings-split">
                <p>See how long each kind of data is kept and the lawful basis for keeping it.</p>
                <button type="button" class="settings-btn" disabled={retentionLoading} onclick={loadRetention}>
                    {retention ? "Hide schedule" : retentionLoading ? "Loading…" : "Show schedule"}
                </button>
            </div>
            {#if retention}
                <table class="privacy-table">
                    <thead>
                        <tr>
                            <th scope="col">Category</th>
                            <th scope="col">Retention</th>
                            <th scope="col">Lawful basis</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each retentionRows as [key, item] (key)}
                            <tr>
                                <th scope="row">{key.replace(/_/g, " ")}</th>
                                <td>{item.retention}</td>
                                <td>{item.legal_basis}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>

        <h3>Your rights</h3>
        <div class="settings-card privacy-rights">
            <ul>
                <li><strong>Access &amp; portability</strong> – download a copy of your data above (GDPR Art. 15/20, PDPA Sec. 30).</li>
                <li><strong>Rectification</strong> – correct inaccurate data from your account settings (GDPR Art. 16, PDPA Sec. 31).</li>
                <li><strong>Restriction</strong> – ask us to pause non-essential use of your data with the switch above (GDPR Art. 18, PDPA Sec. 32).</li>
                <li><strong>Objection</strong> – email <a class="settings-link" href="mailto:privacy@nonerev.de">privacy@nonerev.de</a> to object to processing based on our legitimate interests (GDPR Art. 21, PDPA Sec. 33).</li>
                <li><strong>Erasure</strong> – delete your account and content below (GDPR Art. 17, PDPA Sec. 34).</li>
                <li><strong>Withdraw consent</strong> – hide a social link again at any time above (GDPR Art. 7(3), PDPA Sec. 27).</li>
                <li><strong>Complain</strong> – raise a concern with us at <a class="settings-link" href="mailto:privacy@nonerev.de">privacy@nonerev.de</a> or with Thailand's PDPC.</li>
            </ul>
        </div>

        <h3 class="privacy-danger-title">Delete account</h3>
        <div class="settings-card privacy-danger">
            <p><strong>This permanently deletes your account, your games and everything you have uploaded.</strong> This cannot be undone. Records we must keep by law (such as moderation and security history) are anonymised rather than kept linked to you.</p>
            {#if error}
                <p class="settings-error" role="alert">{error}</p>
            {/if}
            <label class="settings-field">
                <span class="settings-label">Your password</span>
                <input class="settings-input" type="password" bind:value={deletePassword} autocomplete="current-password">
            </label>
            <label class="settings-field">
                <span class="settings-label">Type "DELETE MY ACCOUNT" to confirm</span>
                <input class="settings-input" type="text" bind:value={deleteConfirm} autocomplete="off" spellcheck="false">
            </label>
            <div class="settings-actions">
                <button type="button" class="settings-btn privacy-danger-btn" disabled={!canDelete} onclick={deleteAccount}>Delete my account</button>
            </div>
        </div>

        <h3 id="policy">Privacy Policy</h3>
        <div class="settings-card">
            <PrivacyPolicy />
        </div>
    </main>
{:else}
    <main class="info-page">
        <div class="info-seal-space"></div>
        <div class="info-privacy policy-wrap">
            <PrivacyPolicy />
            <p class="policy-signin"><a href="/login">Sign in</a> to download your data or delete your account.</p>
        </div>
    </main>
{/if}
