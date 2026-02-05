import { ref, markRaw } from "vue";
import { Canvas, Rect, Circle, Line, Polygon } from "fabric";

export type Point = { x: number; y: number };
export type Edge = { from: Point; to: Point };

export function useFabricMap() {
  const canvas = ref<Canvas | null>(null);
  const activeTool = ref<string | null>(null);

  const points = ref<Point[]>([]);
  const edges = ref<Edge[]>([]);
  let focusFrame: Rect | null = null;
  let tempLine: Line | null = null;
  let isClosed = false;

  // Track current start/end points for flexible polygon drawing
  let currentStartPoint: Point | null = null;
  let currentEndPoint: Point | null = null;

  const initFabric = (canvasElement: HTMLCanvasElement) => {
    canvas.value = markRaw(
      new Canvas(canvasElement, {
        width: window.innerWidth,
        height: window.innerHeight,
        selection: false,
        subTargetCheck: true,
        perPixelTargetFind: true,
      }),
    );

    const rect = new Rect({
      left: window.innerWidth / 2,
      top: window.innerHeight / 2 - 70,
      width: 700,
      height: 400,
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
          openPolygonAgain(nearExistingPoint);
        } else {
          // Add new point and start from there
          addPointVisual(point);
          openPolygonAgain(point);
        }
        return;
      }

      // Case 2: Click near an existing point → close polygon
      if (nearExistingPoint && points.value.length >= 3) {
        // Close polygon to the near existing point
        closePolygon(nearExistingPoint);
        return;
      }

      // Case 3: Normal case → add new point
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

  const finishPolygon = () => {
    if (!canvas.value) return;

    // Remove drawing event listeners to allow polygon interaction
    canvas.value.off("mouse:down");
    canvas.value.off("mouse:move");
    canvas.value.off("mouse:dblclick");

    removeTempLine();

    // Remove helper objects
    canvas.value.getObjects().forEach((obj) => {
      if (
        obj !== focusFrame &&
        (obj instanceof Line || obj instanceof Circle)
      ) {
        canvas.value!.remove(obj);
      }
    });

    const polygon = new Polygon(points.value, {
      fill: "rgba(255,255,255,0.2)",
      stroke: "yellow",
      strokeWidth: 2,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockRotation: false,
      lockScalingX: false,
      lockScalingY: false,
      perPixelTargetFind: false,
    });

    polygon.setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    });

    canvas.value.add(polygon);
    canvas.value.selection = true;
    canvas.value.discardActiveObject();
    canvas.value.setActiveObject(polygon);
    polygon.setCoords();

    canvas.value.defaultCursor = "default";
    canvas.value.hoverCursor = "move";
    activeTool.value = null;
    points.value = [];
    isClosed = false;
    currentStartPoint = null;
    currentEndPoint = null;

    canvas.value.requestRenderAll();
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
      rx: 4,
      ry: 4,
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
      hasControls: false,
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
      hasControls: false,
      lockMovementY: false,
      name: "roof_p2",
    });

    // ================= LINES =================
    const createLine = (name: string) =>
      new Line([0, 0, 0, 0], {
        stroke: "yellow",
        strokeWidth: 2,
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
      const { tl, tr } = rect.aCoords;

      const padding = 10;
      const minX = tl.x + padding;
      const maxX = tr.x - padding;

      if (p.left < minX) p.set({ left: minX });
      if (p.left > maxX) p.set({ left: maxX });
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

    (canvas.value as any).bringToFront(p1);
    (canvas.value as any).bringToFront(p2);

    canvas.value.setActiveObject(rect);
    canvas.value.requestRenderAll();
  };

  const clearFabric = () => {
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
    finishPolygon,
  };
}
