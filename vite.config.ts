import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    plugins: [
        svelte()
    ],

    server: {
        proxy: {

            "/api": process.env.API_URL ?? "http://localhost:3000",
            "/uploads": process.env.API_URL ?? "http://localhost:3000",

            "^/(Game|game|Asset|asset|Setting|user|Friend|Badges|login|IDE|ide|Data|UI|My|my/places|universes|developerproducts)/": process.env.API_URL ?? "http://localhost:3000",
            "^/(marketplace|ownership|currency|persistence|thumbs|moderation|mobileapi|UserCheck|Login|device|notifications|sponsoredpage|v1\\.1|my/account|setup|discord|games/start|pe\\.png|Asset|asset)(/|$)": process.env.API_URL ?? "http://localhost:3000",
            "^/GetAllowed": process.env.API_URL ?? "http://localhost:3000"
        }
    }
});