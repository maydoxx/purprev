<script lang="ts">
    import { api } from "./api";

    const styles: Record<string, string> = {
        info: "site-alert-info",
        warning: "site-alert-warning",
        success: "site-alert-success"
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
        <div class="site-alert {styles[b.style] ?? styles.info}" class:site-alert-dismissible={b.dismissible} role="alert" data-banner-key={keyOf(b)}>
            <span class="site-alert-text">{b.message}</span>
            {#if b.linkUrl && b.linkText}
                <a class="site-alert-link" href={b.linkUrl}>{b.linkText}</a>
            {/if}
            {#if b.dismissible}
                <button type="button" class="site-alert-close" aria-label="Dismiss" onclick={() => dismiss(b)}>&times;</button>
            {/if}
        </div>
    {/if}
{/each}
