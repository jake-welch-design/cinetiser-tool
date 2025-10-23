import gui from "./gui.js";
import { getDefaultParameters } from "./modules/config.js";
import {
  drawImageCover,
  drawImageContain,
  calculatePositionBounds,
  calculateMinZoom,
  calculateCoverDimensions,
} from "./modules/image-processor.js";

// p5.js Sketch - Instance Mode

let params = getDefaultParameters();

export default function sketch(p) {
  let loadedImage = null;
  let canvasElement = null;
  // Graphics layers for effect
  let buffer = null;
  let imgLayer = null;
  let display = null; // replaced "tile" — this will be drawn onto the main canvas

  // Cursor preview and slice placement state
  let showCursorPreview = false;
  let cursorX = 0;
  let cursorY = 0;
  let sliceCenterX = null; // null means center, or explicit click position
  let sliceCenterY = null;

  // Rotation transition state
  let rotationTransitionStart = null; // timestamp when rotation starts
  let rotationTransitionDuration = 1000; // milliseconds (1 second) - updated based on rotationSpeed

  // Pattern image caching for performance
  let patternImg = null;
  let lastPatternPosX = null;
  let lastPatternPosY = null;
  let lastPatternZoom = null;

  // Display layer caching - track if we need to redraw
  let lastCutSize = null;
  let lastSliceAmount = null;
  let lastRotationAmount = null;
  let lastDisplayPosX = null;
  let lastDisplayPosY = null;
  let lastDisplayZoom = null;

  // Effect parameters (can be hooked to GUI later)
  let bg = 0;
  let size = 500;
  let slice = 50;
  let rotAmt = 10;
  let speed = 0.004;
  let fps = 60;

  p.setup = function () {
    const canvas = p.createCanvas(params.canvasWidth, params.canvasHeight);
    canvas.parent("canvas-container");
    canvasElement = canvas.elt;
    p.background(0);

    // create effect graphics layers sized to the canvas resolution
    buffer = p.createGraphics(p.width, p.height);
    imgLayer = p.createGraphics(p.width, p.height);
    display = p.createGraphics(p.width, p.height);

    // Apply initial scaling to fit within viewport
    scaleCanvasToFit();

    // Connect GUI to sketch callbacks
    gui.connectSketch({
      onImageLoaded: handleImageLoaded,
      onParameterChange: handleParameterChange,
      saveCanvas: handleSave,
    });

    // Listen for window resize to keep canvas fitted
    window.addEventListener("resize", scaleCanvasToFit);

    console.log("p5.js (instance mode) sketch ready");
  };

  p.draw = function () {
    p.background(0);

    if (loadedImage) {
      // Check if we need to do heavy rendering
      // If animation is off and slices are placed, we only need to render on first frame
      const isAnimatedMode =
        params.animated !== undefined ? params.animated : true;
      const hasSlices = sliceCenterX !== null && sliceCenterY !== null;

      // Check if ring parameters have changed
      const ringParametersChanged =
        lastCutSize !== params.cutSize ||
        lastSliceAmount !== params.sliceAmount ||
        lastRotationAmount !== params.rotationAmount;

      // Check if image position or zoom has changed
      const imageTransformChanged =
        lastDisplayPosX !== params.imagePosX ||
        lastDisplayPosY !== params.imagePosY ||
        lastDisplayZoom !== params.imageZoom;

      // Skip rendering if animation is off, slices are placed, params haven't changed, and transition is done
      if (
        !isAnimatedMode &&
        hasSlices &&
        rotationTransitionStart === null &&
        !ringParametersChanged &&
        !imageTransformChanged
      ) {
        // Draw base image first
        const posBounds = calculatePositionBounds(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height,
          params.imageZoom
        );

        const posX = Math.max(
          posBounds.minX,
          Math.min(posBounds.maxX, params.imagePosX || 0)
        );
        const posY = Math.max(
          posBounds.minY,
          Math.min(posBounds.maxY, params.imagePosY || 0)
        );

        drawImageCover(
          p,
          loadedImage,
          p.width,
          p.height,
          posX,
          posY,
          params.imageZoom
        );

        // Then draw the cached display layer on top
        p.imageMode(p.CORNER);
        p.image(display, 0, 0, p.width, p.height);

        // Draw cursor preview if needed
        if (showCursorPreview) {
          // Calculate and draw preview ellipse (lightweight operation)
          const coverDims = calculateCoverDimensions(
            loadedImage.width,
            loadedImage.height,
            p.width,
            p.height
          );

          const posBounds = calculatePositionBounds(
            loadedImage.width,
            loadedImage.height,
            p.width,
            p.height,
            params.imageZoom
          );

          const posX = Math.max(
            posBounds.minX,
            Math.min(posBounds.maxX, params.imagePosX || 0)
          );
          const posY = Math.max(
            posBounds.minY,
            Math.min(posBounds.maxY, params.imagePosY || 0)
          );

          const zoomedImageWidth = coverDims.width * params.imageZoom;
          const zoomedImageHeight = coverDims.height * params.imageZoom;

          const imageCenterX = p.width / 2 + posX;
          const imageCenterY = p.height / 2 + posY;

          const imageLeft = imageCenterX - zoomedImageWidth / 2;
          const imageRight = imageCenterX + zoomedImageWidth / 2;
          const imageTop = imageCenterY - zoomedImageHeight / 2;
          const imageBottom = imageCenterY + zoomedImageHeight / 2;

          let previewCutSize = Math.max(1, params.cutSize || 300);
          const maxAllowedDiameter = Math.min(
            zoomedImageWidth,
            zoomedImageHeight
          );
          if (previewCutSize > maxAllowedDiameter) {
            previewCutSize = maxAllowedDiameter;
          }

          // Reduce preview size by one ring thickness to show the innermost drawable ring
          const sliceAmount = Math.max(1, Math.floor(params.sliceAmount || 10));
          const ringThickness = previewCutSize / sliceAmount;
          const adjustedPreviewSize = previewCutSize - ringThickness;

          const cutSizeRadius = adjustedPreviewSize / 2;

          const clampedCursorX = Math.max(
            imageLeft + cutSizeRadius,
            Math.min(imageRight - cutSizeRadius, cursorX)
          );
          const clampedCursorY = Math.max(
            imageTop + cutSizeRadius,
            Math.min(imageBottom - cutSizeRadius, cursorY)
          );

          p.stroke(255, 0, 0);
          p.strokeWeight(1);
          p.noFill();
          p.ellipse(
            clampedCursorX,
            clampedCursorY,
            adjustedPreviewSize,
            adjustedPreviewSize
          );
        }
        return; // Skip the rest of rendering
      }
      // Compute allowed position bounds and clamp image offsets to avoid black edges
      const posBounds = calculatePositionBounds(
        loadedImage.width,
        loadedImage.height,
        p.width,
        p.height,
        params.imageZoom
      );

      const posX = Math.max(
        posBounds.minX,
        Math.min(posBounds.maxX, params.imagePosX || 0)
      );
      const posY = Math.max(
        posBounds.minY,
        Math.min(posBounds.maxY, params.imagePosY || 0)
      );

      // First, draw the base image to the main canvas (preserve original behavior)
      drawImageCover(
        p,
        loadedImage,
        p.width,
        p.height,
        posX,
        posY,
        params.imageZoom
      );

      // Render the source image into an offscreen layer (imgLayer) using the same clamped cover/position/zoom
      // Only regenerate if position or zoom changed
      const needsPatternUpdate =
        lastPatternPosX !== posX ||
        lastPatternPosY !== posY ||
        lastPatternZoom !== params.imageZoom;

      if (needsPatternUpdate) {
        imgLayer.clear();
        // drawImageCover is instance-aware; pass imgLayer so it draws into the pgraphics with the same transform
        drawImageCover(
          imgLayer,
          loadedImage,
          imgLayer.width,
          imgLayer.height,
          posX,
          posY,
          params.imageZoom
        );

        // Convert pgraphics to p.Image for use with copy/clip
        patternImg = imgLayer.get();

        // Cache the values
        lastPatternPosX = posX;
        lastPatternPosY = posY;
        lastPatternZoom = params.imageZoom;
      }

      // Prepare display layer
      display.clear();

      // Animation angle (oscillates)
      const angle = p.map(p.sin(p.frameCount * speed), -1, 1, -rotAmt, rotAmt);

      // Use GUI parameters for cut size and slice amount
      // cutSize is the outer diameter of the largest ring
      // sliceAmount is the number of divisions within that size
      let cutSize = Math.max(1, params.cutSize || 300);
      const sliceAmount = Math.max(1, Math.floor(params.sliceAmount || 10));

      // Clamp cutSize to fit within image bounds
      // Calculate image bounds to get maximum allowable diameter
      if (loadedImage) {
        const coverDims = calculateCoverDimensions(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height
        );

        const zoomedImageWidth = coverDims.width * params.imageZoom;
        const zoomedImageHeight = coverDims.height * params.imageZoom;

        // Maximum diameter is the smaller of width or height of the zoomed image
        const maxAllowedDiameter = Math.min(
          zoomedImageWidth,
          zoomedImageHeight
        );
        if (cutSize > maxAllowedDiameter) {
          cutSize = maxAllowedDiameter;
        }
      }

      // Calculate ring thickness (distance between consecutive rings)
      const ringThickness = cutSize / sliceAmount;

      // maxDiameter is the outer size of the largest ring
      let maxDiameter = cutSize;

      // Only render slices if user has clicked to place them
      if (sliceCenterX !== null && sliceCenterY !== null) {
        // Build circular, rotating layers into `display` sampling from patternImg
        // Calculate image bounds on canvas to clamp slice center position
        const coverDims = calculateCoverDimensions(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height
        );

        // Apply zoom to get actual displayed dimensions
        const zoomedImageWidth = coverDims.width * params.imageZoom;
        const zoomedImageHeight = coverDims.height * params.imageZoom;

        // Image is centered at (p.width/2 + posX, p.height/2 + posY)
        const imageCenterX = p.width / 2 + posX;
        const imageCenterY = p.height / 2 + posY;

        // Image bounds in canvas space
        const imageLeft = imageCenterX - zoomedImageWidth / 2;
        const imageRight = imageCenterX + zoomedImageWidth / 2;
        const imageTop = imageCenterY - zoomedImageHeight / 2;
        const imageBottom = imageCenterY + zoomedImageHeight / 2;

        // Clamp slice center to stay within image bounds
        // Use same logic as preview: just the radius
        const maxRadius = maxDiameter / 2;

        const clampedCenterX = Math.max(
          imageLeft + maxRadius,
          Math.min(imageRight - maxRadius, sliceCenterX)
        );
        const clampedCenterY = Math.max(
          imageTop + maxRadius,
          Math.min(imageBottom - maxRadius, sliceCenterY)
        );

        const centerX = clampedCenterX;
        const centerY = clampedCenterY;

        // Determine rotation amount and speed from params
        // Use proper null/undefined check for rotationAmount so 0 is not treated as falsy
        const rotationAmount =
          params.rotationAmount !== undefined
            ? params.rotationAmount
            : rotAmt;
        const rotationSpeed = params.rotationSpeed || speed;
        const isAnimated =
          params.animated !== undefined ? params.animated : true;

        // Calculate transition duration based on rotation speed
        // Match lerp speed to animation oscillation speed
        // The animation completes one full cycle when p.frameCount * rotationSpeed goes from 0 to 2π
        // We want the lerp to complete in roughly 2-3 animation cycles for visual harmony
        // Duration (ms) = (2π / rotationSpeed) / frameRate * 2.5 cycles
        const frameRate = 60; // p5.js default
        const cycleDuration =
          ((Math.PI * 2) / Math.max(rotationSpeed, 0.0001) / frameRate) * 1000;
        rotationTransitionDuration = Math.max(500, cycleDuration * 0.05);

        // Calculate rotation lerp progress (0 to 1)
        let rotationProgress = 1.0; // Default to full rotation
        if (rotationTransitionStart !== null) {
          const elapsed = p.millis() - rotationTransitionStart;
          rotationProgress = Math.min(
            elapsed / rotationTransitionDuration,
            1.0
          );
          // Stop tracking transition once complete
          if (rotationProgress >= 1.0) {
            rotationTransitionStart = null;
          }
        }

        // Only render slices if rotation amount is greater than 0
        // When rotation amount is 0, no cinetisation effect is visible
        if (rotationAmount > 0) {
          for (let i = 0; i < sliceAmount; i++) {
          // Each ring gets progressively smaller from the outer edge
          const currentSize = maxDiameter - i * ringThickness;

          // Lerp rotation amount based on transition progress
          const lerpedRotationAmount = rotationAmount * rotationProgress;

          const currentRotation = p.radians(
            (isAnimated
              ? p.map(
                  p.sin(p.frameCount * rotationSpeed),
                  -1,
                  1,
                  -lerpedRotationAmount,
                  lerpedRotationAmount
                )
              : lerpedRotationAmount) * i
          );

          const sw = Math.max(1, Math.floor(currentSize));
          const sh = Math.max(1, Math.floor(currentSize));

          // sample top-left coordinates on the pattern image
          const sx = Math.max(0, Math.floor(centerX - sw / 2));
          const sy = Math.max(0, Math.floor(centerY - sh / 2));

          // Reuse a single temp graphics buffer, resizing as needed
          // This is much more efficient than creating a new one each iteration
          if (!buffer || buffer.width !== sw || buffer.height !== sh) {
            if (buffer) buffer.remove();
            buffer = p.createGraphics(sw, sh);
          }

          buffer.clear();
          buffer.push();
          buffer.drawingContext.save();
          buffer.drawingContext.beginPath();
          buffer.drawingContext.ellipse(
            sw / 2,
            sh / 2,
            sw / 2,
            sh / 2,
            0,
            0,
            Math.PI * 2
          );
          buffer.drawingContext.clip();
          buffer.image(patternImg, 0, 0, sw, sh, sx, sy, sw, sh);
          buffer.drawingContext.restore();
          buffer.pop();

          // composite into display, centered at image center
          display.push();
          display.imageMode(display.CENTER);
          display.translate(centerX, centerY);
          display.rotate(currentRotation);
          display.image(buffer, 0, 0);
          display.pop();
          }
        }
      } // Close the "if sliceCenterX !== null" conditional

      // Cache the ring parameters for next frame comparison
      lastCutSize = params.cutSize;
      lastSliceAmount = params.sliceAmount;
      lastRotationAmount = params.rotationAmount;

      // Cache the display transform for next frame comparison
      lastDisplayPosX = params.imagePosX;
      lastDisplayPosY = params.imagePosY;
      lastDisplayZoom = params.imageZoom;

      // Draw the composed display layer onto the main canvas on top of base image
      p.imageMode(p.CORNER);
      p.image(display, 0, 0, p.width, p.height);

      // Draw cursor preview ellipse if image is loaded and mouse is within canvas
      if (showCursorPreview) {
        // Calculate image bounds to clamp cursor preview
        const coverDims = calculateCoverDimensions(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height
        );

        const zoomedImageWidth = coverDims.width * params.imageZoom;
        const zoomedImageHeight = coverDims.height * params.imageZoom;

        const imageCenterX = p.width / 2 + posX;
        const imageCenterY = p.height / 2 + posY;

        const imageLeft = imageCenterX - zoomedImageWidth / 2;
        const imageRight = imageCenterX + zoomedImageWidth / 2;
        const imageTop = imageCenterY - zoomedImageHeight / 2;
        const imageBottom = imageCenterY + zoomedImageHeight / 2;

        // Clamp cursor position to image bounds
        // For the preview ellipse itself (not rotated), we just need the radius
        // Also clamp the cutSize to image bounds
        let previewCutSize = Math.max(1, params.cutSize || 300);
        const maxAllowedDiameter = Math.min(
          zoomedImageWidth,
          zoomedImageHeight
        );
        if (previewCutSize > maxAllowedDiameter) {
          previewCutSize = maxAllowedDiameter;
        }

        // Reduce preview size by one ring thickness to show the innermost drawable ring
        const sliceAmount = Math.max(1, Math.floor(params.sliceAmount || 10));
        const ringThickness = previewCutSize / sliceAmount;
        const adjustedPreviewSize = previewCutSize - ringThickness;

        const cutSizeRadius = adjustedPreviewSize / 2;

        const clampedCursorX = Math.max(
          imageLeft + cutSizeRadius,
          Math.min(imageRight - cutSizeRadius, cursorX)
        );
        const clampedCursorY = Math.max(
          imageTop + cutSizeRadius,
          Math.min(imageBottom - cutSizeRadius, cursorY)
        );

        p.stroke(255, 0, 0); // Red stroke
        p.strokeWeight(1);
        p.noFill();
        p.ellipse(
          clampedCursorX,
          clampedCursorY,
          adjustedPreviewSize,
          adjustedPreviewSize
        );
      }
    } else {
      // Placeholder text
      p.fill(255);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text("Upload an image to begin", p.width / 2, p.height / 2);
    }
  };

  // Track mouse movement to show preview
  p.mouseMoved = function () {
    if (loadedImage) {
      cursorX = p.mouseX;
      cursorY = p.mouseY;
      showCursorPreview = true;
    }
  };

  // Handle canvas click to place slices
  p.mousePressed = function () {
    // Use elementFromPoint as primary detection method
    // Convert p5 mouse coordinates to page coordinates
    const canvasRect = canvasElement.getBoundingClientRect();
    const pageX = canvasRect.left + p.mouseX;
    const pageY = canvasRect.top + p.mouseY;

    const clickTarget = document.elementFromPoint(pageX, pageY);

    // Check if click is on any interactive element
    if (clickTarget) {
      // Direct checks for common GUI elements
      if (
        clickTarget.tagName === "INPUT" ||
        clickTarget.tagName === "BUTTON" ||
        clickTarget.tagName === "LABEL" ||
        clickTarget.tagName === "SELECT"
      ) {
        return; // Let the form control handle it
      }

      // Check if it's a child of any interactive container
      if (clickTarget.closest("input, button, label, select, textarea")) {
        return; // Let the interactive element handle it
      }

      // Check if it's in the GUI container
      if (
        clickTarget.closest("#gui-container") ||
        clickTarget.closest("#gui-panel") ||
        clickTarget.closest("#controls-section")
      ) {
        return; // Let the GUI handle it
      }

      // Check for switch/checkbox elements specifically
      if (
        clickTarget.closest(".switch") ||
        clickTarget.closest(".range-container")
      ) {
        return; // Let the GUI element handle it
      }
    }

    // Additional fallback: check GUI panel bounds directly
    const guiPanel = document.getElementById("gui-panel");
    if (guiPanel && guiPanel.classList.contains("open")) {
      const guiRect = guiPanel.getBoundingClientRect();
      // If click is within GUI panel bounds, ignore it
      if (
        pageX >= guiRect.left &&
        pageX <= guiRect.right &&
        pageY >= guiRect.top &&
        pageY <= guiRect.bottom
      ) {
        return; // Click is on the GUI panel
      }
    }

    // Check GUI toggle button
    const guiToggle = document.getElementById("gui-toggle");
    if (guiToggle) {
      const toggleRect = guiToggle.getBoundingClientRect();
      if (
        pageX >= toggleRect.left &&
        pageX <= toggleRect.right &&
        pageY >= toggleRect.top &&
        pageY <= toggleRect.bottom
      ) {
        return; // Click is on the toggle button
      }
    }

    if (
      loadedImage &&
      p.mouseX >= 0 &&
      p.mouseX <= p.width &&
      p.mouseY >= 0 &&
      p.mouseY <= p.height
    ) {
      // Calculate image bounds and clamp click position to image
      const posBounds = calculatePositionBounds(
        loadedImage.width,
        loadedImage.height,
        p.width,
        p.height,
        params.imageZoom
      );

      const posX = Math.max(
        posBounds.minX,
        Math.min(posBounds.maxX, params.imagePosX || 0)
      );
      const posY = Math.max(
        posBounds.minY,
        Math.min(posBounds.maxY, params.imagePosY || 0)
      );

      const coverDims = calculateCoverDimensions(
        loadedImage.width,
        loadedImage.height,
        p.width,
        p.height
      );

      const zoomedImageWidth = coverDims.width * params.imageZoom;
      const zoomedImageHeight = coverDims.height * params.imageZoom;

      const imageCenterX = p.width / 2 + posX;
      const imageCenterY = p.height / 2 + posY;

      const imageLeft = imageCenterX - zoomedImageWidth / 2;
      const imageRight = imageCenterX + zoomedImageWidth / 2;
      const imageTop = imageCenterY - zoomedImageHeight / 2;
      const imageBottom = imageCenterY + zoomedImageHeight / 2;

      // Clamp click position to image bounds
      // For the ellipse (not rotated), we just need the radius
      const cutSizeRadius = params.cutSize / 2;

      const clampedClickX = Math.max(
        imageLeft + cutSizeRadius,
        Math.min(imageRight - cutSizeRadius, p.mouseX)
      );
      const clampedClickY = Math.max(
        imageTop + cutSizeRadius,
        Math.min(imageBottom - cutSizeRadius, p.mouseY)
      );

      // Set slice center to clamped click position
      sliceCenterX = clampedClickX;
      sliceCenterY = clampedClickY;
      // Start rotation transition when slices are placed
      rotationTransitionStart = p.millis();
      // Hide cursor preview after clicking
      showCursorPreview = false;
      return false; // Prevent default p5 behavior
    }
  };

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  // Scale canvas element to fit within window with margins while keeping resolution
  function scaleCanvasToFit() {
    if (!canvasElement) return;

    const container = document.getElementById("canvas-container");

    if (container) container.style.padding = "10px";

    const margin = 20; // 10px margin on each side
    const maxWidth = window.innerWidth - margin;
    const maxHeight = window.innerHeight - margin;

    const canvasAspect = params.canvasWidth / params.canvasHeight;
    const windowAspect = maxWidth / maxHeight;

    let scale;
    if (canvasAspect > windowAspect) {
      // Canvas is wider - fit to width
      scale = maxWidth / params.canvasWidth;
    } else {
      // Canvas is taller - fit to height
      scale = maxHeight / params.canvasHeight;
    }

    // Don't scale up beyond 100%
    scale = Math.min(scale, 1);

    canvasElement.style.width = `${params.canvasWidth * scale}px`;
    canvasElement.style.height = `${params.canvasHeight * scale}px`;
  }

  // Called when image is uploaded via GUI
  function handleImageLoaded(imageDataUrl) {
    // Use instance's loadImage so the image becomes a p5.Image bound to this instance
    p.loadImage(imageDataUrl, (img) => {
      loadedImage = img;
      console.log("Image loaded:", img.width, "x", img.height);

      // Update zoom and position slider bounds based on image dimensions
      updateZoomSliderBounds();
      updatePositionSliderBounds();
      updateCutSizeSliderBounds();
    });
  }

  // Update the min/max values of zoom slider based on image and canvas dimensions
  function updateZoomSliderBounds() {
    if (!loadedImage) return;

    const minZoom = calculateMinZoom(
      loadedImage.width,
      loadedImage.height,
      params.canvasWidth,
      params.canvasHeight
    );

    // Update zoom slider with calculated minimum, keep max at 3.0
    gui.updateSliderBounds("imageZoom", minZoom, 3.0);

    // Reset zoom to 1.0 (full cover)
    gui.updateParameterValue("imageZoom", 1.0);

    console.log(`Zoom bounds updated: min=${minZoom.toFixed(3)}, max=3.0`);
  }

  // Update the min/max values of position sliders based on image, canvas dimensions, and zoom
  function updatePositionSliderBounds() {
    if (!loadedImage) return;

    const bounds = calculatePositionBounds(
      loadedImage.width,
      loadedImage.height,
      params.canvasWidth,
      params.canvasHeight,
      params.imageZoom
    );

    // Update the sliders through the GUI
    gui.updateSliderBounds("imagePosX", bounds.minX, bounds.maxX);
    gui.updateSliderBounds("imagePosY", bounds.minY, bounds.maxY);

    // Reset positions to center (0, 0)
    gui.updateParameterValue("imagePosX", 0);
    gui.updateParameterValue("imagePosY", 0);
  }

  // Update the max value of cut size slider based on image and canvas dimensions
  function updateCutSizeSliderBounds() {
    if (!loadedImage) return;

    const coverDims = calculateCoverDimensions(
      loadedImage.width,
      loadedImage.height,
      params.canvasWidth,
      params.canvasHeight
    );

    const zoomedImageWidth = coverDims.width * params.imageZoom;
    const zoomedImageHeight = coverDims.height * params.imageZoom;

    // Maximum diameter is the smaller of width or height of the zoomed image
    const maxDiameter = Math.min(zoomedImageWidth, zoomedImageHeight);

    // Update cut size slider max to the calculated maximum
    gui.updateSliderBounds("cutSize", 100, maxDiameter);

    console.log(`Cut size bounds updated: max=${maxDiameter.toFixed(1)}`);
  }

  function handleParameterChange(paramName, value, allParameters) {
    params = allParameters;
    console.log(`Parameter ${paramName} changed to ${value}`);

    // Resize canvas if dimensions changed
    if (paramName === "canvasWidth" || paramName === "canvasHeight") {
      p.resizeCanvas(params.canvasWidth, params.canvasHeight);
      scaleCanvasToFit(); // Re-scale after resize

      // Recreate graphics layers at new resolution
      buffer = p.createGraphics(params.canvasWidth, params.canvasHeight);
      imgLayer = p.createGraphics(params.canvasWidth, params.canvasHeight);
      display = p.createGraphics(params.canvasWidth, params.canvasHeight);

      // Clear slice placement since coordinates are now invalid in new canvas
      sliceCenterX = null;
      sliceCenterY = null;
      rotationTransitionStart = null;

      // Invalidate pattern cache since canvas size changed
      lastPatternPosX = null;
      lastPatternPosY = null;
      lastPatternZoom = null;

      // Update zoom and position slider bounds when canvas size changes
      updateZoomSliderBounds();
      updatePositionSliderBounds();
      updateCutSizeSliderBounds();
    }

    // Update slider bounds when zoom changes
    if (paramName === "imageZoom") {
      updatePositionSliderBounds();
      updateCutSizeSliderBounds();
    }
  }

  function handleSave() {
    p.saveCanvas("output", "png");
    console.log("Canvas saved");
  }
}

// Auto-instantiate the sketch when p5 is available
if (typeof window !== "undefined" && window.p5) {
  new window.p5(sketch);
}
