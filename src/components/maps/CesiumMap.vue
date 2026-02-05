<script setup lang="ts">
import ToolSelectionPopup from "@/components/maps/ToolSelectionPopup.vue";
import AtomIcon from "@/components/atoms/AtomIcon.vue";
import AtomButton from "@/components/atoms/AtomButton.vue";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted, onUnmounted, ref } from "vue";
import { useFabricMap } from "@/composables/useFabricMap";
import { useCesium } from "@/composables/useCesium";

const props = defineProps<{
  initialAddress?: string;
  initialCoordinates?: {
    longitude: number;
    latitude: number;
    height?: number;
  } | null;
}>();

const emit = defineEmits(["loaded"]);

const containerRef = ref<HTMLElement | null>(null);
const fabricCanvasRef = ref<HTMLCanvasElement | null>(null);
const isToolPopupOpen = ref(false);

const {
  points,
  edges,
  clearTool,
  initFabric,
  handleSelectTool,
  clearFabric,
  activeTool,
} = useFabricMap();
const { initCesium, clearCesium, isLoading } = useCesium();

const toggleToolPopup = () => {
  isToolPopupOpen.value = !isToolPopupOpen.value;
};

const initAll = async () => {
  if (!containerRef.value) return;

  await initCesium({
    container: containerRef.value,
    initialCoordinates: props.initialCoordinates,
    initialAddress: props.initialAddress,
    onLoaded: () => emit("loaded"),
  })
    .then(() => {
      if (fabricCanvasRef.value) {
        initFabric(fabricCanvasRef.value);
      }
    })
    .catch((error) => {
      console.error("Error initializing Cesium:", error);
    });
};

const clearAll = () => {
  clearCesium();
  clearFabric();
};

onMounted(async () => {
  await initAll();
});

onUnmounted(() => {
  clearAll();
});
</script>

<template>
  <div class="relative w-full h-full">
    <div ref="containerRef" class="w-full h-full"></div>
    <div class="absolute top-4 left-4 z-40 flex flex-col gap-4">
      <!-- Slot for overlay content like back button -->
      <slot></slot>

      <!-- Tools Button -->
      <div class="relative top-4 left-4">
        <AtomButton
          @click="toggleToolPopup"
          variant="custom"
          custom-class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur text-white border border-white/10 hover:bg-indigo-600 transition-colors"
        >
          <AtomIcon
            name="IconTool"
            :width="'20px'"
            :height="'20px'"
            color="white"
          />
        </AtomButton>

        <ToolSelectionPopup
          :is-open="isToolPopupOpen"
          @close="isToolPopupOpen = false"
          @select-tool="handleSelectTool"
        />
      </div>
    </div>

    <!-- mark selection -->
    <div
      v-show="!isLoading"
      class="absolute inset-0 z-20"
      :class="{ 'pointer-events-none': !activeTool }"
    >
      <canvas ref="fabricCanvasRef"></canvas>

      <!-- Action Buttons -->
      <div
        v-if="activeTool"
        class="absolute top-8 left-[72%] z-40 flex flex-col gap-4"
      >
        <AtomButton
          @click="clearTool"
          variant="custom"
          v-tippy="{ content: 'Clear', placement: 'top' }"
          custom-class="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 backdrop-blur text-white border border-white/10 hover:bg-indigo-700"
        >
          <AtomIcon
            name="IconClear"
            :width="'20px'"
            :height="'20px'"
            color="white"
          />
        </AtomButton>
        <!-- Make shape -->
        <!-- Ground Height -->
        <!-- Show dimensions -->
        <!-- Create 3d -->
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 z-30 flex items-center justify-center bg-slate-900"
    >
      <div class="flex flex-col items-center gap-4">
        <div
          class="animate-spin h-10 w-10 border-4 border-indigo-500 rounded-full border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"
        ></div>
        <p class="text-white font-medium text-lg animate-pulse">
          Loading map...
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.cesium-viewer) {
  width: 100%;
  height: 100%;
}
</style>
