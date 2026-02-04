<script setup lang="ts">
import {
  createOsmBuildingsAsync,
  Ion,
  Terrain,
  Viewer,
  Color,
  Cartesian3,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  CallbackProperty,
  PolygonHierarchy,
  Cartographic,
  Math as CesiumMath,
  PolylineDashMaterialProperty,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  initialAddress?: string;
}>();

const emit = defineEmits(["loaded"]);

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESS_TOKEN;

let viewer: Viewer | null = null;
const containerRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (!containerRef.value) return;

  // Initialize the Cesium Viewer
  viewer = new Viewer(containerRef.value, {
    terrain: Terrain.fromWorldTerrain(),
    animation: false,
    timeline: false,
    geocoder: true, // Keep geocoder for subsequent searches
  });

  // Enable depth testing so pickPosition works on terrain/buildings
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // Add Cesium OSM Buildings
  const buildingTileset = await createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildingTileset);

  // Emit loaded event
  emit("loaded");

  // Fly to initial address if provided
  if (props.initialAddress) {
    // We use the geocoder view model to search which handles the coordinate lookup and flying
    console.log(props.initialAddress);
    const geocoderViewModel = viewer.geocoder.viewModel;
    geocoderViewModel.searchText = props.initialAddress;
    await (geocoderViewModel.search as any)();
  }
});

onUnmounted(() => {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
  if (handler) {
    handler.destroy();
    handler = null;
  }
});

const isDrawing = ref(false);
const points = ref<Cartesian3[]>([]);
const drawingType = ref<"polygon" | "line">("polygon");
const isFill = ref(true);
const isDashed = ref(false);

let handler: ScreenSpaceEventHandler | null = null;
let activeShapePoints: Cartesian3[] = []; // Internal mutable array for performance

function toggleDrawing() {
  if (isDrawing.value) {
    stopDrawing();
  } else {
    startDrawing();
  }
}

