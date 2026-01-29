<script setup lang="ts">
defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
  customClass: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close"]);

const close = () => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
        @click.self="close"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all relative overflow-hidden flex flex-col"
          :class="customClass"
        >
          <!-- Header (Optional) -->
          <div
            v-if="title || $slots.header"
            class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10"
          >
            <h3 v-if="title" class="text-xl font-bold text-slate-800">
              {{ title }}
            </h3>
            <slot name="header"></slot>
            <button
              @click="close"
              class="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <span class="text-2xl leading-none">&times;</span>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 relative overflow-auto hide-scrollbar">
            <slot></slot>
          </div>

          <!-- Footer (Optional) -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 border-t border-slate-100 bg-slate-50 mt-auto"
          >
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Premium easing for modal entry */
.modal-fade-enter-active {
  transition: all 0.1s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active {
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-fade-enter-to,
.modal-fade-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
