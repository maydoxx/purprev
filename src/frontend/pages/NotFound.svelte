<script lang="ts">
    const back = (e: Event) => {
        e.preventDefault();
        history.back();
    };
</script>

<svelte:head>
    <title>404 Not Found - NoneRev</title>
    <link rel="stylesheet" href="/css/errors.css">
</svelte:head>

<main class="error-page">
    <div class="error-container">
        <img src="/img/builder.png" alt="Alert">
        <h1>Requested page not found</h1>
        <h3>You may have clicked an expired link or mistyped the address.</h3>
        <div class="error-divider"></div>
        <div class="error-actions">
            <a class="error-btn" href="/home" onclick={back}>Go to Previous Page</a>
            <a class="error-btn" href="/">Return Home</a>
        </div>
    </div>
</main>
