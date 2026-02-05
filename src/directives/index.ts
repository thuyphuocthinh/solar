import type { App } from "vue";
import clickOutside from "./clickOutside";

/**
 * Register all custom directives globally
 */
export function registerDirectives(app: App) {
  app.directive("click-outside", clickOutside);
}

export { clickOutside };
