import { ref, shallowRef } from "vue";
import {
  Ion,
  Terrain,
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  Cartesian2,
  Cartographic,
} from "cesium";
import { type Edge, type Point } from "./useFabricMap";

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

  /**
   * Convert canvas point to Cartesian by ray
   * @param point Canvas point {x: 823, y: 412}
   * @returns Cartesian position { x: 1334821.42,  y: -4659823.77,  z: 4138296.15 }
   */
  const canvasPointToCartesianByRay = (point: Point) => {
    const scene = viewer.value!.scene;
    const globe = scene.globe;

    const windowPosition = new Cartesian2(point.x, point.y);

    const ray = scene.camera.getPickRay(windowPosition);
    if (!ray) return null;

    return globe.pick(ray, scene) ?? null;
  };

  /**
   * Convert Cartesian to Cartographic
   * @param cartesian Cartesian position { x: 1334821.42,  y: -4659823.77,  z: 4138296.15 }
   * @returns Cartographic position { longitude: 123.45, latitude: 67.89, height: 123456 }
   */
  const cartesianToCartographic = (cartesian: Cartesian3) => {
    const cartographic = Cartographic.fromCartesian(cartesian);
    return {
      longitude: CesiumMath.toDegrees(cartographic.longitude),
      latitude: CesiumMath.toDegrees(cartographic.latitude),
      height: cartographic.height,
    };
  };

  const calculateLineLength = (
    cartesian1: Cartesian3,
    cartesian2: Cartesian3,
  ) => {
    return Cartesian3.distance(cartesian1, cartesian2);
  };

  const calculateTriangleArea = (
    cartesian1: Cartesian3,
    cartesian2: Cartesian3,
    cartesian3: Cartesian3,
  ) => {
    const a = calculateLineLength(cartesian1, cartesian2);
    const b = calculateLineLength(cartesian2, cartesian3);
    const c = calculateLineLength(cartesian3, cartesian1);
    const s = (a + b + c) / 2;
    return Math.sqrt(s * (s - a) * (s - b) * (s - c));
  };

  const calculateQuadrilateralArea = (
    cartesian1: Cartesian3,
    cartesian2: Cartesian3,
    cartesian3: Cartesian3,
    cartesian4: Cartesian3,
  ) => {
    const a = calculateTriangleArea(cartesian1, cartesian2, cartesian3);
    const b = calculateTriangleArea(cartesian1, cartesian3, cartesian4);
    return a + b;
  };

  const calculateShapeArea = (edges: Edge[]) => {
    const numEdges = edges.length;

    if (numEdges === 3) {
      return calculateTriangleArea(
        canvasPointToCartesianByRay(edges[0]!.from)!,
        canvasPointToCartesianByRay(edges[0]!.to)!,
        canvasPointToCartesianByRay(edges[1]!.to)!,
      );
    }
    if (numEdges === 4) {
      return calculateQuadrilateralArea(
        canvasPointToCartesianByRay(edges[0]!.from)!,
        canvasPointToCartesianByRay(edges[0]!.to)!,
        canvasPointToCartesianByRay(edges[1]!.to)!,
        canvasPointToCartesianByRay(edges[2]!.to)!,
      );
    }
    return 0;
  };

  const lockCamera = () => {
    const c = viewer.value!.scene.screenSpaceCameraController;
    c.enableRotate = false;
    c.enableZoom = false;
    c.enableTranslate = false;
    c.enableTilt = false;
    c.enableLook = false;
  };

  const unlockCamera = () => {
    const c = viewer.value!.scene.screenSpaceCameraController;
    c.enableRotate = true;
    c.enableZoom = true;
    c.enableTranslate = true;
    c.enableTilt = true;
    c.enableLook = true;
  };

  return {
    viewer,
    isLoading,
    initCesium,
    clearCesium,
    canvasPointToCartesianByRay,
    cartesianToCartographic,
    calculateLineLength,
    lockCamera,
    unlockCamera,
    calculateShapeArea,
  };
}
