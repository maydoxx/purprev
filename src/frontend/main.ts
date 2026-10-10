import { mount } from "svelte";
import App from "./App.svelte";
import { followTheme } from "./theme.svelte";

followTheme();

mount(App, {
    target: document.getElementById("app")!
});
