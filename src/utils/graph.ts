/**
 * THUẬT TOÁN TÌM SUB-POLYGONS (MINIMAL FACES) TỪ PLANAR GRAPH
 *
 * Input: points[] và edges[] tạo thành một planar graph (đồ thị phẳng)
 * Output: Mảng các sub-polygon (các mặt bên trong, không bao gồm outer boundary)
 *
 * Các bước:
 * 1. buildAdjacencyList: Xây adjacency list, sắp xếp neighbors theo góc (CCW)
 * 2. traceFace: Với mỗi directed edge, đi theo chiều clockwise để trace một face
 *    - Tại mỗi đỉnh, chọn neighbor "tiếp theo" (prev - 1 trong sorted list)
 *    - Khi quay về điểm bắt đầu → hoàn thành 1 face
 * 3. Lọc bỏ duplicate faces và faces không hợp lệ (area = 0)
 * 4. Loại bỏ outer boundary (face có diện tích lớn nhất)
 *
 * Ví dụ hip roof: 6 points, 9 edges → 5 faces → loại outer → 4 sub-polygons
 */
import type { Edge, Point, SubPolygon } from "@/composables/useFabricMap";

const EPSILON = 0.0001;

const isSamePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;

const findPointIndex = (points: Point[], target: Point) =>
  points.findIndex((p) => isSamePoint(p, target));

const getAngle = (center: Point, target: Point) =>
  Math.atan2(target.y - center.y, target.x - center.x);

const buildAdjacencyList = (points: Point[], edges: Edge[]) => {
  const adj = new Map<number, number[]>();
  points.forEach((_, i) => adj.set(i, []));

  edges.forEach((edge) => {
    const fromIdx = findPointIndex(points, edge.from);
    const toIdx = findPointIndex(points, edge.to);
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      adj.get(fromIdx)!.push(toIdx);
      adj.get(toIdx)!.push(fromIdx);
    }
  });

  points.forEach((center, i) => {
    adj
      .get(i)!
      .sort(
        (a, b) => getAngle(center, points[a]!) - getAngle(center, points[b]!),
      );
  });

  return adj;
};

const getNextVertex = (
  adj: Map<number, number[]>,
  current: number,
  previous: number,
) => {
  const neighbors = adj.get(current)!;
  const prevIndex = neighbors.indexOf(previous);
  return neighbors[(prevIndex - 1 + neighbors.length) % neighbors.length]!;
};

const traceFace = (
  adj: Map<number, number[]>,
  start: number,
  next: number,
  maxLen: number,
) => {
  const face = [start, next];
  let current = next;
  let previous = start;

  while (face.length <= maxLen) {
    const nextV = getNextVertex(adj, current, previous);
    if (nextV === start) return face;
    if (face.includes(nextV)) return null;
    face.push(nextV);
    previous = current;
    current = nextV;
  }
  return null;
};

const isValidFace = (points: Point[], faceIndices: number[]) => {
  if (faceIndices.length < 3) return false;
  let area = 0;
  const n = faceIndices.length;
  for (let i = 0; i < n; i++) {
    const curr = points[faceIndices[i]!]!;
    const next = points[faceIndices[(i + 1) % n]!]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(area) > EPSILON;
};

const isSameFace = (f1: number[], f2: number[]) =>
  f1.length === f2.length &&
  [...f1].sort((a, b) => a - b).join(",") ===
    [...f2].sort((a, b) => a - b).join(",");

const getFaceArea = (points: Point[], faceIndices: number[]) => {
  let area = 0;
  const n = faceIndices.length;
  for (let i = 0; i < n; i++) {
    const curr = points[faceIndices[i]!]!;
    const next = points[faceIndices[(i + 1) % n]!]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(area) / 2;
};

export const getSubPolygons = (
  points: Point[],
  edges: Edge[],
): SubPolygon[] => {
  if (points.length < 3 || edges.length < 3) return [];

  const adj = buildAdjacencyList(points, edges);
  const faces: number[][] = [];
  const maxLen = points.length + 1;

  edges.forEach((edge) => {
    const fromIdx = findPointIndex(points, edge.from);
    const toIdx = findPointIndex(points, edge.to);
    if (fromIdx === -1 || toIdx === -1) return;

    [
      [fromIdx, toIdx],
      [toIdx, fromIdx],
    ].forEach(([s, n]) => {
      const face = traceFace(adj, s!, n!, maxLen);
      if (
        face &&
        isValidFace(points, face) &&
        !faces.some((f) => isSameFace(f, face))
      ) {
        faces.push(face);
      }
    });
  });

  if (faces.length <= 1)
    return faces.map((f) => f.map((idx) => ({ ...points[idx]! })));

  const faceAreas = faces.map((f) => getFaceArea(points, f));
  const maxAreaIndex = faceAreas.indexOf(Math.max(...faceAreas));

  return faces
    .filter((_, i) => i !== maxAreaIndex)
    .map((f) => f.map((idx) => ({ ...points[idx]! })));
};
