import type { App } from "vue";
import Notifications from "@kyvg/vue3-notification";

export const setupNotifications = (app: App) => {
  app.use(Notifications);
};
