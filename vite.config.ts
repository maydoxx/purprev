import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    plugins: [
        svelte()
    ],

    server: {
        proxy: {
            // API_URL for containers
            "/api": process.env.API_URL ?? "http://localhost:3000",
            "/uploads": process.env.API_URL ?? "http://localhost:3000",
            // the client and rcc talk to the site root, regexes so /game doesnt eat /games and /user/ doesnt eat /user?id=
            "^/(Game|game|Asset|asset|Setting|user|Friend|Badges)/": process.env.API_URL ?? "http://localhost:3000",
            "^/(marketplace|ownership|currency|persistence|thumbs|moderation|mobileapi|UserCheck|Login|device|notifications|sponsoredpage|v1\\.1|my/account|setup|discord|games/start|pe\\.png)(/|$)": process.env.API_URL ?? "http://localhost:3000",
            "^/GetAllowed": process.env.API_URL ?? "http://localhost:3000"
        }
    }
});