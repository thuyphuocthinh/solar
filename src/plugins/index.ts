import type { App } from "vue";
import { setupTippy } from "./v-tippy.plugin";
import { setupNotifications } from "./vue-notification.plugin";

export const registerPlugins = (app: App) => {
  setupTippy(app);
  setupNotifications(app);
};
