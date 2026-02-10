import { ref, shallowRef } from "vue";
import {
  Ion,
  Terrain,
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  Cartesian2,
  Cartographic,
  Matrix4,
  Transforms,
  sampleTerrainMostDetailed,
  Cesium3DTileset,
} from "cesium";
import type { Point3D, Point, Edge } from "@/types";

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
   * Convert Cesium Cartesian3 to Three.js-compatible local coordinates
   * Uses first point as origin
   * Three.js convention: X=East, Y=Up (height), Z=North (forward)
   */
  const cartesianToLocal = (
    cartesian: Cartesian3,
    origin: Cartesian3,
    groundOffset = 0,
  ) => {
    const enuToFixed = Transforms.eastNorthUpToFixedFrame(origin);
    const fixedToEnu = Matrix4.inverseTransformation(enuToFixed, new Matrix4());

    const enu = Matrix4.multiplyByPoint(
      fixedToEnu,
      cartesian,
      new Cartesian3(),
    );

    return {
      x: enu.x, // East
      y: enu.z - groundOffset, // Up (normalized to ground)
      z: enu.y, // North
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

    // 1. Convert all unique points to 3D
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

    // 2. Build roof faces
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

    // 3. Build wall faces from corners
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

  /**
   * Calculate the normal vector of a 3D polygon
   * Uses the first three points to define the plane (assumes planar polygon)
   * Returns normalized vector {x, y, z}
   */
  const calculatePolygonNormal = (points: Point3D[]): Point3D => {
    if (points.length < 3) return { x: 0, y: 1, z: 0 };

    const p0 = points[0]!;
    const p1 = points[1]!;
    const p2 = points[2]!;

    // Vector v1 = p1 - p0
    const v1 = {
      x: p1.x - p0.x,
      y: p1.y - p0.y,
      z: p1.z - p0.z,
    };

    // Vector v2 = p2 - p0
    const v2 = {
      x: p2.x - p0.x,
      y: p2.y - p0.y,
      z: p2.z - p0.z,
    };

    // Cross product v1 x v2
    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x,
    };

    // Normalize
    const length = Math.sqrt(
      normal.x * normal.x + normal.y * normal.y + normal.z * normal.z,
    );

    if (length === 0) return { x: 0, y: 1, z: 0 };

    return {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length,
    };
  };

  /**
   * Calculate slope (inclination) of a polygon relative to the horizontal plane (Oxz)
   * @param normal Normalized normal vector of the polygon
   * @returns Angle in degrees (0 = flat, 90 = vertical)
   */
  const calculatePolygonSlope = (normal: Point3D): number => {
    // Dot product with Up vector (0, 1, 0)
    // dot = nx*0 + ny*1 + nz*0 = ny
    // Since vectors are normalized, dot = cos(theta)
    const dot = normal.y;

    // Clamp value to [-1, 1] to avoid numerical errors
    const clampedDot = Math.max(-1, Math.min(1, dot));

    // Angle from vertical (Up)
    const radians = Math.acos(clampedDot);

    // Convert to degrees
    const degrees = (radians * 180) / Math.PI;

    // We want slope relative to horizontal, which matches 'degrees' if normal is contiguous with Up
    // If normal is (0,1,0), slope should be 0. acos(1) = 0. Correct.
    // If normal is (1,0,0), slope should be 90. acos(0) = 90. Correct.

    return degrees;
  };

  // sub polygon => slope of each face => re-calculate corner points

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
    cartesianToLocal,
    buildHouseFaces,
    lockCamera,
    unlockCamera,
    calculateShapeArea,
    getProjectionOfPoint,
    calculatePolygonNormal,
    calculatePolygonSlope,
  };
}
