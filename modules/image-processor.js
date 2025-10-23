/**
 * Image processing utilities for p5.js
 * Handles loading, centering, and fitting images to canvas
 */

/**
 * Calculate dimensions to fit image to canvas while maintaining aspect ratio
 * and filling the entire canvas (with cropping if necessary)
 */
export function calculateCoverDimensions(imgWidth, imgHeight, canvasWidth, canvasHeight) {
  const imgAspect = imgWidth / imgHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let drawWidth, drawHeight;

  if (imgAspect > canvasAspect) {
    // Image is wider than canvas - fit to height
    drawHeight = canvasHeight;
    drawWidth = drawHeight * imgAspect;
  } else {
    // Image is taller than canvas - fit to width
    drawWidth = canvasWidth;
    drawHeight = drawWidth / imgAspect;
  }

  return {
    width: drawWidth,
    height: drawHeight,
    offsetX: (canvasWidth - drawWidth) / 2,
    offsetY: (canvasHeight - drawHeight) / 2,
  };
}

/**
 * Draw image to fill canvas, centered and cropped to maintain aspect ratio
 * Use this in your p5.js draw() function
 *
 * @param {p5.Image} img - The p5.js image object
 * @param {number} canvasWidth - Width of the canvas
 * @param {number} canvasHeight - Height of the canvas
 */
/**
 * Instance-mode aware: pass the p5 instance as first argument.
 * Draw image to fill canvas, centered and cropped to maintain aspect ratio
 * @param {number} offsetX - Additional X offset for positioning
 * @param {number} offsetY - Additional Y offset for positioning
 * @param {number} zoom - Zoom level (1.0 = normal, > 1.0 = zoom in, < 1.0 = zoom out)
 */
export function drawImageCover(p, img, canvasWidth, canvasHeight, offsetX = 0, offsetY = 0, zoom = 1.0) {
  if (!img) return;

  const dims = calculateCoverDimensions(img.width, img.height, canvasWidth, canvasHeight);

  p.push();
  p.imageMode(p.CENTER);
  p.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
  p.scale(zoom);
  p.image(img, 0, 0, dims.width, dims.height);
  p.pop();
}

/**
 * Calculate the minimum zoom level that keeps the image covering the entire canvas
 * Returns the minimum zoom where no empty space is visible
 */
export function calculateMinZoom(imgWidth, imgHeight, canvasWidth, canvasHeight) {
  // calculateCoverDimensions sizes the image at zoom 1.0 to exactly cover the canvas
  // One dimension matches exactly, the other is larger
  // If we zoom below 1.0, the image shrinks and won't cover the canvas anymore
  // Therefore, the minimum zoom to maintain coverage is always 1.0
  return 1.0;
}

/**
 * Calculate the min and max position offsets that keep the image within bounds
 * Returns the range the image can be moved without showing empty space
 * @param {number} zoom - Current zoom level to account for when calculating bounds
 */
export function calculatePositionBounds(imgWidth, imgHeight, canvasWidth, canvasHeight, zoom = 1.0) {
  const dims = calculateCoverDimensions(imgWidth, imgHeight, canvasWidth, canvasHeight);

  // Apply zoom to dimensions
  const zoomedWidth = dims.width * zoom;
  const zoomedHeight = dims.height * zoom;

  // Calculate how much extra space the image has beyond the canvas
  const excessWidth = zoomedWidth - canvasWidth;
  const excessHeight = zoomedHeight - canvasHeight;

  // The image can move half the excess in each direction
  return {
    minX: -excessWidth / 2,
    maxX: excessWidth / 2,
    minY: -excessHeight / 2,
    maxY: excessHeight / 2,
  };
}

/**
 * Calculate dimensions to fit image within canvas while maintaining aspect ratio
 * (with letterboxing if necessary)
 */
export function calculateContainDimensions(imgWidth, imgHeight, canvasWidth, canvasHeight) {
  const imgAspect = imgWidth / imgHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let drawWidth, drawHeight;

  if (imgAspect > canvasAspect) {
    // Image is wider - fit to width
    drawWidth = canvasWidth;
    drawHeight = drawWidth / imgAspect;
  } else {
    // Image is taller - fit to height
    drawHeight = canvasHeight;
    drawWidth = drawHeight * imgAspect;
  }

  return {
    width: drawWidth,
    height: drawHeight,
    offsetX: (canvasWidth - drawWidth) / 2,
    offsetY: (canvasHeight - drawHeight) / 2,
  };
}

/**
 * Draw image to fit within canvas, centered with letterboxing if needed
 * Use this in your p5.js draw() function
 *
 * @param {p5.Image} img - The p5.js image object
 * @param {number} canvasWidth - Width of the canvas
 * @param {number} canvasHeight - Height of the canvas
 */
/**
 * Instance-mode aware: pass the p5 instance as first argument.
 * Draw image to fit within canvas, centered with letterboxing if needed
 */
export function drawImageContain(p, img, canvasWidth, canvasHeight) {
  if (!img) return;

  const dims = calculateContainDimensions(img.width, img.height, canvasWidth, canvasHeight);

  p.push();
  p.imageMode(p.CENTER);
  p.translate(canvasWidth / 2, canvasHeight / 2);
  p.image(img, 0, 0, dims.width, dims.height);
  p.pop();
}
