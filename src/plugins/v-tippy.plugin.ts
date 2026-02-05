import VueTippy from "vue-tippy";
import "tippy.js/dist/tippy.css";
import type { App } from "vue";

export const setupTippy = (app: App) => {
  app.use(VueTippy, {
    directive: "tippy", // => v-tippy
    component: "tippy", // => <tippy/>
    componentSingleton: "tippy-singleton", // => <tippy-singleton/>,
    defaultProps: {
      placement: "auto-end",
      allowHTML: true,
    },
  });
};
