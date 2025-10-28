/**
 * Utility functions for common tasks
 */

export class Utils {
  /**
   * Load an image from a URL or data URL
   * @param {string} url - Image URL or data URL
   * @returns {Promise<HTMLImageElement>}
   */
  static loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Convert a File to a data URL
   * @param {File} file - File object
   * @returns {Promise<string>}
   */
  static fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Download a data URL as a file
   * @param {string} dataURL - Data URL to download
   * @param {string} filename - Filename for download
   */
  static downloadDataURL(dataURL, filename = "download.png") {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Map a value from one range to another
   * @param {number} value - Input value
   * @param {number} start1 - Start of input range
   * @param {number} stop1 - End of input range
   * @param {number} start2 - Start of output range
   * @param {number} stop2 - End of output range
   * @returns {number}
   */
  static map(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }

  /**
   * Clamp a value between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Linear interpolation between two values
   * @param {number} start - Start value
   * @param {number} end - End value
   * @param {number} amount - Amount to interpolate (0-1)
   * @returns {number}
   */
  static lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  /**
   * Get a random number between min and max
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  static random(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Get a random integer between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  static randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number}
   */
  static degToRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   * @param {number} radians
   * @returns {number}
   */
  static radToDeg(radians) {
    return radians * (180 / Math.PI);
  }

  /**
   * Debounce a function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function}
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle a function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function}
   */
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Format a number with commas
   * @param {number} num
   * @returns {string}
   */
  static formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /**
   * Get the current timestamp in a readable format
   * @returns {string}
   */
  static getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/:/g, "-").split(".")[0];
  }

  /**
   * Scale a canvas element to fit within the viewport while maintaining aspect ratio
   * @param {HTMLCanvasElement} canvasElement - The canvas DOM element to scale
   * @param {number} canvasWidth - The logical width of the canvas
   * @param {number} canvasHeight - The logical height of the canvas
   * @param {number} margin - Margin to leave around the canvas (default: 20)
   */
  static scaleCanvasToFit(canvasElement, canvasWidth, canvasHeight, margin = 20) {
    if (!canvasElement) return;

    const container = document.getElementById("canvas-container");
    if (container) container.style.padding = "10px";

    const maxWidth = window.innerWidth - margin;
    const maxHeight = window.innerHeight - margin;

    const canvasAspect = canvasWidth / canvasHeight;
    const windowAspect = maxWidth / maxHeight;

    let scale;
    if (canvasAspect > windowAspect) {
      scale = maxWidth / canvasWidth;
    } else {
      scale = maxHeight / canvasHeight;
    }

    scale = Math.min(scale, 1);

    canvasElement.style.width = `${canvasWidth * scale}px`;
    canvasElement.style.height = `${canvasHeight * scale}px`;
  }
}
