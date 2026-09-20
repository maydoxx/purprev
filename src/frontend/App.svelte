<script lang="ts">
    let message = "Loading...";

    fetch("/api/meow")
        .then(response => response.json())
        .then(data => {
            message = data.message;
        });
</script>

<h1>NoneRev</h1>
<p>{message}</p>