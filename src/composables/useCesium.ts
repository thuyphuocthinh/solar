import { ref, shallowRef } from "vue";
import {
  Ion,
  Terrain,
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  Cartesian2,
  Cartographic,
  sampleTerrainMostDetailed,
  Cesium3DTileset,
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

    // Load Cesium OSM Buildings for building heights (free with Cesium Ion)
    // Asset ID 96188 is the official Cesium OSM Buildings tileset
    try {
      const osmBuildings = await Cesium3DTileset.fromIonAssetId(96188);
      viewer.value.scene.primitives.add(osmBuildings);
    } catch (error) {
      console.warn(
        "Failed to load OSM Buildings, falling back to terrain only:",
        error,
      );
    }

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
   * Pick position from depth buffer (3D Tiles/Buildings) or fallback to Globe
   * @param point Canvas point
   */
  const smartPickCartesian = (point: Point) => {
    const scene = viewer.value!.scene;
    const windowPosition = new Cartesian2(point.x, point.y);

    // Try picking 3D object/building first
    // Note: pickPosition requires depthTestAgainstTerrain = true (enabled in init)
    const pickedPosition = scene.pickPosition(windowPosition);

    if (pickedPosition) {
      return pickedPosition;
    }

    // Fallback to ray casting on globe
    return canvasPointToCartesianByRay(point);
  };

  /**
   * Get accurate ground height at a specific cartographic position
   * @param longitude Degrees
   * @param latitude Degrees
   * @returns Promise<number> Ground height in meters
   */
  const getGroundHeight = async (longitude: number, latitude: number) => {
    const terrainProvider = viewer.value!.terrainProvider;
    const positions = [Cartographic.fromDegrees(longitude, latitude)];

    try {
      const updatedPositions = await sampleTerrainMostDetailed(
        terrainProvider,
        positions,
      );
      if (updatedPositions && updatedPositions[0]) {
        return updatedPositions[0].height;
      }
      return 0;
    } catch (error) {
      console.error("Error sampling terrain height:", error);
      return 0;
    }
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

  /**
   * Calculate roof slope ratio (rise / run)
   * @returns Slope ratio (e.g., 0.5 means 1:2 slope)
   */
  const calculateSlope = (cartesian1: Cartesian3, cartesian2: Cartesian3) => {
    const cartographic1 = cartesianToCartographic(cartesian1);
    const cartographic2 = cartesianToCartographic(cartesian2);

    const deltaHeight = Math.abs(cartographic2.height - cartographic1.height);
    const distance3D = calculateLineLength(cartesian1, cartesian2);

    // Calculate horizontal distance from 3D distance and height difference
    const horizontalDistance = Math.sqrt(
      distance3D * distance3D - deltaHeight * deltaHeight,
    );

    // Slope = rise / run
    return horizontalDistance > 0 ? deltaHeight / horizontalDistance : 0;
  };

  /**
   * Calculate roof slope angle in degrees
   * @returns Angle in degrees (e.g., 30° means 30 degree incline)
   */
  const calculateSlopeAngle = (
    cartesian1: Cartesian3,
    cartesian2: Cartesian3,
  ) => {
    const slope = calculateSlope(cartesian1, cartesian2);
    return CesiumMath.toDegrees(Math.atan(slope));
  };

  /**
   * Calculate normal vector from 3 points on a plane
   * @param p1, p2, p3 - Three points on the roof face
   * @returns Normalized normal vector
   */
  const calculateNormal = (p1: Cartesian3, p2: Cartesian3, p3: Cartesian3) => {
    // Vectors from p1 to p2 and p1 to p3
    const v1 = Cartesian3.subtract(p2, p1, new Cartesian3());
    const v2 = Cartesian3.subtract(p3, p1, new Cartesian3());

    // Cross product to get normal
    const normal = Cartesian3.cross(v1, v2, new Cartesian3());
    Cartesian3.normalize(normal, normal);

    return normal;
  };

  /**
   * Calculate roof face slope angle using normal vector method
   * This is more accurate for multi-face roofs (hip roof, etc.)
   * @param p1, p2, p3 - Three points on the roof face
   * @returns Slope angle in degrees (0° = horizontal, 90° = vertical)
   */
  const calculateFaceSlope = (
    p1: Cartesian3,
    p2: Cartesian3,
    p3: Cartesian3,
  ) => {
    const normal = calculateNormal(p1, p2, p3);

    // Get local up vector at the centroid of the face
    const centroid = new Cartesian3();
    Cartesian3.add(p1, p2, centroid);
    Cartesian3.add(centroid, p3, centroid);
    Cartesian3.divideByScalar(centroid, 3, centroid);

    // Local up vector (normal to earth's surface at this point)
    const localUp = Cartesian3.normalize(centroid, new Cartesian3());

    // Angle between roof normal and local up
    const dot = Math.abs(Cartesian3.dot(normal, localUp));
    const angleFromVertical = Math.acos(Math.min(dot, 1)); // clamp for safety

    // Slope angle = angle from horizontal = 90° - angle from vertical
    return 90 - CesiumMath.toDegrees(angleFromVertical);
  };

  /**
   * Convert Cesium Cartesian3 to Three.js-compatible local coordinates
   * Uses first point as origin
   * Three.js convention: X=East, Y=Up (height), Z=North (forward)
   */
  const cartesianToLocal = (
    cartesian: Cartesian3,
    origin: Cartesian3,
  ): { x: number; y: number; z: number } => {
    // Get offset from origin
    const offset = Cartesian3.subtract(cartesian, origin, new Cartesian3());

    // Get local ENU (East-North-Up) frame at origin
    const originCartographic = Cartographic.fromCartesian(origin);

    // Calculate local east and north vectors
    const east = new Cartesian3(
      -Math.sin(originCartographic.longitude),
      Math.cos(originCartographic.longitude),
      0,
    );
    const north = new Cartesian3(
      -Math.sin(originCartographic.latitude) *
        Math.cos(originCartographic.longitude),
      -Math.sin(originCartographic.latitude) *
        Math.sin(originCartographic.longitude),
      Math.cos(originCartographic.latitude),
    );
    const up = Cartesian3.normalize(origin, new Cartesian3());

    // Three.js uses Y-up convention, so we swap:
    // Cesium ENU -> Three.js: X=East, Y=Up, Z=North
    return {
      x: Cartesian3.dot(offset, east),
      y: Cartesian3.dot(offset, up), // Height goes to Y in Three.js
      z: Cartesian3.dot(offset, north), // North goes to Z in Three.js
    };
  };

  /**
   * Build house faces for Three.js
   * Input: subPolygons (roof faces) + corners (for walls)
   * Output: { roofFaces, wallFaces } - arrays of Point3D[] ready for Three.js
   */
  const buildHouseFaces = async (
    subPolygons: Array<Array<{ x: number; y: number }>>, // Each sub-polygon = 1 roof face
    corners: Array<{ x: number; y: number }>, // Corner points for walls
  ) => {
    if (!viewer.value) return null;

    // === 1. Convert all unique points to 3D ===
    const pointKey = (p: { x: number; y: number }) =>
      `${p.x.toFixed(2)},${p.y.toFixed(2)}`;

    // Collect all unique points
    const allPoints = new Map<string, { x: number; y: number }>();
    for (const polygon of subPolygons) {
      for (const p of polygon) {
        allPoints.set(pointKey(p), p);
      }
    }
    for (const c of corners) {
      allPoints.set(pointKey(c), c);
    }

    // Pick 3D for each unique point
    const point3DMap = new Map<string, { x: number; y: number; z: number }>();
    const ground3DMap = new Map<string, { x: number; y: number; z: number }>();
    let origin: Cartesian3 | null = null;

    for (const [key, p] of allPoints) {
      const cartesian = smartPickCartesian(p);
      if (!cartesian) continue;

      if (!origin) origin = cartesian;

      const local3D = cartesianToLocal(cartesian, origin);
      point3DMap.set(key, local3D);

      // Project to ground for corner points only
      if (corners.some((c) => pointKey(c) === key)) {
        const ground = await getProjectionOfPoint(viewer.value, cartesian);
        const groundLocal = cartesianToLocal(ground, origin);
        ground3DMap.set(key, groundLocal);
      }
    }

    if (!origin) return null;

    // === 2. Build roof faces ===
    type Point3D = { x: number; y: number; z: number };
    const roofFaces: Point3D[][] = [];

    for (const polygon of subPolygons) {
      const face: Point3D[] = [];
      for (const p of polygon) {
        const p3d = point3DMap.get(pointKey(p));
        if (p3d) face.push(p3d);
      }
      if (face.length >= 3) {
        roofFaces.push(face);
      }
    }

    // === 3. Build wall faces from corners ===
    const wallFaces: Point3D[][] = [];
    const n = corners.length;

    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      const c0 = corners[i]!;
      const c1 = corners[nextI]!;

      const roof0 = point3DMap.get(pointKey(c0));
      const roof1 = point3DMap.get(pointKey(c1));
      const ground0 = ground3DMap.get(pointKey(c0));
      const ground1 = ground3DMap.get(pointKey(c1));

      if (roof0 && roof1 && ground0 && ground1) {
        // Wall face: ground0 -> ground1 -> roof1 -> roof0
        wallFaces.push([ground0, ground1, roof1, roof0]);
      }
    }

    return { roofFaces, wallFaces };
  };

  const getProjectionOfPoint = async (
    viewer: Viewer,
    point: Cartesian3,
  ): Promise<Cartesian3> => {
    const cartographic = Cartographic.fromCartesian(point);

    const [updated] = await sampleTerrainMostDetailed(viewer.terrainProvider, [
      cartographic,
    ]);

    return Cartesian3.fromRadians(
      updated?.longitude!,
      updated?.latitude!,
      updated?.height!,
    );
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
    smartPickCartesian,
    getGroundHeight,
    cartesianToCartographic,
    calculateLineLength,
    calculateSlope,
    calculateSlopeAngle,
    calculateNormal,
    calculateFaceSlope,
    cartesianToLocal,
    buildHouseFaces,
    lockCamera,
    unlockCamera,
    calculateShapeArea,
    getProjectionOfPoint,
  };
}
