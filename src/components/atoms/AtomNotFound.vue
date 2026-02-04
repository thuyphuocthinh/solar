<script setup lang="ts">
import AtomIcon from "@/components/atoms/AtomIcon.vue";

defineProps({
  message: {
    type: String,
    default: "No results found",
  },
  title: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "IconSearch",
  },
});
</script>

<template>
  <div
    class="flex flex-col items-center justify-center py-8 text-center animate-fade-in"
  >
    <div class="bg-indigo-50 p-4 rounded-full mb-3">
      <AtomIcon :name="icon" class="text-indigo-400" :width="32" :height="32" />
    </div>
    <h4 v-if="title" class="text-slate-700 font-semibold mb-1">{{ title }}</h4>
    <p class="text-slate-500 text-sm">{{ message }}</p>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
