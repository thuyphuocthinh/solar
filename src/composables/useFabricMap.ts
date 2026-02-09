import { ref, markRaw } from "vue";
import { Canvas, Rect, Circle, Line, Group } from "fabric";
import { getSubPolygons as getSubPolygonsFromGraph } from "@/utils/graph";

export type Point = { x: number; y: number };
export type Edge = { from: Point; to: Point };
export type SubPolygon = Point[];

export function useFabricMap() {
  const canvas = ref<Canvas | null>(null);
  const activeTool = ref<string | null>(null);

  const points = ref<Point[]>([]);
  const edges = ref<Edge[]>([]);
  let focusFrame: Rect | null = null;
  let tempLine: Line | null = null;
  let isClosed = false;
  let resizeHandler: (() => void) | null = null;

  // Track current start/end points for flexible polygon drawing
  let currentStartPoint: Point | null = null;
  let currentEndPoint: Point | null = null;

  const initFabric = (canvasElement: HTMLCanvasElement) => {
    const parent = canvasElement.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;

    canvas.value = markRaw(
      new Canvas(canvasElement, {
        width,
        height,
        selection: false,
        subTargetCheck: true,
        perPixelTargetFind: true,
      }),
    );

    const rect = new Rect({
      left: width / 2,
      top: height / 2 - 70,
      width: Math.min(700, width * 0.8),
      height: Math.min(400, height * 0.6),
      fill: "transparent",
      stroke: "white",
      strokeWidth: 4,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });

    canvas.value.add(rect);
    focusFrame = rect;

    // Handle resize
    resizeHandler = () => {
      if (!canvas.value) return;
      const newWidth = parent?.clientWidth || window.innerWidth;
      const newHeight = parent?.clientHeight || window.innerHeight;
      canvas.value.setDimensions({ width: newWidth, height: newHeight });

      if (focusFrame) {
        focusFrame.set({
          left: newWidth / 2,
          top: newHeight / 2 - 50,
          width: Math.min(700, newWidth * 0.8),
          height: Math.min(400, newHeight * 0.6),
        });
        focusFrame.setCoords();
      }
      canvas.value.requestRenderAll();
    };
    window.addEventListener("resize", resizeHandler);
  };

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  const isNearPoint = (a: Point, b: Point, threshold = 10) =>
    distance(a, b) < threshold;

  const removeTempLine = () => {
    if (tempLine && canvas.value) {
      canvas.value.remove(tempLine);
      tempLine = null;
    }
  };

  const createTempLine = (from: Point) => {
    if (!canvas.value) return;

    tempLine = new Line([from.x, from.y, from.x, from.y], {
      stroke: "yellow",
      strokeWidth: 2,
      strokeDashArray: [6, 6],
      selectable: false,
      evented: false,
    });

    canvas.value.add(tempLine);
  };

  const addPointVisual = (p: Point) => {
    const circle = new Circle({
      left: p.x,
      top: p.y,
      radius: 5,
      fill: "yellow",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    canvas.value!.add(circle);
    points.value.push(p);
  };

  const addLineVisual = (from: Point, to: Point) => {
    const line = new Line([from.x, from.y, to.x, to.y], {
      stroke: "yellow",
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    canvas.value!.add(line);
    edges.value.push({ from, to });
  };

  const addPoint = (p: Point, isStart = false) => {
    // Track start and end points
    if (isStart || points.value.length === 0) {
      currentStartPoint = p;
    }
    currentEndPoint = p;

    const last = points.value[points.value.length - 1];
    addPointVisual(p);

    if (last) addLineVisual(last, p);

    removeTempLine();
    createTempLine(p);
  };

  const closePolygon = (snapToPoint: Point) => {
    if (!currentEndPoint || !currentStartPoint) return;

    // Draw line from current end to the snapped point
    addLineVisual(currentEndPoint, snapToPoint);

    // Remove the temp line (dashline)
    removeTempLine();

    isClosed = true;
  };

  const openPolygonAgain = (fromPoint: Point) => {
    isClosed = false;
    currentEndPoint = fromPoint;
    createTempLine(fromPoint);
  };

  const findNearPoint = (p: Point, threshold = 10): Point | null => {
    return (
      points.value.find((point) => isNearPoint(p, point, threshold)) || null
    );
  };

  const moveExistingPointToLast = (p: Point) => {
    const index = points.value.findIndex((point) => isNearPoint(p, point));
    if (index !== -1) {
      const point = points.value[index];
      points.value.splice(index, 1);
      points.value.push(point!);
      currentEndPoint = point!;
    }
  };

  const setupPolygonDrawing = () => {
    if (!canvas.value) return;

    canvas.value.on("mouse:down", (opt: any) => {
      if (activeTool.value !== "polygon") return;

      const pointer = canvas.value!.getScenePoint(opt.e);
      const point = { x: pointer.x, y: pointer.y };
      const nearExistingPoint = findNearPoint(point);

      if (isClosed) {
        if (nearExistingPoint) {
          // Start from existing point, don't add new point
          moveExistingPointToLast(nearExistingPoint);
          openPolygonAgain(nearExistingPoint);
        } else {
          // Add new point and start from there
          addPointVisual(point);
          openPolygonAgain(point);
        }
        return;
      }

      // Case 2: Click near an existing point -> close polygon
      if (nearExistingPoint && points.value.length >= 3) {
        // Close polygon to the near existing point
        closePolygon(nearExistingPoint);
        return;
      }

      addPoint(point);
    });

    canvas.value.on("mouse:move", (opt: any) => {
      if (activeTool.value !== "polygon" || !tempLine || isClosed) return;

      const pointer = canvas.value!.getScenePoint(opt.e);
      tempLine.set({ x2: pointer.x, y2: pointer.y });
      canvas.value!.renderAll();
    });

    canvas.value.on("mouse:dblclick", () => {
      if (activeTool.value !== "polygon" || points.value.length < 3) return;
      finishPolygon();
    });
  };

  const makeAndBeautifyShape = () => {
    if (!canvas.value) return;
    canvas.value.off("mouse:down");
    canvas.value.off("mouse:move");
    canvas.value.off("mouse:dblclick");
    canvas.value.defaultCursor = "default";
    canvas.value.hoverCursor = "move";
    canvas.value.requestRenderAll();
    switch (activeTool.value) {
      case "polygon":
        finishPolygon();
        break;
      case "frame":
        const frameResult = getPointsAndEdgesFromFrame();
        if (frameResult) {
          points.value = frameResult.points;
          edges.value = frameResult.edges;
        }
        break;
      default:
        break;
    }
  };

  const getPointsAndEdgesFromFrame = () => {
    if (!canvas.value) return;

    const rect = canvas.value
      .getObjects()
      .find((o) => (o as any).name === "roof_rect") as Rect | undefined;

    if (!rect) return;

    // tìm ridge points
    const p1 = canvas.value
      .getObjects()
      .find((o) => (o as any).name === "roof_p1") as Circle | undefined;

    const p2 = canvas.value
      .getObjects()
      .find((o) => (o as any).name === "roof_p2") as Circle | undefined;

    if (!p1 || !p2) return;

    // cập nhật aCoords cho tất cả objects
    rect.setCoords();
    p1.setCoords();
    p2.setCoords();

    const { tl, tr, bl, br } = rect.aCoords!;

    // Lấy tọa độ tâm thực tế của ridge points
    const p1Center = p1.getCenterPoint();
    const p2Center = p2.getCenterPoint();

    // ================= POINTS =================
    const points: Point[] = [
      { x: tl.x, y: tl.y },
      { x: tr.x, y: tr.y },
      { x: bl.x, y: bl.y },
      { x: br.x, y: br.y },
      { x: p1Center.x, y: p1Center.y },
      { x: p2Center.x, y: p2Center.y },
    ];

    // ================= EDGES =================
    // Points: [0]=tl, [1]=tr, [2]=bl, [3]=br, [4]=p1, [5]=p2
    const edges: Edge[] = [
      // 4 rectangle edges
      { from: points[0]!, to: points[1]! }, // tl -> tr (top)
      { from: points[2]!, to: points[3]! }, // bl -> br (bottom)
      { from: points[0]!, to: points[2]! }, // tl -> bl (left)
      { from: points[1]!, to: points[3]! }, // tr -> br (right)
      // 4 hip lines
      { from: points[0]!, to: points[4]! }, // tl -> p1
      { from: points[2]!, to: points[4]! }, // bl -> p1
      { from: points[1]!, to: points[5]! }, // tr -> p2
      { from: points[3]!, to: points[5]! }, // br -> p2
      // 1 ridge line
      { from: points[4]!, to: points[5]! }, // p1 -> p2
    ];

    return { points, edges };
  };

  /**
   * Get only points from frame (4 corners + 2 ridges)
   * Order: [tl, tr, bl, br, ridge1, ridge2]
   */
  const getPointsFromFrame = (): Point[] | null => {
    const result = getPointsAndEdgesFromFrame();
    return result ? result.points : null;
  };

  const finishPolygon = () => {
    if (!canvas.value) return;

    // 1. Lấy toàn bộ object mái (line + circle)
    const roofObjects = canvas.value
      .getObjects()
      .filter((obj) => obj instanceof Line || obj instanceof Circle);

    if (roofObjects.length === 0) return;

    // 2. Tạo group
    const roofGroup = new Group(roofObjects, {
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockRotation: false,
      lockScalingX: false,
      lockScalingY: false,
    });

    // 3. Control giống polygon
    roofGroup.setControlsVisibility({
      mt: true,
      mb: true,
      ml: true,
      mr: true,
      tl: true,
      tr: true,
      bl: true,
      br: true,
      mtr: true,
    });

    // 4. Clear selection cũ
    canvas.value.discardActiveObject();

    // 5. Add group & active
    canvas.value.add(roofGroup);
    canvas.value.setActiveObject(roofGroup);
    roofGroup.setCoords();

    // reset state vẽ
    isClosed = false;
    currentStartPoint = null;
    currentEndPoint = null;
  };

  const getSubPolygons = (): SubPolygon[] => {
    const result =
      activeTool.value === "polygon"
        ? { points: points.value, edges: edges.value }
        : getPointsAndEdgesFromFrame();
    if (!result) return [];
    return getSubPolygonsFromGraph(result.points, result.edges);
  };

  /**
   * Find corner points (for walls) and ridge points from sub-polygons
   * - Corner: appears in 1-2 sub-polygons (perimeter)
   * - Ridge: appears in 3+ sub-polygons (internal)
   */
  const findCornersAndRidges = (
    subPolygons: SubPolygon[],
  ): { corners: Point[]; ridges: Point[] } => {
    const pointKey = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    const countMap = new Map<string, { point: Point; count: number }>();

    // Count occurrences of each point across all sub-polygons
    for (const polygon of subPolygons) {
      for (const point of polygon) {
        const key = pointKey(point);
        if (!countMap.has(key)) {
          countMap.set(key, { point, count: 0 });
        }
        countMap.get(key)!.count++;
      }
    }

    const corners: Point[] = [];
    const ridges: Point[] = [];

    for (const { point, count } of countMap.values()) {
      if (count <= 2) {
        corners.push(point);
      } else {
        ridges.push(point);
      }
    }

    return { corners, ridges };
  };

  const handleSelectTool = (type: string) => {
    activeTool.value = type;
    if (!canvas.value) return;

    canvas.value.off("mouse:down");
    canvas.value.off("mouse:move");
    canvas.value.off("mouse:dblclick");

    points.value = [];
    isClosed = false;
    currentStartPoint = null;
    currentEndPoint = null;
    removeTempLine();

    canvas.value.getObjects().forEach((obj) => {
      if (obj !== focusFrame) canvas.value!.remove(obj);
    });

    switch (type) {
      case "polygon":
        canvas.value.selection = false;
        canvas.value.defaultCursor = "crosshair";
        canvas.value.hoverCursor = "crosshair";
        setupPolygonDrawing();
        break;
      case "frame":
        canvas.value.selection = true;
        canvas.value.defaultCursor = "default";
        canvas.value.hoverCursor = "move";
        addFrameObject();
        break;
      default:
        break;
    }
  };

  const addFrameObject = () => {
    if (!canvas.value) return;

    const width = 90;
    const height = 90;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // ================= RECT =================
    const rect = new Rect({
      left: cx,
      top: cy,
      width,
      height,
      fill: "transparent",
      stroke: "yellow",
      strokeWidth: 2,
      strokeUniform: true,
      originX: "center",
      originY: "center",
      lockRotation: false,
      hasRotatingPoint: true,
      name: "roof_rect",
    });

    // ================= RIDGE POINTS =================
    const p1 = new Circle({
      left: cx - 20,
      top: cy,
      radius: 6,
      fill: "purple",
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      hasControls: true,
      lockMovementY: false,
      name: "roof_p1",
    });

    const p2 = new Circle({
      left: cx + 20,
      top: cy,
      radius: 6,
      fill: "purple",
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      hasControls: true,
      lockMovementY: false,
      name: "roof_p2",
    });

    // ================= LINES =================
    const createLine = (name: string) =>
      new Line([0, 0, 0, 0], {
        stroke: "yellow",
        strokeWidth: 2,
        strokeUniform: true,
        selectable: false,
        evented: false,
        name,
      });

    const lineTL = createLine("roof_line_tl");
    const lineBL = createLine("roof_line_bl");
    const lineTR = createLine("roof_line_tr");
    const lineBR = createLine("roof_line_br");
    const lineRidge = createLine("roof_line_ridge");

    // ================= HELPERS =================
    const rotatePointAround = (
      p: { x: number; y: number },
      center: { x: number; y: number },
      angleRad: number,
    ) => {
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      const dx = p.x - center.x;
      const dy = p.y - center.y;

      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
      };
    };

    const clampRidgePoint = (p: Circle) => {
      rect.setCoords();
      const { tl, tr, bl, br } = rect.aCoords;

      // Tính điểm giữa của cạnh trái và cạnh phải (ridge line nằm ở giữa rect)
      const midLeft = { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 };
      const midRight = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };

      // Ridge direction (theo chiều ngang của rect đã xoay)
      const ridgeDir = { x: midRight.x - midLeft.x, y: midRight.y - midLeft.y };
      const ridgeLenSq = ridgeDir.x ** 2 + ridgeDir.y ** 2;
      const ridgeLen = Math.sqrt(ridgeLenSq);

      // Project vị trí hiện tại của p lên ridge line
      const vec = { x: p.left! - midLeft.x, y: p.top! - midLeft.y };
      let t = (vec.x * ridgeDir.x + vec.y * ridgeDir.y) / ridgeLenSq;

      // Clamp t trong khoảng [padding, 1-padding]
      const paddingRatio = 10 / ridgeLen;
      t = Math.max(paddingRatio, Math.min(1 - paddingRatio, t));

      // Tính vị trí mới trên ridge line
      const newX = midLeft.x + t * ridgeDir.x;
      const newY = midLeft.y + t * ridgeDir.y;

      p.set({ left: newX, top: newY });
      p.setCoords(); // Cập nhật hit region
    };

    const updateLines = () => {
      rect.setCoords();

      const { tl, tr, bl, br } = rect.aCoords;

      lineTL.set({ x1: tl.x, y1: tl.y, x2: p1.left, y2: p1.top });
      lineBL.set({ x1: bl.x, y1: bl.y, x2: p1.left, y2: p1.top });
      lineTR.set({ x1: tr.x, y1: tr.y, x2: p2.left, y2: p2.top });
      lineBR.set({ x1: br.x, y1: br.y, x2: p2.left, y2: p2.top });
      lineRidge.set({ x1: p1.left, y1: p1.top, x2: p2.left, y2: p2.top });

      canvas.value!.requestRenderAll();
      p1.setCoords();
      p2.setCoords();
    };

    // ================= INIT =================
    updateLines();

    let lastLeft = rect.left!;
    let lastTop = rect.top!;
    let lastAngle = rect.angle || 0;

    // ================= EVENTS =================
    rect.on("moving", () => {
      const dx = rect.left! - lastLeft;
      const dy = rect.top! - lastTop;

      p1.set({ left: p1.left! + dx, top: p1.top! + dy });
      p2.set({ left: p2.left! + dx, top: p2.top! + dy });

      lastLeft = rect.left!;
      lastTop = rect.top!;
      updateLines();
    });

    rect.on("rotating", () => {
      const newAngle = rect.angle || 0;
      const deltaRad = (newAngle - lastAngle) * (Math.PI / 180);

      const center = { x: rect.left!, y: rect.top! };

      const p1New = rotatePointAround(
        { x: p1.left!, y: p1.top! },
        center,
        deltaRad,
      );
      const p2New = rotatePointAround(
        { x: p2.left!, y: p2.top! },
        center,
        deltaRad,
      );

      p1.set({ left: p1New.x, top: p1New.y });
      p2.set({ left: p2New.x, top: p2New.y });

      // Cập nhật hit region cho ridge points
      p1.setCoords();
      p2.setCoords();

      lastAngle = newAngle;
      updateLines();
    });

    rect.on("scaling", updateLines);

    rect.on("modified", () => {
      lastLeft = rect.left!;
      lastTop = rect.top!;
      lastAngle = rect.angle || 0;
      updateLines();
    });

    p1.on("moving", () => {
      clampRidgePoint(p1);
      updateLines();
    });

    p2.on("moving", () => {
      clampRidgePoint(p2);
      updateLines();
    });

    // ================= ADD =================
    canvas.value.add(rect, lineTL, lineBL, lineTR, lineBR, lineRidge, p1, p2);

    canvas.value.setActiveObject(rect);
    canvas.value.requestRenderAll();
  };

  const clearFabric = () => {
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    canvas.value?.dispose();
    canvas.value = null;
  };

  const clearTool = () => {
    points.value = [];
    edges.value = [];
    activeTool.value = "";
    removeTempLine();
    canvas.value?.getObjects().forEach((obj) => {
      if (obj !== focusFrame) canvas.value!.remove(obj);
    });
  };

  return {
    points,
    edges,
    activeTool,
    initFabric,
    handleSelectTool,
    clearFabric,
    clearTool,
    makeAndBeautifyShape,
    getSubPolygons,
    findCornersAndRidges,
    getPointsFromFrame,
  };
}
