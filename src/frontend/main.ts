import { mount } from "svelte";
import App from "./App.svelte";
import { followTheme } from "./theme.svelte";
import { consoleBanner } from "./console";

followTheme();
consoleBanner();

mount(App, {
    target: document.getElementById("app")!
});
