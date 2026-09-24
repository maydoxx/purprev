<script lang="ts">
    let { page, totalPages, url, label = "Pages" }: {
        page: number;
        totalPages: number;
        url: (p: number) => string;
        label?: string;
    } = $props();
</script>

{#if totalPages > 1}
    <nav class="mt-3" aria-label={label}>
        <ul class="pagination pagination-sm justify-content-center">
            {#each { length: totalPages } as _, i}
                <li class="page-item" class:active={i + 1 === page}>
                    <a class="page-link" href={url(i + 1)}>{i + 1}</a>
                </li>
            {/each}
        </ul>
    </nav>
{/if}
