<script lang="ts">
    const back = (e: Event) => {
        e.preventDefault();
        history.back();
    };
</script>

<svelte:head>
    <title>NoneRev</title>
    <link rel="stylesheet" href="/css/errors.css">
</svelte:head>

<main class="error-page">
    <div class="error-page-content">
        <div class="error-card">
            <div class="error-text">
                <h3 class="error-title">Page cannot be found or no longer exists</h3>
                <h4 class="error-message">404 <span>|</span>Page Not found</h4>
            </div>
            <img class="error-image" src="/img/builder.png" alt="Error">
            <div class="error-actions">
                <a class="btn-primary-md error-btn" href="/home" title="Go to Previous Page" onclick={back}>Back</a>
                <a class="error-btn-control error-btn" href="/" title="Return Home">Home</a>
            </div>
        </div>
    </div>
</main>
