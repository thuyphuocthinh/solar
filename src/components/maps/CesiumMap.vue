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

const emit = defineEmits(["loaded", "showHouse3d"]);

const containerRef = ref<HTMLElement | null>(null);
const fabricCanvasRef = ref<HTMLCanvasElement | null>(null);
const isToolPopupOpen = ref(false);
const isShapeMade = ref(false);
const currentRoofData = ref<ReturnType<typeof getRoofDataForThreeJS> | null>(
  null,
);

const {
  points,
  clearTool,
  initFabric,
  handleSelectTool,
  clearFabric,
  activeTool,
  makeAndBeautifyShape,
  getSubPolygons,
} = useFabricMap();
const {
  initCesium,
  clearCesium,
  isLoading,
  lockCamera,
  unlockCamera,
  getRoofDataForThreeJS,
  smartPickCartesian,
  getGroundHeight,
  cartesianToCartographic,
} = useCesium();

const toggleToolPopup = () => {
  isToolPopupOpen.value = !isToolPopupOpen.value;
};

const makeShape = async () => {
  lockCamera();
  makeAndBeautifyShape();
  console.log("points: ", points.value);
  console.log("sub polygons: ", getSubPolygons());
  for (const point of points.value) {
    // const cartesian = smartPickCartesian(point);
    // console.log("canvas to cartesian: ", cartesian);
    // const cartographic = cartesianToCartographic(cartesian!);
    // console.log("cartesian to cartographic: ", cartographic);
    // console.log(
    //   "ground height: ",
    //   await getGroundHeight(cartographic!.longitude, cartographic!.latitude),
    // );
  }
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
  isShapeMade.value = false;
  currentRoofData.value = null;
};

const keyboardListener = (e: KeyboardEvent) => {
  if (e.key === "Backspace" || e.key === "Delete") {
    clearTool();
    unlockCamera();
    isShapeMade.value = false;
    currentRoofData.value = null;
  }
};

const handleShowHouse3d = () => {
  if (currentRoofData.value) {
    emit("showHouse3d", currentRoofData.value);
  }
};

const clearShape = () => {
  clearTool();
  unlockCamera();
  isShapeMade.value = false;
  currentRoofData.value = null;
};

onMounted(async () => {
  await initAll();
  document.addEventListener("keydown", keyboardListener);
});

onUnmounted(() => {
  clearAll();
  document.removeEventListener("keydown", keyboardListener);
});
</script>

<template>
  <div class="relative w-full h-full">
    <div ref="containerRef" class="w-full h-full"></div>
    <div class="absolute top-4 left-4 z-40 flex flex-col gap-4">
      <!-- Slot for overlay content like back button -->
      <slot></slot>

      <!-- Tools Button -->
      <div class="relative top-2 left-2">
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
        class="absolute top-6 left-20 z-40 flex gap-2 sm:gap-4"
      >
        <!-- Clear button - hidden after shape made -->
        <AtomButton
          v-if="!isShapeMade"
          @click="clearShape"
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

        <!-- Make shape button - hidden after shape made -->
        <AtomButton
          v-if="!isShapeMade"
          @click="makeShape"
          variant="custom"
          v-tippy="{ content: 'Make Shape', placement: 'top' }"
          custom-class="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 backdrop-blur text-white border border-white/10 hover:bg-indigo-700"
        >
          <AtomIcon
            name="IconShape"
            :width="'20px'"
            :height="'20px'"
            color="white"
          />
        </AtomButton>

        <!-- Show House 3D button - shown after shape made -->
        <AtomButton
          v-if="isShapeMade && currentRoofData"
          @click="handleShowHouse3d"
          variant="custom"
          v-tippy="{ content: 'Show House 3D', placement: 'top' }"
          custom-class="h-10 px-4 flex items-center justify-center gap-2 rounded-full bg-green-600 backdrop-blur text-white border border-white/10 hover:bg-green-700"
        >
          <AtomIcon
            name="IconCube"
            :width="'20px'"
            :height="'20px'"
            color="white"
          />
          <span class="text-sm font-medium">Show 3D</span>
        </AtomButton>

        <!-- Reset button - shown after shape made -->
        <AtomButton
          v-if="isShapeMade"
          @click="clearShape"
          variant="custom"
          v-tippy="{ content: 'Reset', placement: 'top' }"
          custom-class="w-10 h-10 flex items-center justify-center rounded-full bg-red-600 backdrop-blur text-white border border-white/10 hover:bg-red-700"
        >
          <AtomIcon
            name="IconClear"
            :width="'20px'"
            :height="'20px'"
            color="white"
          />
        </AtomButton>
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
