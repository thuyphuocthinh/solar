import { createApp } from "vue";
import "@/assets/styles/style.css";
import App from "./App.vue";
import router from "./router";
import { setupTippy } from "@/plugins/v-tippy.plugin";

const app = createApp(App);

setupTippy(app);

app.use(router);
app.mount("#app");
