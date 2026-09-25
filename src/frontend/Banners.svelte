<script lang="ts">
    import { api } from "./api";

    const styles: Record<string, string> = {
        info: "rbx-alert-info",
        warning: "rbx-alert-warning",
        success: "rbx-alert-success"
    };

    let banners = $state<any[]>([]);
    let dismissed = $state<Record<string, boolean>>({});

    const keyOf = (b: any) => `banner-${b.id}-${b.updatedAt}`;

    const closed = (b: any) => {
        try {
            return localStorage.getItem("nonerev-dismissed-" + keyOf(b)) === "1";
        } catch {
            return false;
        }
    };

    api("/site/banners").then(d => {
        banners = Array.isArray(d) ? d : [];
    }).catch(() => {});

    const dismiss = (b: any) => {
        try {
            localStorage.setItem("nonerev-dismissed-" + keyOf(b), "1");
        } catch {}
        dismissed[keyOf(b)] = true;
    };
</script>

{#each banners as b (b.id)}
    {#if !(b.dismissible && (dismissed[keyOf(b)] || closed(b)))}
        <div class="{styles[b.style] ?? styles.info} rbx-site-banner" class:rbx-site-banner-dismissible={b.dismissible} data-banner-key={keyOf(b)}>
            <span class="rbx-site-banner-text">{b.message}</span>
            {#if b.linkUrl && b.linkText}
                <a class="font-bold rbx-site-banner-link" href={b.linkUrl}>{b.linkText}</a>
            {/if}
            {#if b.dismissible}
                <button type="button" class="rbx-site-banner-close" aria-label="Dismiss" onclick={() => dismiss(b)}>&times;</button>
            {/if}
        </div>
    {/if}
{/each}
