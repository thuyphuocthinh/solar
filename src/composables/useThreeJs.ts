import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { ref, shallowRef } from "vue";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface RoofFace {
  vertices: Point3D[];
  slopeAngle: number;
}

export interface HouseData {
  corners: Point3D[];
  ridge: Point3D[];
  faces: RoofFace[];
  groundHeight?: number; // Ground level in local coords (usually negative)
  wallHeight?: number; // Wall height in meters
}

export interface ThreeJsColors {
  roof: number;
  wall: number;
  roofEdge: number;
  wallEdge: number;
  label: string;
}

const DEFAULT_COLORS: ThreeJsColors = {
  roof: 0xcc4444, // Red-brown roof
  wall: 0xf5f5dc, // Beige walls
  roofEdge: 0x8b0000, // Dark red edges
  wallEdge: 0x8b7355, // Brown edges
  label: "#ffffff", // White labels
};

export function useThreeJs() {
  const scene = shallowRef<THREE.Scene | null>(null);
  const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
  const labelRenderer = shallowRef<CSS2DRenderer | null>(null);
  const controls = shallowRef<OrbitControls | null>(null);
  const isInitialized = ref(false);

  let animationId: number | null = null;

  /**
   * Initialize Three.js scene with container element
   */
  const initThreeJs = (container: HTMLElement) => {
    // Scene
    scene.value = new THREE.Scene();
    scene.value.background = new THREE.Color(0x1a1a2e);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera.value = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.value.position.set(20, 15, 20);
    camera.value.lookAt(0, 0, 0);

    // WebGL Renderer
    renderer.value = new THREE.WebGLRenderer({ antialias: true });
    renderer.value.setSize(container.clientWidth, container.clientHeight);
    renderer.value.setPixelRatio(window.devicePixelRatio);
    renderer.value.shadowMap.enabled = true;
    renderer.value.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.value.domElement);

    // CSS2D Renderer for labels
    labelRenderer.value = new CSS2DRenderer();
    labelRenderer.value.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.value.domElement.style.position = "absolute";
    labelRenderer.value.domElement.style.top = "0";
    labelRenderer.value.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.value.domElement);

    // Orbit Controls
    controls.value = new OrbitControls(camera.value, renderer.value.domElement);
    controls.value.enableDamping = true;
    controls.value.dampingFactor = 0.05;

    // Lights
    addLights();

    // Grid and Axes
    addGrid();
    addAxes();

    isInitialized.value = true;

    // Start animation loop
    animate();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (
        !container ||
        !camera.value ||
        !renderer.value ||
        !labelRenderer.value
      )
        return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.value.aspect = width / height;
      camera.value.updateProjectionMatrix();
      renderer.value.setSize(width, height);
      labelRenderer.value.setSize(width, height);
    });
    resizeObserver.observe(container);

    return resizeObserver;
  };

  /**
   * Animation loop
   */
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    if (controls.value) controls.value.update();
    if (renderer.value && scene.value && camera.value) {
      renderer.value.render(scene.value, camera.value);
    }
    if (labelRenderer.value && scene.value && camera.value) {
      labelRenderer.value.render(scene.value, camera.value);
    }
  };

  /**
   * Add lighting to the scene
   */
  const addLights = () => {
    if (!scene.value) return;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.value.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.value.add(directionalLight);

    // Hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.value.add(hemiLight);
  };

  /**
   * Add grid floor to the scene
   */
  const addGrid = (size = 50, divisions = 50) => {
    if (!scene.value) return;

    const gridHelper = new THREE.GridHelper(
      size,
      divisions,
      0x444444,
      0x333333,
    );
    gridHelper.position.y = 0;
    scene.value.add(gridHelper);
  };

  /**
   * Add XYZ axes to the scene
   */
  const addAxes = (size = 10) => {
    if (!scene.value) return;

    const axesHelper = new THREE.AxesHelper(size);
    scene.value.add(axesHelper);

    // Add axis labels
    const labelStyle = {
      fontSize: "12px",
      fontWeight: "bold",
      padding: "2px 6px",
      borderRadius: "3px",
    };

    // X axis (red)
    const xLabel = createTextLabel("X", "#ff4444", labelStyle);
    xLabel.position.set(size + 0.5, 0, 0);
    scene.value.add(xLabel);

    // Y axis (green)
    const yLabel = createTextLabel("Y", "#44ff44", labelStyle);
    yLabel.position.set(0, size + 0.5, 0);
    scene.value.add(yLabel);

    // Z axis (blue)
    const zLabel = createTextLabel("Z", "#4444ff", labelStyle);
    zLabel.position.set(0, 0, size + 0.5);
    scene.value.add(zLabel);
  };

  /**
   * Create a CSS2D text label
   */
  const createTextLabel = (
    text: string,
    color = "#ffffff",
    style: Partial<CSSStyleDeclaration> = {},
  ): CSS2DObject => {
    const div = document.createElement("div");
    div.textContent = text;
    div.style.color = color;
    div.style.fontSize = style.fontSize || "11px";
    div.style.fontFamily = "Arial, sans-serif";
    div.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    div.style.padding = style.padding || "2px 4px";
    div.style.borderRadius = style.borderRadius || "2px";
    div.style.whiteSpace = "nowrap";

    return new CSS2DObject(div);
  };

  /**
   * Create edge lines with length labels
   */
  const createEdgeWithLabel = (
    start: Point3D,
    end: Point3D,
    color: number,
    labelColor: string,
  ): { line: THREE.Line; label: CSS2DObject } => {
    // Create line
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(end.x, end.y, end.z),
    ]);
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const line = new THREE.Line(geometry, material);

    // Calculate length
    const length = Math.sqrt(
      Math.pow(end.x - start.x, 2) +
        Math.pow(end.y - start.y, 2) +
        Math.pow(end.z - start.z, 2),
    );

    // Create label at midpoint
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2,
    };
    const label = createTextLabel(`${length.toFixed(2)}m`, labelColor);
    label.position.set(midpoint.x, midpoint.y + 0.3, midpoint.z);

    return { line, label };
  };

  /**
   * Create roof mesh from face data
   */
  const createRoof = (
    faces: RoofFace[],
    color = DEFAULT_COLORS.roof,
    edgeColor = DEFAULT_COLORS.roofEdge,
    showLabels = true,
  ) => {
    if (!scene.value) return;

    const roofGroup = new THREE.Group();
    roofGroup.name = "roof";

    faces.forEach((face) => {
      if (face.vertices.length < 3) return;

      // For 3D faces, we need to create a custom geometry
      const geometry = new THREE.BufferGeometry();
      const vertices: number[] = [];
      const indices: number[] = [];

      // Add vertices
      face.vertices.forEach((v) => {
        vertices.push(v.x, v.y, v.z);
      });

      // Create triangles (fan triangulation for convex polygons)
      for (let i = 1; i < face.vertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Create mesh
      const material = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        roughness: 0.7,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      roofGroup.add(mesh);

      // Add edges
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: edgeColor });
      const wireframe = new THREE.LineSegments(edges, edgeMaterial);
      roofGroup.add(wireframe);

      // Add edge labels with lengths
      if (showLabels) {
        for (let i = 0; i < face.vertices.length; i++) {
          const start = face.vertices[i]!;
          const end = face.vertices[(i + 1) % face.vertices.length]!;
          const { label } = createEdgeWithLabel(
            start,
            end,
            edgeColor,
            DEFAULT_COLORS.label,
          );
          roofGroup.add(label);
        }
      }

      // Add slope angle label
      const centroid = {
        x:
          face.vertices.reduce((sum, v) => sum + v.x, 0) / face.vertices.length,
        y:
          face.vertices.reduce((sum, v) => sum + v.y, 0) / face.vertices.length,
        z:
          face.vertices.reduce((sum, v) => sum + v.z, 0) / face.vertices.length,
      };
      const slopeLabel = createTextLabel(
        `${face.slopeAngle.toFixed(1)}°`,
        "#ffcc00",
        { fontSize: "14px", fontWeight: "bold" },
      );
      slopeLabel.position.set(centroid.x, centroid.y + 0.5, centroid.z);
      roofGroup.add(slopeLabel);
    });

    scene.value.add(roofGroup);
    return roofGroup;
  };

  /**
   * Create walls from corner points
   */
  const createWalls = (
    corners: Point3D[],
    groundHeight = 0,
    color = DEFAULT_COLORS.wall,
    edgeColor = DEFAULT_COLORS.wallEdge,
    showLabels = true,
  ) => {
    if (!scene.value || corners.length < 3) return;

    const wallGroup = new THREE.Group();
    wallGroup.name = "walls";

    // Create wall for each pair of consecutive corners
    for (let i = 0; i < corners.length; i++) {
      const corner1 = corners[i]!;
      const corner2 = corners[(i + 1) % corners.length]!;

      // Wall vertices: bottom-left, bottom-right, top-right, top-left
      const wallVertices = [
        new THREE.Vector3(corner1.x, groundHeight, corner1.z),
        new THREE.Vector3(corner2.x, groundHeight, corner2.z),
        new THREE.Vector3(corner2.x, corner2.y, corner2.z),
        new THREE.Vector3(corner1.x, corner1.y, corner1.z),
      ];

      // Create geometry
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        // First triangle
        wallVertices[0]!.x,
        wallVertices[0]!.y,
        wallVertices[0]!.z,
        wallVertices[1]!.x,
        wallVertices[1]!.y,
        wallVertices[1]!.z,
        wallVertices[2]!.x,
        wallVertices[2]!.y,
        wallVertices[2]!.z,
        // Second triangle
        wallVertices[0]!.x,
        wallVertices[0]!.y,
        wallVertices[0]!.z,
        wallVertices[2]!.x,
        wallVertices[2]!.y,
        wallVertices[2]!.z,
        wallVertices[3]!.x,
        wallVertices[3]!.y,
        wallVertices[3]!.z,
      ]);
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.computeVertexNormals();

      // Create mesh
      const material = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      // Add edges
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: edgeColor });
      const wireframe = new THREE.LineSegments(edges, edgeMaterial);
      wallGroup.add(wireframe);

      // Add height label (vertical edge)
      if (showLabels) {
        const wallHeight = corner1.y - groundHeight;
        const heightLabel = createTextLabel(
          `${wallHeight.toFixed(2)}m`,
          DEFAULT_COLORS.label,
        );
        heightLabel.position.set(
          corner1.x,
          groundHeight + wallHeight / 2,
          corner1.z,
        );
        wallGroup.add(heightLabel);

        // Add width label (horizontal edge at bottom)
        const width = Math.sqrt(
          Math.pow(corner2.x - corner1.x, 2) +
            Math.pow(corner2.z - corner1.z, 2),
        );
        const widthLabel = createTextLabel(
          `${width.toFixed(2)}m`,
          DEFAULT_COLORS.label,
        );
        widthLabel.position.set(
          (corner1.x + corner2.x) / 2,
          groundHeight + 0.2,
          (corner1.z + corner2.z) / 2,
        );
        wallGroup.add(widthLabel);
      }
    }

    scene.value.add(wallGroup);
    return wallGroup;
  };

  /**
   * Create complete house from house data
   */
  const createHouse = (
    houseData: HouseData,
    colors: Partial<ThreeJsColors> = {},
  ) => {
    const mergedColors = { ...DEFAULT_COLORS, ...colors };
    const groundHeight = houseData.groundHeight ?? 0;

    // Create walls
    createWalls(
      houseData.corners,
      groundHeight,
      mergedColors.wall,
      mergedColors.wallEdge,
    );

    // Create roof
    createRoof(houseData.faces, mergedColors.roof, mergedColors.roofEdge);
  };

  /**
   * Clear all objects from scene (except lights, grid, axes)
   */
  const clearHouse = () => {
    if (!scene.value) return;

    const toRemove: THREE.Object3D[] = [];
    scene.value.traverse((obj) => {
      if (obj.name === "roof" || obj.name === "walls") {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((obj) => {
      scene.value!.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  };

  /**
   * Update colors of existing house
   */
  const updateColors = (colors: Partial<ThreeJsColors>) => {
    if (!scene.value) return;

    scene.value.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.parent?.name === "roof" && colors.roof !== undefined) {
          (obj.material as THREE.MeshStandardMaterial).color.setHex(
            colors.roof,
          );
        }
        if (obj.parent?.name === "walls" && colors.wall !== undefined) {
          (obj.material as THREE.MeshStandardMaterial).color.setHex(
            colors.wall,
          );
        }
      }
    });
  };

  /**
   * Focus camera on a specific point
   */
  const focusOn = (target: Point3D, distance = 20) => {
    if (!camera.value || !controls.value) return;

    camera.value.position.set(
      target.x + distance,
      target.y + distance * 0.5,
      target.z + distance,
    );
    controls.value.target.set(target.x, target.y, target.z);
    controls.value.update();
  };

  /**
   * Cleanup Three.js resources
   */
  const dispose = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (controls.value) {
      controls.value.dispose();
      controls.value = null;
    }

    if (renderer.value) {
      renderer.value.dispose();
      renderer.value.domElement.remove();
      renderer.value = null;
    }

    if (labelRenderer.value) {
      labelRenderer.value.domElement.remove();
      labelRenderer.value = null;
    }

    scene.value = null;
    camera.value = null;
    isInitialized.value = false;
  };

  return {
    // State
    scene,
    camera,
    renderer,
    isInitialized,
    initThreeJs,
    dispose,
    createRoof,
    createWalls,
    createHouse,
    clearHouse,
    updateColors,
    createTextLabel,
    addGrid,
    addAxes,
    focusOn,
  };
}
