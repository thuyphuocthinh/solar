import type { App } from "vue";
import { setupTippy } from "./v-tippy.plugin";

export const registerPlugins = (app: App) => {
  setupTippy(app);
};
