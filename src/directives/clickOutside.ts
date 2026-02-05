import type { Directive, DirectiveBinding } from "vue";

interface ClickOutsideElement extends HTMLElement {
  _clickOutsideHandler?: (event: MouseEvent) => void;
}

/**
 * v-click-outside directive
 * Detects clicks outside of the element and triggers a callback
 *
 * Usage:
 * <div v-click-outside="handleClickOutside">...</div>
 *
 * Or with options:
 * <div v-click-outside="{ handler: handleClickOutside, exclude: ['.exclude-class'] }">...</div>
 */
const clickOutside: Directive = {
  mounted(el: ClickOutsideElement, binding: DirectiveBinding) {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside the element
      if (!el.contains(target) && el !== target) {
        // Handle options object or direct function
        if (typeof binding.value === "function") {
          binding.value(event);
        } else if (binding.value?.handler) {
          // Check for excluded elements
          const exclude = binding.value.exclude || [];
          const isExcluded = exclude.some((selector: string) => {
            const excludedEl = document.querySelector(selector);
            return excludedEl && excludedEl.contains(target);
          });

          if (!isExcluded) {
            binding.value.handler(event);
          }
        }
      }
    };

    el._clickOutsideHandler = handler;
    document.addEventListener("click", handler, true);
  },

  unmounted(el: ClickOutsideElement) {
    if (el._clickOutsideHandler) {
      document.removeEventListener("click", el._clickOutsideHandler, true);
      delete el._clickOutsideHandler;
    }
  },
};

export default clickOutside;
