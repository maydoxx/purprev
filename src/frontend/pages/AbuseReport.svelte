<script lang="ts">
    import { api } from "../api";
    import { router } from "../router.svelte";
    import { session } from "../session.svelte";

    const type = $derived(String(router.query.type ?? ""));
    const id = $derived(Number(router.query.id) || 0);

    const rules = [
        "No swear words",
        "No account sharing or trading",
        "No dating - no asking for boyfriends or girlfriends",
        "No asking real life info about each other - no asking for phone numbers or email addresses"
    ];

    let target = $state<any>(null);
    let missing = $state(false);
    let reason = $state("");
    let comment = $state("");
    let error = $state("");
    let sent = $state(false);
    let busy = $state(false);

    $effect(() => {
        if (!session.me) {
            router.replace("/login");
        }
    });

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

<main class="abuse-report-page">
    <h1>Report Abuse</h1>
    {#if missing}
        <div class="abuse-report-column">
            <p class="abuse-report-text">There is nothing to report here.</p>
        </div>
    {:else if !target}
        <div class="abuse-report-column">
            <p class="abuse-report-text">Loading...</p>
        </div>
    {:else if sent}
        <div class="abuse-report-column">
            <div class="abuse-report-header">
                <h2>Thank you for your report.</h2>
            </div>
            <p class="abuse-report-text">Our moderators will review it shortly. We will take action if it breaks the rules.</p>
            <div class="abuse-report-row">
                <a class="abuse-report-btn" href={back}>Continue</a>
            </div>
        </div>
    {:else}
        <form class="abuse-report-column" onsubmit={submit}>
            <div class="abuse-report-header">
                <h2>Tell us how you think {target.name} is breaking the rules of NoneRev.</h2>
            </div>
            <div class="abuse-report-row abuse-report-subject">
                <label for="abuse-reason">Subject:</label>
                <select id="abuse-reason" bind:value={reason}>
                    <option value="">Please select a category</option>
                    {#each target.reasons as r}
                        <option value={r}>{r}</option>
                    {/each}
                </select>
            </div>
            <div class="abuse-report-row abuse-report-comment">
                <label for="abuse-comment">Comment:</label>
                <textarea id="abuse-comment" maxlength="2000" bind:value={comment}></textarea>
            </div>
            {#if error}
                <p class="abuse-report-error">{error}</p>
            {/if}
            <div class="abuse-report-row abuse-report-submit">
                <button class="abuse-report-btn" type="submit" disabled={busy}>Report Abuse</button>
            </div>
            <div class="abuse-report-rules">
                <div class="abuse-report-preface">Not sure if the thing you are trying to report is really against the rules?</div>
                <div class="abuse-report-preface">Some of the basic rules of NoneRev include the following:</div>
                <div class="abuse-report-list">
                    <ul>
                        {#each rules as rule}
                            <li>{rule}</li>
                        {/each}
                    </ul>
                </div>
                <div class="abuse-report-link">
                    <a href="/info/tos">See all rules.</a>
                </div>
                <div class="abuse-report-closing">Users who don't follow the rules will get a warning at first but if they keep it up we may ask them to not come to NoneRev anymore. That way we can keep NoneRev fun and safe!</div>
            </div>
        </form>
    {/if}
</main>
