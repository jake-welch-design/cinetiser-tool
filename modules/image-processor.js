import { Utils } from "./utils.js";

/**
 * Handles image processing and canvas operations
 */
export class ImageProcessor {
  constructor() {
    this.depthMapCanvas = null;
    this.imgCanvas = null;
    this.depthMapData = null;
    this.imgData = null;
  }

  /**
   * Process two images (depth map and display image) to fit the specified dimensions
   */
  processImages(depthMap, displayImg, layerWidth, layerHeight) {
    console.log("Processing images:", {
      depthMap: { width: depthMap.width, height: depthMap.height },
      displayImg: { width: displayImg.width, height: displayImg.height },
      layerWidth,
      layerHeight,
    });

    // Create canvases for processing images
    this.depthMapCanvas = document.createElement("canvas");
    this.imgCanvas = document.createElement("canvas");

    this.depthMapCanvas.width = layerWidth;
    this.depthMapCanvas.height = layerHeight;
    this.imgCanvas.width = layerWidth;
    this.imgCanvas.height = layerHeight;

    const depthMapCtx = this.depthMapCanvas.getContext("2d");
    const imgCtx = this.imgCanvas.getContext("2d");

    // Calculate aspect ratios and dimensions
    const depthMapAspect = depthMap.width / depthMap.height;
    const imgAspect = displayImg.width / displayImg.height;
    const layerAspect = layerWidth / layerHeight;

    // Calculate fitted dimensions
    const depthDims = Utils.calculateFitDimensions(
      depthMapAspect,
      layerAspect,
      layerWidth,
      layerHeight
    );
    const imgDims = Utils.calculateFitDimensions(
      imgAspect,
      layerAspect,
      layerWidth,
      layerHeight
    );

    console.log("Calculated dimensions:", {
      depth: depthDims,
      img: imgDims,
    });

    // Process depth map
    this._drawImageToCanvas(
      depthMapCtx,
      depthMap,
      depthDims,
      layerWidth,
      layerHeight
    );

    // Process display image
    this._drawImageToCanvas(
      imgCtx,
      displayImg,
      imgDims,
      layerWidth,
      layerHeight
    );

    // Extract image data for pixel sampling
    try {
      this.depthMapData = depthMapCtx.getImageData(
        0,
        0,
        layerWidth,
        layerHeight
      );
      this.imgData = imgCtx.getImageData(0, 0, layerWidth, layerHeight);
      console.log("Image data extracted successfully");
    } catch (error) {
      console.error("Error extracting image data:", error);
      throw error;
    }
  }

  /**
   * Draw image to canvas with centering and cropping
   */
  _drawImageToCanvas(ctx, image, dimensions, canvasWidth, canvasHeight) {
    // Clear with black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Translate to center
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    // Calculate source cropping if image is larger than canvas
    const sourceX =
      dimensions.width > canvasWidth ? (dimensions.width - canvasWidth) / 2 : 0;
    const sourceY =
      dimensions.height > canvasHeight
        ? (dimensions.height - canvasHeight) / 2
        : 0;
    const sourceW = Math.min(dimensions.width, canvasWidth);
    const sourceH = Math.min(dimensions.height, canvasHeight);

    // Calculate destination position (always centered)
    const destX = -sourceW / 2;
    const destY = -sourceH / 2;

    ctx.drawImage(
      image,
      sourceX * (image.width / dimensions.width), // source x (scaled back to original image coords)
      sourceY * (image.height / dimensions.height), // source y
      sourceW * (image.width / dimensions.width), // source width
      sourceH * (image.height / dimensions.height), // source height
      destX, // dest x
      destY, // dest y
      sourceW, // dest width
      sourceH // dest height
    );

    ctx.restore();
  }

  /**
   * Get pixel data at specific coordinates
   */
  getPixel(imageData, x, y) {
    return Utils.getPixel(imageData, x, y);
  }

  /**
   * Get the processed image data
   */
  getImageData() {
    return {
      depthMapData: this.depthMapData,
      imgData: this.imgData,
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.depthMapCanvas = null;
    this.imgCanvas = null;
    this.depthMapData = null;
    this.imgData = null;
  }
}
