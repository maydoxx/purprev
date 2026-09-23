import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    plugins: [
        svelte()
    ],

    server: {
        proxy: {
            // API_URL for containers
            "/api": process.env.API_URL ?? "http://localhost:3000"
        }
    }
});