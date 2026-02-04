import { ref, markRaw } from "vue";
import { Canvas, Rect, Circle, Line, Polygon } from "fabric";

export function useFabricMap() {
  const canvas = ref<Canvas | null>(null);
  const activeTool = ref<string | null>(null); // 'polygon' | 'frame' | null
  const points = ref<{ x: number; y: number }[]>([]); // For polygon drawing
  let focusFrame: Rect | null = null;
  let tempLine: Line | null = null; // Temporary dashed line for rubberbanding

  const initFabric = (canvasElement: HTMLCanvasElement) => {
    canvas.value = markRaw(
      new Canvas(canvasElement, {
        width: window.innerWidth,
        height: window.innerHeight,
        selection: false,
        renderOnAddRemove: true,
      }),
    );

    const rect = new Rect({
      left: window.innerWidth / 2,
      top: window.innerHeight / 2 - 70,
      width: 700,
      height: 500,
      fill: "transparent",
      stroke: "white",
      strokeWidth: 4,
      rx: 4,
      ry: 4,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });

    canvas.value.add(rect);
    focusFrame = rect;
  };

  const handleSelectTool = (type: string) => {
    console.log("Selected tool:", type);
    activeTool.value = type;

    if (!canvas.value) return;

    // Preserve focusFrame, clear other objects
    const objects = canvas.value.getObjects();
    [...objects].forEach((obj) => {
      if (obj !== focusFrame) {
        canvas.value!.remove(obj);
      }
    });

    canvas.value.backgroundColor = "";
    points.value = [];

    // Remove temporary line if exists
    if (tempLine && canvas.value) {
      canvas.value.remove(tempLine);
      tempLine = null;
    }

    // Remove existing listeners
    canvas.value.off("mouse:down");
    canvas.value.off("mouse:move");
    canvas.value.off("mouse:dblclick");

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

  const setupPolygonDrawing = () => {
    if (!canvas.value) return;

    canvas.value.on("mouse:down", (options: any) => {
      if (activeTool.value !== "polygon") return;

      const pointer = canvas.value!.getScenePoint(options.e);
      const point = { x: pointer.x, y: pointer.y };

      const circle = new Circle({
        radius: 5,
        fill: "yellow",
        left: point.x,
        top: point.y,
        selectable: false,
        originX: "center",
        originY: "center",
        evented: false,
      });
      canvas.value!.add(circle);

      if (points.value.length === 0) {
        points.value.push(point);
      } else {
        const lastPoint = points.value[points.value.length - 1];
        if (lastPoint) {
          const line = new Line([lastPoint.x, lastPoint.y, point.x, point.y], {
            strokeWidth: 2,
            fill: "yellow",
            stroke: "yellow",
            selectable: false,
            evented: false,
          });
          canvas.value!.add(line);
        }
        points.value.push(point);
      }

      // Create/update temp line for rubberbanding
      if (tempLine) {
        canvas.value!.remove(tempLine);
      }
      tempLine = new Line([point.x, point.y, point.x, point.y], {
        strokeWidth: 2,
        stroke: "yellow",
        strokeDashArray: [5, 5], // Dashed line
        selectable: false,
        evented: false,
      });
      canvas.value!.add(tempLine);
    });

    canvas.value.on("mouse:move", (options: any) => {
      if (
        activeTool.value !== "polygon" ||
        points.value.length === 0 ||
        !tempLine
      )
        return;

      const pointer = canvas.value!.getScenePoint(options.e);
      // Update the end point of the temp line
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

    // Remove temp line
    if (tempLine && canvas.value) {
      canvas.value.remove(tempLine);
      tempLine = null;
    }

    // Clear temp points/lines (except focusFrame)
    const objects = canvas.value.getObjects();
    [...objects].forEach((obj) => {
      if (
        obj !== focusFrame &&
        (obj instanceof Circle || obj instanceof Line)
      ) {
        canvas.value!.remove(obj);
      }
    });

    const polygon = new Polygon(points.value, {
      fill: "rgba(255, 255, 255, 0.2)",
      stroke: "yellow",
      strokeWidth: 2,
      selectable: true,
    });

    canvas.value.add(polygon);
    activeTool.value = null;
    canvas.value.selection = true;
    points.value = [];

    if (canvas.value) {
      canvas.value.defaultCursor = "default";
      canvas.value.hoverCursor = "move";
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
    if (canvas.value) {
      canvas.value.dispose();
      canvas.value = null;
    }
  };

  return {
    canvas,
    activeTool,
    initFabric,
    handleSelectTool,
    clearFabric,
  };
}
