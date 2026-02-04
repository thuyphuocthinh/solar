<script setup lang="ts">
import AtomIcon from "@/components/atoms/AtomIcon.vue";

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(["close", "select-tool"]);

const tools = [
  {
    type: "polygon",
    label: "Manual Draw",
    icon: "IconCustom", // Assuming IconEdit exists or generic pencil
    desc: "Draw points to create a custom shape",
  },
  {
    type: "frame",
    label: "Auto Frame",
    icon: "IconLayout", // Assuming IconLayout or generic
    desc: "Use a 4-roof frame template",
  },
];

const selectTool = (toolId: string) => {
  emit("select-tool", toolId);
  emit("close");
};
</script>

<template>
  <div v-if="isOpen" class="absolute left-16 top-0 z-50">
    <div
      class="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-2 w-64 flex flex-col gap-1"
    >
      <button
        v-for="tool in tools"
        :key="tool.type"
        @click="selectTool(tool.type)"
        class="flex items-start gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors group text-left w-full"
      >
        <div
          class="mt-1 p-1.5 rounded-md bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors"
        >
          <!-- Fallback icon container if specific icon not found, simplistic for now -->
          <AtomIcon :name="tool.icon" size="18" />
        </div>
        <div>
          <span
            class="block text-sm font-semibold text-slate-200 group-hover:text-white"
            >{{ tool.label }}</span
          >
          <span class="block text-xs text-slate-400 leading-tight">{{
            tool.desc
          }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
