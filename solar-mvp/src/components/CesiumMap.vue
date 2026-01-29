<script setup lang="ts">
import { createOsmBuildingsAsync, Ion, Terrain, Viewer } from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
    initialAddress?: string
}>();

const emit = defineEmits(['loaded']);

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

    // Add Cesium OSM Buildings
    const buildingTileset = await createOsmBuildingsAsync();
    viewer.scene.primitives.add(buildingTileset);

    // Emit loaded event
    emit('loaded');

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
});
</script>

<template>
    <div class="relative w-full h-full">
        <div ref="containerRef" class="w-full h-full"></div>
        <div class="absolute top-0 left-0 p-4 z-10">
            <!-- Slot for overlay content like back button -->
            <slot></slot>
        </div>
    </div>
</template>

<style scoped>
:deep(.cesium-viewer) {
    width: 100%;
    height: 100%;
}
</style>
