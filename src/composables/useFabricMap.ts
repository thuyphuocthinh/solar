import { ref, markRaw } from "vue";
import { Canvas, Rect, Circle, Line, Polygon } from "fabric";

type Point = { x: number; y: number };
type Edge = { from: Point; to: Point };

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

    removeTempLine();

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
    });

    canvas.value.add(polygon);

    points.value = [];
    isClosed = false;
    currentStartPoint = null;
    currentEndPoint = null;
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
    const rect = new Rect({
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 300,
      height: 300,
      fill: "transparent",
      stroke: "white",
      strokeWidth: 2,
      rx: 4,
      ry: 4,
      originX: "center",
      originY: "center",
      selectable: true,
    });
    canvas.value.add(rect);
    canvas.value.setActiveObject(rect);
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
  };
}
