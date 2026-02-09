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

// Data from buildHouseFaces - face-based format
export interface HouseData {
  roofFaces: Point3D[][]; // Each roof face is an array of points
  wallFaces: Point3D[][]; // Each wall face is an array of points (4 points each)
}

export interface ThreeJsColors {
  roof: number;
  wall: number;
  roofEdge: number;
  wallEdge: number;
}

const DEFAULT_COLORS: ThreeJsColors = {
  roof: 0xcc4444,
  wall: 0xf5f5dc,
  roofEdge: 0x8b0000,
  wallEdge: 0x8b7355,
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
   * Create house from face arrays
   * - roofFaces: each face is Point3D[] (polygon)
   * - wallFaces: each face is Point3D[] (quad: 4 points)
   */
  const createHouse = (data: HouseData) => {
    if (!scene.value) return;

    const { roofFaces, wallFaces } = data;

    // === WALLS ===
    const wallGroup = new THREE.Group();
    wallGroup.name = "walls";

    for (const face of wallFaces) {
      if (face.length < 3) continue;

      const geo = new THREE.BufferGeometry();
      const verts: number[] = [];
      face.forEach((p) => verts.push(p.x, p.y, p.z));

      // Triangulate (fan from first vertex)
      const indices: number[] = [];
      for (let i = 1; i < face.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: DEFAULT_COLORS.wall,
          side: THREE.DoubleSide,
        }),
      );
      wallGroup.add(mesh);

      // Add edges
      const edges = new THREE.EdgesGeometry(geo);
      wallGroup.add(
        new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: DEFAULT_COLORS.wallEdge }),
        ),
      );
    }
    scene.value.add(wallGroup);

    // === ROOF ===
    const roofGroup = new THREE.Group();
    roofGroup.name = "roof";

    for (const face of roofFaces) {
      if (face.length < 3) continue;

      const geo = new THREE.BufferGeometry();
      const verts: number[] = [];
      face.forEach((p) => verts.push(p.x, p.y, p.z));

      // Triangulate (fan from first vertex)
      const indices: number[] = [];
      for (let i = 1; i < face.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: DEFAULT_COLORS.roof,
          side: THREE.DoubleSide,
        }),
      );
      roofGroup.add(mesh);

      // Add edges
      const edges = new THREE.EdgesGeometry(geo);
      roofGroup.add(
        new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: DEFAULT_COLORS.roofEdge }),
        ),
      );
    }
    scene.value.add(roofGroup);
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
    scene,
    camera,
    renderer,
    isInitialized,
    initThreeJs,
    dispose,
    createEdgeWithLabel,
    createHouse,
    clearHouse,
    updateColors,
    createTextLabel,
    addGrid,
    addAxes,
    focusOn,
  };
}
