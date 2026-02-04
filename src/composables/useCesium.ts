import { ref, shallowRef } from "vue";
import { Ion, Terrain, Viewer, Cartesian3, Math as CesiumMath } from "cesium";

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESS_TOKEN;

interface InitCesiumOptions {
  container: HTMLElement;
  initialCoordinates?: {
    longitude: number;
    latitude: number;
    height?: number;
  } | null;
  initialAddress?: string;
  onLoaded?: () => void;
}

export function useCesium() {
  const viewer = shallowRef<Viewer | null>(null);
  const isLoading = ref(true);

  const initCesium = async (options: InitCesiumOptions) => {
    if (!options.container) return;

    // Initialize the Cesium Viewer
    viewer.value = new Viewer(options.container, {
      terrain: Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: true,
      fullscreenButton: true,
      creditContainer: document.createElement("div"), // Hide the logo/credits
    });

    // Enable depth testing so pickPosition works on terrain/buildings
    viewer.value.scene.globe.depthTestAgainstTerrain = true;

    // Trigger loaded callback
    if (options.onLoaded) {
      options.onLoaded();
    }

    // Handle Initial Position
    if (options.initialCoordinates) {
      const { longitude, latitude, height = 300 } = options.initialCoordinates; // Default height 300m for overview

      // Fly to the coordinates looking straight down
      viewer.value.camera.flyTo({
        destination: Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-90), // Look straight down
          roll: 0,
        },
        duration: 2, // Smooth flight
        complete: () => {
          isLoading.value = false;
        },
      });
    } else if (options.initialAddress) {
      // Fly to initial address if provided (fallback)
      const geocoderViewModel = viewer.value.geocoder.viewModel;
      geocoderViewModel.searchText = options.initialAddress;
      await (geocoderViewModel.search as any)();
      isLoading.value = false;
    } else {
      isLoading.value = false;
    }
  };

  const clearCesium = () => {
    if (viewer.value) {
      viewer.value.destroy();
      viewer.value = null;
    }
  };

  return {
    viewer,
    isLoading,
    initCesium,
    clearCesium,
  };
}