function startDrawing() {
  if (!viewer) return;
  isDrawing.value = true;
  activeShapePoints = [];
  points.value = [];

  // Initialize Handler
  handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  // 1. Left Click: Add Point
  handler.setInputAction((event: any) => {
    // We use pickPosition to get the exact point on terrain/buildings
    // Note: depthTestAgainstTerrain must be assumed on or handled
    const earthPosition = viewer!.scene.pickPosition(event.position);

    if (earthPosition) {
      if (activeShapePoints.length === 0) {
        // First point: Create the floating point (cursor follower)
        // floatingPoint = createPoint(earthPosition);
        activeShapePoints.push(earthPosition);

        // Create the dynamic polygon
        const dynamicPositions = new CallbackProperty(() => {
          if (drawingType.value === "polygon") {
            return new PolygonHierarchy(activeShapePoints);
          }
          return activeShapePoints;
        }, false);

        drawShape(dynamicPositions);
      }

      activeShapePoints.push(earthPosition);
      points.value = [...activeShapePoints]; // Update reactive state for UI
      createPoint(earthPosition); // Visual marker for the node
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  // 2. Mouse Move: Update the logical "last point" to follow cursor
  handler.setInputAction((event: any) => {
    if (activeShapePoints.length === 0) return;

    const newPosition = viewer!.scene.pickPosition(event.endPosition);
    if (newPosition) {
      // Remove the previous "floating" point and replace with new one
      activeShapePoints.pop();
      activeShapePoints.push(newPosition);
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  // 3. Right Click: Finish Drawing
  handler.setInputAction(() => {
    stopDrawing();
  }, ScreenSpaceEventType.RIGHT_CLICK);

  // Disable default camera controls if needed, usually fine to keep them but user needs to be careful
  viewer.scene.screenSpaceCameraController.enableInputs = false;
}

function stopDrawing() {
  isDrawing.value = false;

  if (handler) {
    handler.destroy();
    handler = null;
  }

  // Terminate the shape (remove the floating point)
  activeShapePoints.pop();

  // Log the final coordinates
  const finalPoints = activeShapePoints.map((cartesian) => {
    const cartographic = Cartographic.fromCartesian(cartesian);
    return {
      longitude: CesiumMath.toDegrees(cartographic.longitude),
      latitude: CesiumMath.toDegrees(cartographic.latitude),
      height: cartographic.height,
    };
  });
  console.log("Final Polygon Coordinates:", finalPoints);

  // In a real app, you might want to finalize the polygon entity here (replace CallbackProperty with static)
  // For now, we leave the "activeShape" as is, or we could "bake" it.

  if (viewer) {
    viewer.scene.screenSpaceCameraController.enableInputs = true;
  }
}

function createPoint(worldPosition: Cartesian3) {
  const point = viewer!.entities.add({
    position: worldPosition,
    point: {
      color: Color.YELLOW,
      pixelSize: 10,
      heightReference: 1, // CLAMP_TO_GROUND if using Terrain
    },
  });
  return point;
}

function drawShape(positionData: CallbackProperty) {
  const shape: any = {};

  const dashedMaterial = new PolylineDashMaterialProperty({
    color: Color.YELLOW,
  });

  if (drawingType.value === "line") {
    shape.polyline = {
      positions: positionData,
      clampToGround: true,
      width: 3,
      material: isDashed.value ? dashedMaterial : Color.YELLOW,
    };
  } else {
    // Polygon
    shape.polygon = {
      hierarchy: positionData,
      fill: isFill.value,
      material: Color.YELLOW.withAlpha(0.2),
      outline: false, // We use the polyline below for the outline to support dashing
    };

    // Add an outline looping around
    // Note: For dynamic drawing, passing the same CallbackProperty (which returns PolygonHierarchy)
    // to polyline.positions (which expects Cartesian3[]) might fail or be weird.
    // We should create a specific CallbackProperty for the polyline that allows closing the loop.

    // However, simply using the points array works for open lines. For closing the loop visually during draw:
    shape.polyline = {
      positions: new CallbackProperty(() => {
        // For polygon outline, we want it to look closed or just follow the points
        // Standard behavior: just follow points. The polygon fill shows the closure.
        // If we want the outline to close, we'd need to append the first point to the end.
        return [...activeShapePoints, activeShapePoints[0]];
      }, false),
      clampToGround: true,
      width: 3,
      material: isDashed.value ? dashedMaterial : Color.YELLOW,
    };
  }

  return viewer!.entities.add(shape);
}
</script>

<template>
  <div class="relative w-full h-full">
    <div ref="containerRef" class="w-full h-full"></div>
    <div class="absolute top-0 left-0 p-4 z-10">
      <!-- Slot for overlay content like back button -->
      <slot></slot>

      <div
        class="mt-12 space-y-2 bg-white/90 p-3 rounded shadow-lg backdrop-blur-sm"
      >
        <div class="flex flex-col gap-2 mb-2">
          <label class="text-sm font-semibold text-gray-700"
            >Drawing Options</label
          >

          <!-- Shape Type -->
          <select
            v-model="drawingType"
            class="p-1 border rounded text-sm bg-white"
            :disabled="isDrawing"
          >
            <option value="polygon">Polygon</option>
            <option value="line">Line</option>
          </select>

          <!-- Options -->
          <div class="flex items-center gap-4 text-sm text-gray-800">
            <label
              v-if="drawingType === 'polygon'"
              class="flex items-center gap-1 cursor-pointer"
            >
              <input type="checkbox" v-model="isFill" :disabled="isDrawing" />
              Fill
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" v-model="isDashed" :disabled="isDrawing" />
              Dashed
            </label>
          </div>
        </div>

        <button
          @click="toggleDrawing"
          class="w-full bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition font-medium"
        >
          {{ isDrawing ? "Cancel Drawing" : "Start Drawing" }}
        </button>

        <div
          v-if="points.length > 0"
          class="bg-black/50 text-white p-2 rounded text-sm"
        >
          Points: {{ points.length }} (Right-click to finish)
        </div>
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
