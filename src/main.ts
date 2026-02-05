import { createApp } from "vue";
import "@/assets/styles/style.css";
import App from "./App.vue";
import router from "./router";
import { registerPlugins } from "@/plugins";
import { registerDirectives } from "@/directives";

const app = createApp(App);

registerDirectives(app);
registerPlugins(app);

app.use(router);
app.mount("#app");
