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
