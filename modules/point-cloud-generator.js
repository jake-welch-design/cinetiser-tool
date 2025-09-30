import * as THREE from "three";
import { Utils } from "./utils.js";

/**
 * Generates point clouds from processed image data
 */
export class PointCloudGenerator {
  constructor() {
    this.currentPointCloud = null;
    this.depthValues = null;
    this.zOffsetMin = 0;
    this.zOffsetMax = 100;
  }

  /**
   * Generate a point cloud from image data
   */
  generate(imageProcessor, parameters) {
    const {
      layerWidth,
      layerHeight,
      tilesX,
      tilesY,
      pointSize,
      zOffsetMin,
      zOffsetMax,
      gridDensity = 1.0,
    } = parameters;

    const { depthMapData, imgData } = imageProcessor.getImageData();

    if (!depthMapData || !imgData) {
      console.error("No image data available for point cloud generation");
      return null;
    }

    // Calculate tile dimensions adjusted by grid density
    const baseTilesW = Math.ceil(layerWidth / tilesX);
    const baseTilesH = Math.ceil(layerHeight / tilesY);

    // Grid density affects the sampling step - higher density = smaller steps = more points
    const tilesW = Math.max(1, Math.ceil(baseTilesW / gridDensity));
    const tilesH = Math.max(1, Math.ceil(baseTilesH / gridDensity));

    const positions = [];
    const colors = [];
    const depthValues = [];

    this.zOffsetMin = zOffsetMin;
    this.zOffsetMax = zOffsetMax;

    // Calculate actual number of tiles that fit with grid density
    const numTilesX = Math.floor(layerWidth / tilesW);
    const numTilesY = Math.floor(layerHeight / tilesH);

    console.log("Creating point cloud with:", {
      layerWidth,
      layerHeight,
      tilesX,
      tilesY,
      gridDensity,
      tilesW,
      tilesH,
      numTilesX,
      numTilesY,
      totalPoints: numTilesX * numTilesY,
    });

    // Generate points
    for (let x = 0; x < numTilesX; x++) {
      for (let y = 0; y < numTilesY; y++) {
        const point = this._generatePoint(
          x,
          y,
          tilesW,
          tilesH,
          layerWidth,
          layerHeight,
          depthMapData,
          imgData,
          zOffsetMin,
          zOffsetMax
        );

        if (point) {
          positions.push(...point.position);
          colors.push(...point.color);
          depthValues.push(point.brightness);
        }
      }
    }

    this.depthValues = depthValues;

    console.log("Generated", positions.length / 3, "points");

    if (positions.length === 0) {
      console.error("No valid points generated!");
      return null;
    }

    return this._createPointCloudMesh(positions, colors, pointSize);
  }

  /**
   * Generate a single point from tile coordinates
   */
  _generatePoint(
    x,
    y,
    tilesW,
    tilesH,
    layerWidth,
    layerHeight,
    depthMapData,
    imgData,
    zOffsetMin,
    zOffsetMax
  ) {
    // Calculate pixel position for this tile
    const px = Math.floor(x * tilesW);
    const py = Math.floor(y * tilesH);

    // Sample pixels from center of each tile
    const sampleX = Math.min(px + Math.floor(tilesW * 0.5), layerWidth - 1);
    const sampleY = Math.min(py + Math.floor(tilesH * 0.5), layerHeight - 1);

    // Ensure coordinates are within bounds
    if (
      sampleX < 0 ||
      sampleX >= layerWidth ||
      sampleY < 0 ||
      sampleY >= layerHeight
    ) {
      return null;
    }

    // Get color from image
    const imgPixel = Utils.getPixel(imgData, sampleX, sampleY);
    const depthPixel = Utils.getPixel(depthMapData, sampleX, sampleY);

    // Check for invalid pixel data
    if (
      !imgPixel ||
      !depthPixel ||
      isNaN(imgPixel.r) ||
      isNaN(imgPixel.g) ||
      isNaN(imgPixel.b) ||
      isNaN(depthPixel.r) ||
      isNaN(depthPixel.g) ||
      isNaN(depthPixel.b)
    ) {
      return null;
    }

    // Calculate brightness and Z position
    const brightness = Utils.getBrightness(
      depthPixel.r,
      depthPixel.g,
      depthPixel.b
    );
    const z = Utils.map(brightness, 0, 255, zOffsetMin, zOffsetMax);

    if (isNaN(z)) {
      return null;
    }

    // Convert to Three.js coordinate system (center at origin)
    const worldX = px - layerWidth * 0.5;
    const worldY = -(py - layerHeight * 0.5); // Flip Y and center
    const worldZ = z;

    // Final NaN check
    if (isNaN(worldX) || isNaN(worldY) || isNaN(worldZ)) {
      return null;
    }

    // Gmma correction to make pixels true to image colors
    const gamma = 2.2;
    const correctedR = Math.pow(imgPixel.r / 255, gamma);
    const correctedG = Math.pow(imgPixel.g / 255, gamma);
    const correctedB = Math.pow(imgPixel.b / 255, gamma);

    return {
      position: [worldX, worldY, worldZ],
      color: [correctedR, correctedG, correctedB],
      brightness: brightness,
    };
  }

  /**
   * Create Three.js point cloud mesh
   */
  _createPointCloudMesh(positions, colors, pointSize) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: false, // Keep points same size regardless of distance
      alphaTest: 0.5, // Helps with rendering
      transparent: false,
    });

    const pointCloud = new THREE.Points(geometry, material);
    this.currentPointCloud = pointCloud;

    return pointCloud;
  }

  /**
   * Get the current point cloud
   */
  getCurrentPointCloud() {
    return this.currentPointCloud;
  }

  /**
   * Update Z positions in real-time without regenerating the entire point cloud
   */
  updateMaxDepth(newZOffsetMax) {
    if (!this.currentPointCloud || !this.depthValues) {
      return false;
    }

    this.zOffsetMax = newZOffsetMax;

    const positionAttribute =
      this.currentPointCloud.geometry.getAttribute("position");
    if (!positionAttribute) {
      return false;
    }

    const positions = positionAttribute.array;

    // Update Z positions based on stored brightness values
    for (let i = 0; i < this.depthValues.length; i++) {
      const brightness = this.depthValues[i];
      const newZ = Utils.map(
        brightness,
        0,
        255,
        this.zOffsetMin,
        this.zOffsetMax
      );
      positions[i * 3 + 2] = newZ; // Z is the third component (index 2)
    }

    // Mark the position attribute as needing update
    positionAttribute.needsUpdate = true;

    return true;
  }

  /**
   * Clean up the current point cloud
   */
  cleanup() {
    if (this.currentPointCloud) {
      if (this.currentPointCloud.geometry) {
        this.currentPointCloud.geometry.dispose();
      }
      if (this.currentPointCloud.material) {
        this.currentPointCloud.material.dispose();
      }
      this.currentPointCloud = null;
    }
    this.depthValues = null;
  }
}
