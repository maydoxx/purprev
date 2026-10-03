<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const type = $derived(String(router.query.type ?? ""));
    const id = $derived(Number(router.query.id) || 0);

    const LABELS: Record<string, string> = {
        game: "game",
        user: "user",
        item: "item",
        comment: "comment",
        group: "group"
    };

    let target = $state<any>(null);
    let missing = $state(false);
    let reason = $state("");
    let comment = $state("");
    let error = $state("");
    let sent = $state(false);
    let busy = $state(false);

    $effect(() => {
        target = null;
        missing = false;
        sent = false;
        if (!type || !id) {
            missing = true;
            return;
        }
        api(`/abuse/target?type=${encodeURIComponent(type)}&id=${id}`).then(d => {
            target = d;
        }).catch(() => {
            missing = true;
        });
    });

    const submit = async (e: Event) => {
        e.preventDefault();
        error = "";
        if (!reason) {
            error = "Please select a reason.";
            return;
        }
        if (!comment.trim()) {
            error = "Please describe what happened.";
            return;
        }
        busy = true;
        try {
            await api("/abuse", {
                type,
                id,
                reason,
                comment: comment.trim()
            });
            sent = true;
        } catch (err: any) {
            error = err.message;
        }
        busy = false;
    };

    const back = $derived(target?.url || "/home");
</script>

<svelte:head>
    <title>Report Abuse - NoneRev</title>
    <link rel="stylesheet" href="/css/abusereport.css">
</svelte:head>

<main class="rbx-content">
    <div class="abuse-report-page">
        <div class="container-header">
            <h2>Report Abuse</h2>
        </div>
        {#if missing}
            <div class="section-content-off">There is nothing to report here.</div>
        {:else if !target}
            <div class="section-content">
                <p class="text-label">Loading...</p>
            </div>
        {:else if sent}
            <div class="section-content abuse-report-done">
                <p class="text-lead">Thank you for your report.</p>
                <p>Our moderators will review it shortly. We will take action if it breaks the rules.</p>
                <a class="rbx-btn-secondary-xs" href={back}>Continue</a>
            </div>
        {:else if !session.me}
            <div class="section-content abuse-report-done">
                <p>You must be logged in to report abuse.</p>
                <a class="rbx-btn-secondary-xs" href="/login">Log In</a>
            </div>
        {:else}
            <div class="section-content">
                <form class="abuse-report-form" onsubmit={submit}>
                    <div class="abuse-report-target">
                        <span class="text-label">You are reporting this {LABELS[type] ?? "item"}:</span>
                        {#if target.url}
                            <a class="text-name" href={target.url}>{target.name}</a>
                        {:else}
                            <span class="text-lead">{target.name}</span>
                        {/if}
                    </div>
                    <div class="abuse-report-field">
                        <label class="text-label" for="abuse-reason">Please select the reason for reporting:</label>
                        <select id="abuse-reason" class="abuse-report-select" bind:value={reason}>
                            <option value="">Please select a reason</option>
                            {#each target.reasons as r}
                                <option value={r}>{r}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="abuse-report-field">
                        <label class="text-label" for="abuse-comment">Please provide a short comment on the abuse:</label>
                        <textarea id="abuse-comment" class="abuse-report-comment" rows="6" maxlength="2000" bind:value={comment}></textarea>
                        <span class="abuse-report-count">{comment.length}/2000</span>
                    </div>
                    {#if error}
                        <p class="text-error">{error}</p>
                    {/if}
                    <div class="abuse-report-actions">
                        <button class="rbx-btn-secondary-xs" type="submit" disabled={busy}>Submit</button>
                        <a class="rbx-btn-control-xs" href={back}>Cancel</a>
                    </div>
                    <p class="abuse-report-note">Abusing the report system wastes moderator time and can get your own account moderated.</p>
                </form>
            </div>
        {/if}
    </div>
</main>
