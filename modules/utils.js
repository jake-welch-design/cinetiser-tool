/**
 * Utility functions for the Depth Map Explorer
 */

export class Utils {
  /**
   * Maps a value from one range to another
   */
  static map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }

  /**
   * Gets pixel data from ImageData at specific coordinates
   */
  static getPixel(imageData, x, y) {
    // Clamp coordinates to image bounds
    x = Math.max(0, Math.min(x, imageData.width - 1));
    y = Math.max(0, Math.min(y, imageData.height - 1));

    const index = (y * imageData.width + x) * 4;

    // Check if index is within bounds
    if (index < 0 || index >= imageData.data.length) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    return {
      r: imageData.data[index] || 0,
      g: imageData.data[index + 1] || 0,
      b: imageData.data[index + 2] || 0,
      a: imageData.data[index + 3] || 0,
    };
  }

  /**
   * Calculates brightness from RGB values (same as Processing's brightness() function)
   */
  static getBrightness(r, g, b) {
    return (r + g + b) / 3;
  }

  /**
   * Loads an image from a URL
   */
  static async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Clamps a value between min and max
   */
  static clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  /**
   * Calculates aspect ratio fitting dimensions
   */
  static calculateFitDimensions(
    sourceAspect,
    targetAspect,
    targetWidth,
    targetHeight
  ) {
    let width, height;

    if (sourceAspect > targetAspect) {
      height = targetHeight;
      width = height * sourceAspect;
    } else {
      width = targetWidth;
      height = width / sourceAspect;
    }

    return { width, height };
  }
}
