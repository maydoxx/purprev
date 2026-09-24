<svelte:head>
    <title>404 Not Found - NoneRev</title>
    <link rel="stylesheet" href="/css/errors.css">
</svelte:head>

    <div class="request-error-page-content">
        <div class="default-error-page">
            <div class="message-container">
                <h3 class="error-title">Page cannot be found or no longer exists</h3>
                <h4 class="error-message">404 <span>|</span>Page Not found</h4>
            </div>
            <img src="/img/builder.png" class="error-image" alt="Builder">
            <div class="action-buttons">
                <a class="btn-primary-md btn-fixed-width" title="Go to Previous Page" href="/home" onclick={e => { e.preventDefault(); history.back(); }}>Back</a>
                <a class="btn-control-md btn-fixed-width" title="Return Home" href="/">Home</a>
            </div>
        </div>
    </div>
