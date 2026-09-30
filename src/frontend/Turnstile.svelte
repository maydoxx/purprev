<script lang="ts">
    let { siteKey, token = $bindable("") }: { siteKey: string; token?: string } = $props();

    let box = $state<HTMLDivElement>();
    let widget = "";

    const loadScript = () => new Promise<void>(resolve => {
        if ((window as any).turnstile) {
            resolve();
            return;
        }
        const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
        if (existing) {
            existing.addEventListener("load", () => resolve());
            return;
        }
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.dataset.turnstile = "1";
        s.addEventListener("load", () => resolve());
        document.head.appendChild(s);
    });

    $effect(() => {
        if (!siteKey || !box) return;
        let gone = false;
        loadScript().then(() => {
            if (gone || !box) return;
            widget = (window as any).turnstile.render(box, {
                sitekey: siteKey,
                theme: "dark",
                callback: (t: string) => token = t,
                "expired-callback": () => token = "",
                "error-callback": () => token = ""
            });
        });
        return () => {
            gone = true;
            if (widget) {
                try {
                    (window as any).turnstile.remove(widget);
                } catch {}
                widget = "";
            }
        };
    });

    export const reset = () => {
        token = "";
        if (widget) {
            try {
                (window as any).turnstile.reset(widget);
            } catch {}
        }
    };
</script>

{#if siteKey}
    <div class="none-auth-turnstile" bind:this={box}></div>
{/if}
