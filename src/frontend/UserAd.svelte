<script lang="ts">
    import { api } from "./api";

    let { size, class: extra = "" }: {
        size: "banner" | "skyscraper" | "rectangle";
        class?: string;
    } = $props();

    let ad = $state<any>(null);

    $effect(() => {
        ad = null;
        api(`/ads/serve?size=${size}`).then(d => {
            ad = d?.image ? d : null;
        }).catch(() => {});
    });
</script>

<svelte:head>
    <link rel="stylesheet" href="/css/ads.css">
</svelte:head>

{#if ad}
    <div class="user-ad user-ad-{size} {extra}">
        <a class="user-ad-link" href={ad.click} title={ad.name}>
            <img src={ad.image} alt={ad.name} width={ad.width} height={ad.height}>
        </a>
        <div class="user-ad-annotations">
            <span class="user-ad-identification">Advertisement</span>
            <a class="user-ad-report" href={ad.report} title="click to report an offensive ad">Report</a>
        </div>
    </div>
{/if}
