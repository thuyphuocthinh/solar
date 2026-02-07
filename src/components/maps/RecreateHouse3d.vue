<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import {
  useThreeJs,
  type HouseData,
  type ThreeJsColors,
} from "@/composables/useThreeJs";

const props = defineProps<{
  houseData?: HouseData | null;
  colors?: Partial<ThreeJsColors>;
}>();

const emit = defineEmits(["loaded"]);

const containerRef = ref<HTMLElement | null>(null);

const {
  isInitialized,
  initThreeJs,
  dispose,
  createHouse,
  clearHouse,
  updateColors,
  focusOn,
} = useThreeJs();

let resizeObserver: ResizeObserver | null = null;

const renderHouse = () => {
  if (!isInitialized.value || !props.houseData) return;

  clearHouse();
  createHouse(props.houseData, props.colors);

  // Focus on the center of the house
  if (props.houseData.corners.length > 0) {
    const center = {
      x:
        props.houseData.corners.reduce((sum, c) => sum + c.x, 0) /
        props.houseData.corners.length,
      y:
        props.houseData.corners.reduce((sum, c) => sum + c.y, 0) /
        props.houseData.corners.length,
      z:
        props.houseData.corners.reduce((sum, c) => sum + c.z, 0) /
        props.houseData.corners.length,
    };
    focusOn(center, 25);
  }
};

// Watch for house data changes
watch(
  () => props.houseData,
  () => {
    renderHouse();
  },
  { deep: true },
);

// Watch for color changes
watch(
  () => props.colors,
  (newColors) => {
    if (newColors) {
      updateColors(newColors);
    }
  },
  { deep: true },
);

onMounted(() => {
  if (!containerRef.value) return;

  resizeObserver = initThreeJs(containerRef.value);
  emit("loaded");

  // Render if data already provided
  if (props.houseData) {
    renderHouse();
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  dispose();
});
</script>

<template>
  <div class="recreate-house-3d">
    <div ref="containerRef" class="three-container"></div>

    <!-- Controls Overlay -->
    <div class="controls-overlay">
      <div class="control-hint">
        <span class="hint-icon">🖱️</span>
        <span>Drag to rotate • Scroll to zoom • Right-click to pan</span>
      </div>
    </div>

    <!-- Legend -->
    <div class="legend">
      <div class="legend-item">
        <span class="legend-color" style="background: #cc4444"></span>
        <span>Roof</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #f5f5dc"></span>
        <span>Walls</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #ffcc00"></span>
        <span>Slope Angle</span>
      </div>
    </div>

    <!-- Axes Legend -->
    <div class="axes-legend">
      <div class="axis-item">
        <span class="axis-color" style="background: #ff4444"></span>
        <span>X (East)</span>
      </div>
      <div class="axis-item">
        <span class="axis-color" style="background: #44ff44"></span>
        <span>Y (Up)</span>
      </div>
      <div class="axis-item">
        <span class="axis-color" style="background: #4444ff"></span>
        <span>Z (North)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recreate-house-3d {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: #1a1a2e;
  border-radius: 12px;
  overflow: hidden;
}

.three-container {
  width: 100%;
  height: 100%;
}

.controls-overlay {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.control-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 20px;
  color: #aaa;
  font-size: 12px;
  backdrop-filter: blur(4px);
}

.hint-icon {
  font-size: 14px;
}

.legend {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  backdrop-filter: blur(4px);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 12px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.axes-legend {
  position: absolute;
  bottom: 60px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  backdrop-filter: blur(4px);
}

.axis-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 11px;
}

.axis-color {
  width: 12px;
  height: 3px;
  border-radius: 1px;
}
</style>
