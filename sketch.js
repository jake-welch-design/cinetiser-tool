import gui from "./gui.js";
import { getDefaultParameters, GUI_CONFIG } from "./modules/config.js";
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

  // Multiple cuts support - now using cut slots (0-5) instead of arbitrary array
  let cutSlots = [null, null, null, null, null, null]; // 6 slots, each can hold one cut or null
  let selectedCutSlot = 0; // Currently selected slot (0-5), defaults to slot 0 (Cut 1)

  // For backwards compatibility during transition
  let cuts = []; // Will maintain this as a view of active cutSlots
  let activeCutIndex = null; // Index of currently selected cut (null means no cut selected)

  // Rotation transition state
  let rotationTransitionStart = null; // timestamp when rotation starts
  let rotationTransitionDuration = 1000; // milliseconds (1 second) - updated based on rotationSpeed

  // UI state
  let showGuideCircle = true; // Toggle for red guide circle with 'h' key

  // Pattern image caching for performance
  let patternImg = null;
  let lastPatternPosX = null;
  let lastPatternPosY = null;
  let lastPatternZoom = null;

  // Display layer caching - track if we need to redraw
  let lastCutSize = null;
  let lastSliceAmount = null;
  let lastRotationAmount = null;
  let lastRotationMethod = null;
  let lastDisplayPosX = null;
  let lastDisplayPosY = null;
  let lastDisplayZoom = null;

  // Cut caching for inactive cuts - store rendered graphics for each cut slot
  let cutCaches = [null, null, null, null, null, null]; // Cached PGraphics for each cut slot
  let cutCacheParams = [null, null, null, null, null, null]; // Parameters used to generate each cache
  let previousActiveCutSlot = null; // Track which cut was active last frame

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
      resetImage: handleReset,
      removeActiveCut: removeActiveCut,
      getCutsInfo: getCutsInfo,
      hasActiveCut: hasActiveCut,
      getCutIndices: getCutIndices,
      selectCutSlot: selectCutSlot,
    });

    // Listen for window resize to keep canvas fitted
    window.addEventListener("resize", scaleCanvasToFit);

    console.log("p5.js (instance mode) sketch ready");
  };

  p.draw = function () {
    // Check for 'h' key to toggle guide circle visibility
    if ((p.key === "h" || p.key === "H") && p.keyIsPressed) {
      showGuideCircle = !showGuideCircle;
      p.key = ""; // Clear key to prevent repeated toggles
    }

    p.background(0);

    if (loadedImage) {
      // Check if we need to do heavy rendering
      // If animation is off and slices are placed, we only need to render on first frame
      const isAnimatedMode =
        params.animated !== undefined ? params.animated : true;
      const hasSlices = cuts.length > 0;

      // Check if ring parameters have changed
      const ringParametersChanged =
        lastCutSize !== params.cutSize ||
        lastSliceAmount !== params.sliceAmount ||
        lastRotationAmount !== params.rotationAmount ||
        lastRotationMethod !== params.rotationMethod;

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

          // Use the selected cut slot's parameters for preview
          const previewCutParams = gui.getParametersForSlot(selectedCutSlot);
          let previewCutSize = Math.max(1, previewCutParams.cutSize || 300);
          const maxAllowedDiameter = Math.min(
            zoomedImageWidth,
            zoomedImageHeight
          );
          if (previewCutSize > maxAllowedDiameter) {
            previewCutSize = maxAllowedDiameter;
          }

          // Reduce preview size by one ring thickness to show the innermost drawable ring
          const previewSliceAmount = Math.max(
            1,
            Math.floor(previewCutParams.sliceAmount || 10)
          );
          const ringThickness = previewCutSize / previewSliceAmount;
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

          if (showGuideCircle) {
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
      // For previews and placement, use the currently selected cut slot's parameters
      const selectedCutParams = gui.getParametersForSlot(selectedCutSlot);
      let cutSize = Math.max(1, selectedCutParams.cutSize || 300);
      const sliceAmount = Math.max(
        1,
        Math.floor(selectedCutParams.sliceAmount || 10)
      );

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

      // Only render slices if user has clicked to place them
      // Only render slices if user has placed cuts
      if (cuts.length > 0) {
        // Calculate common parameters needed for all cuts
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

        // Determine rotation parameters from params
        const rotationAmount =
          params.rotationAmount !== undefined ? params.rotationAmount : rotAmt;
        const rotationSpeed = params.rotationSpeed || speed;
        const isAnimated =
          params.animated !== undefined ? params.animated : true;

        const frameRate = 60;
        const cycleDuration =
          ((Math.PI * 2) / Math.max(rotationSpeed, 0.0001) / frameRate) * 1000;
        rotationTransitionDuration = Math.max(500, cycleDuration * 0.05);

        // Calculate rotation lerp progress
        let rotationProgress = 1.0;
        if (rotationTransitionStart !== null) {
          const elapsed = p.millis() - rotationTransitionStart;
          rotationProgress = Math.min(
            elapsed / rotationTransitionDuration,
            1.0
          );
          if (rotationProgress >= 1.0) {
            rotationTransitionStart = null;
          }
        }

        // Detect when active cut changes to invalidate cache for new active cut
        if (selectedCutSlot !== previousActiveCutSlot) {
          // Invalidate the cache for the newly selected cut since it needs lerp animation
          cutCaches[selectedCutSlot] = null;
          previousActiveCutSlot = selectedCutSlot;
        }

        // Render all cuts
        for (let cutIdx = 0; cutIdx < cuts.length; cutIdx++) {
          const cut = cuts[cutIdx];
          const isActiveCut = cut.slotIndex === selectedCutSlot;
          const slotIndex = cut.slotIndex;

          // Get the parameters for this specific cut's SLOT (not the array index!)
          const cutParams = gui.getParametersForSlot(slotIndex);

          // Calculate this cut's size parameters
          let cutSize = Math.max(1, cutParams.cutSize || 300);
          const cutSliceAmount = Math.max(
            1,
            Math.floor(cutParams.sliceAmount || 10)
          );

          // Clamp to image bounds
          if (loadedImage) {
            const maxAllowedDiameter = Math.min(
              zoomedImageWidth,
              zoomedImageHeight
            );
            if (cutSize > maxAllowedDiameter) {
              cutSize = maxAllowedDiameter;
            }
          }

          const maxDiameter = cutSize;
          const maxRadius = maxDiameter / 2;

          // Convert cut from image-space to canvas-space for rendering
          const canvasSpaceX = imageCenterX + cut.centerX * cutParams.imageZoom;
          const canvasSpaceY = imageCenterY + cut.centerY * cutParams.imageZoom;

          // Clamp cut center to stay within image bounds
          const clampedCenterX = Math.max(
            imageLeft + maxRadius,
            Math.min(imageRight - maxRadius, canvasSpaceX)
          );
          const clampedCenterY = Math.max(
            imageTop + maxRadius,
            Math.min(imageBottom - maxRadius, canvasSpaceY)
          );

          if (isActiveCut) {
            // For active cut: always render with lerp animation
            renderCutSlices(
              clampedCenterX,
              clampedCenterY,
              maxDiameter,
              cutSliceAmount,
              cutSize,
              cutParams.rotationAmount,
              cutParams.rotationSpeed,
              cutParams.animated,
              rotationProgress,
              true,
              cutParams
            );
          } else {
            // For inactive cuts: use cache, only re-render if parameters changed
            const cacheKey = {
              centerX: clampedCenterX,
              centerY: clampedCenterY,
              maxDiameter,
              cutSliceAmount,
              cutSize,
              rotationAmount: cutParams.rotationAmount,
              rotationSpeed: cutParams.rotationSpeed,
              animated: cutParams.animated,
              rotationMethod: cutParams.rotationMethod,
            };

            const needsCacheUpdate =
              !cutCaches[slotIndex] ||
              !cutCacheParams[slotIndex] ||
              JSON.stringify(cutCacheParams[slotIndex]) !==
                JSON.stringify(cacheKey);

            if (needsCacheUpdate) {
              // Render inactive cut at full rotation (no animation, rotation=1.0)
              renderCutSlicesToBuffer(
                cutCaches,
                slotIndex,
                clampedCenterX,
                clampedCenterY,
                maxDiameter,
                cutSliceAmount,
                cutSize,
                cutParams.rotationAmount,
                cutParams.rotationSpeed,
                cutParams.animated,
                1.0, // Full rotation, no lerp
                cutParams
              );
              cutCacheParams[slotIndex] = cacheKey;
            }

            // Draw cached cut to display layer
            if (cutCaches[slotIndex]) {
              display.image(cutCaches[slotIndex], 0, 0);
            }
          }
        }
      } // Close the "if cuts.length > 0" conditional

      // Cache the ring parameters for next frame comparison
      // (Using global params as reference for change detection)
      lastCutSize = params.cutSize;
      lastSliceAmount = params.sliceAmount;
      lastRotationAmount = params.rotationAmount;
      lastRotationMethod = params.rotationMethod;

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
        // Use the selected cut slot's parameters for preview
        const previewCutParams2 = gui.getParametersForSlot(selectedCutSlot);
        let previewCutSize = Math.max(1, previewCutParams2.cutSize || 300);
        const maxAllowedDiameter = Math.min(
          zoomedImageWidth,
          zoomedImageHeight
        );
        if (previewCutSize > maxAllowedDiameter) {
          previewCutSize = maxAllowedDiameter;
        }

        // Reduce preview size by one ring thickness to show the innermost drawable ring
        const sliceAmount = Math.max(
          1,
          Math.floor(previewCutParams2.sliceAmount || 10)
        );
        const ringThickness = previewCutSize / sliceAmount;
        const adjustedPreviewSize = previewCutSize - ringThickness;

        const maxRadius = adjustedPreviewSize / 2;

        // Clamp cursor position to stay within image bounds for preview
        const clampedCursorX = Math.max(
          imageLeft + maxRadius,
          Math.min(imageRight - maxRadius, cursorX)
        );
        const clampedCursorY = Math.max(
          imageTop + maxRadius,
          Math.min(imageBottom - maxRadius, cursorY)
        );

        if (showGuideCircle) {
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
      // Only show preview if mouse is within canvas bounds
      if (
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height
      ) {
        cursorX = p.mouseX;
        cursorY = p.mouseY;
        showCursorPreview = true;
      } else {
        showCursorPreview = false;
      }
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
      // Use the selected cut slot's parameters
      const selectedCutParamsForClick =
        gui.getParametersForSlot(selectedCutSlot);
      const cutSizeRadius = selectedCutParamsForClick.cutSize / 2;

      const clampedClickX = Math.max(
        imageLeft + cutSizeRadius,
        Math.min(imageRight - cutSizeRadius, p.mouseX)
      );
      const clampedClickY = Math.max(
        imageTop + cutSizeRadius,
        Math.min(imageBottom - cutSizeRadius, p.mouseY)
      );

      // Convert canvas coordinates to image-space coordinates
      // This way cuts stay with the image when position/zoom changes
      const imageSpaceX = (clampedClickX - imageCenterX) / params.imageZoom;
      const imageSpaceY = (clampedClickY - imageCenterY) / params.imageZoom;

      // Place or move cut in the currently selected slot
      placeCutInSlot(selectedCutSlot, imageSpaceX, imageSpaceY);
      console.log(`Cut placed in slot ${selectedCutSlot}`);

      // Start rotation transition when a cut is active
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

  // ==================== Multiple Cuts Management ====================

  /**
   * Render a single cut's slices to the display layer
   * @param {number} centerX - X coordinate of cut center in canvas space
   * @param {number} centerY - Y coordinate of cut center in canvas space
   * @param {number} maxDiameter - Size of the largest ring
   * @param {number} sliceAmount - Number of slices
   * @param {number} cutSize - Size parameter
   * @param {number} rotationAmount - Amount to rotate
   * @param {number} rotationSpeed - Speed of animation
   * @param {boolean} isAnimated - Whether animation is on
   * @param {number} rotationProgress - Progress of lerp animation (0-1)
   * @param {number} posX - Image pan X
   * @param {number} posY - Image pan Y
   */
  function renderCutSlicesToBuffer(
    cutCachesArray,
    slotIndex,
    centerX,
    centerY,
    maxDiameter,
    sliceAmount,
    cutSize,
    rotationAmount,
    rotationSpeed,
    isAnimated,
    rotationProgress,
    cutParams = params
  ) {
    // Create or reuse a graphics buffer for this cut slot
    if (!cutCachesArray[slotIndex]) {
      cutCachesArray[slotIndex] = p.createGraphics(p.width, p.height);
    }

    const cachedLayer = cutCachesArray[slotIndex];
    cachedLayer.clear();

    const ringThickness = cutSize / sliceAmount;

    // Only render slices if rotation amount is not 0
    if (rotationAmount === 0) return;

    for (let i = 0; i < sliceAmount; i++) {
      const currentSize = maxDiameter - i * ringThickness;

      // Use full rotation progress (no lerp) for cached cuts
      const lerpedRotationAmount = rotationAmount * rotationProgress;
      const rotationMethod = cutParams.rotationMethod || "incremental";

      let currentRotation;
      if (isAnimated) {
        const animatedValue = p.map(
          p.sin(p.frameCount * rotationSpeed),
          -1,
          1,
          -lerpedRotationAmount,
          lerpedRotationAmount
        );

        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount =
            lerpedRotationAmount *
            Math.sin(p.frameCount * rotationSpeed + phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(animatedValue * i);
        }
      } else {
        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount = lerpedRotationAmount * Math.sin(phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(lerpedRotationAmount * i);
        }
      }

      const sw = Math.max(1, Math.ceil(currentSize));
      const sh = Math.max(1, Math.ceil(currentSize));

      // Use a 2x resolution buffer for better quality
      const bufferScale = 2;
      const bufferW = Math.ceil(sw * bufferScale);
      const bufferH = Math.ceil(sh * bufferScale);

      // centerX and centerY are already in canvas space
      // Calculate local coordinates within the image layer
      const localCenterX = centerX - (p.width / 2 - imgLayer.width / 2);
      const localCenterY = centerY - (p.height / 2 - imgLayer.height / 2);

      // Clamp source coordinates to stay within patternImg bounds
      const sx = Math.max(
        0,
        Math.min(patternImg.width - sw, localCenterX - sw / 2)
      );
      const sy = Math.max(
        0,
        Math.min(patternImg.height - sh, localCenterY - sh / 2)
      );

      if (!buffer || buffer.width !== bufferW || buffer.height !== bufferH) {
        if (buffer) buffer.remove();
        buffer = p.createGraphics(bufferW, bufferH);
      }

      buffer.clear();
      buffer.push();
      buffer.drawingContext.save();
      buffer.drawingContext.beginPath();
      buffer.drawingContext.ellipse(
        bufferW / 2,
        bufferH / 2,
        bufferW / 2,
        bufferH / 2,
        0,
        0,
        Math.PI * 2
      );
      buffer.drawingContext.clip();
      buffer.image(patternImg, 0, 0, bufferW, bufferH, sx, sy, sw, sh);
      buffer.drawingContext.restore();
      buffer.pop();

      cachedLayer.push();
      cachedLayer.imageMode(cachedLayer.CENTER);
      cachedLayer.translate(centerX, centerY);
      cachedLayer.rotate(currentRotation);
      cachedLayer.image(buffer, 0, 0, sw, sh);
      cachedLayer.pop();
    }
  }

  function renderCutSlices(
    centerX,
    centerY,
    maxDiameter,
    sliceAmount,
    cutSize,
    rotationAmount,
    rotationSpeed,
    isAnimated,
    rotationProgress,
    isActiveCut,
    cutParams = params
  ) {
    const ringThickness = cutSize / sliceAmount;

    // Only render slices if rotation amount is not 0
    if (rotationAmount === 0) return;

    for (let i = 0; i < sliceAmount; i++) {
      const currentSize = maxDiameter - i * ringThickness;

      // Lerp rotation amount based on transition progress
      const lerpedRotationAmount = rotationAmount * rotationProgress;
      const rotationMethod = cutParams.rotationMethod || "incremental";

      let currentRotation;
      if (isAnimated) {
        const animatedValue = p.map(
          p.sin(p.frameCount * rotationSpeed),
          -1,
          1,
          -lerpedRotationAmount,
          lerpedRotationAmount
        );

        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount =
            lerpedRotationAmount *
            Math.sin(p.frameCount * rotationSpeed + phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(animatedValue * i);
        }
      } else {
        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount = lerpedRotationAmount * Math.sin(phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(lerpedRotationAmount * i);
        }
      }

      const sw = Math.max(1, Math.ceil(currentSize));
      const sh = Math.max(1, Math.ceil(currentSize));

      // Use a 2x resolution buffer for better quality
      const bufferScale = 2;
      const bufferW = Math.ceil(sw * bufferScale);
      const bufferH = Math.ceil(sh * bufferScale);

      // centerX and centerY are already in canvas space
      // Calculate local coordinates within the image layer
      const localCenterX = centerX - (p.width / 2 - imgLayer.width / 2);
      const localCenterY = centerY - (p.height / 2 - imgLayer.height / 2);

      // Clamp source coordinates to stay within patternImg bounds
      const sx = Math.max(
        0,
        Math.min(patternImg.width - sw, localCenterX - sw / 2)
      );
      const sy = Math.max(
        0,
        Math.min(patternImg.height - sh, localCenterY - sh / 2)
      );

      if (!buffer || buffer.width !== bufferW || buffer.height !== bufferH) {
        if (buffer) buffer.remove();
        buffer = p.createGraphics(bufferW, bufferH);
      }

      buffer.clear();
      buffer.push();
      buffer.drawingContext.save();
      buffer.drawingContext.beginPath();
      buffer.drawingContext.ellipse(
        bufferW / 2,
        bufferH / 2,
        bufferW / 2,
        bufferH / 2,
        0,
        0,
        Math.PI * 2
      );
      buffer.drawingContext.clip();
      buffer.image(patternImg, 0, 0, bufferW, bufferH, sx, sy, sw, sh);
      buffer.drawingContext.restore();
      buffer.pop();

      display.push();
      display.imageMode(display.CENTER);
      display.translate(centerX, centerY);
      display.rotate(currentRotation);
      display.image(buffer, 0, 0, sw, sh);
      display.pop();
    }
  }

  /**
   * Add a new cut at the specified position
   * @param {number} centerX - X coordinate of cut center
   * @param {number} centerY - Y coordinate of cut center
   * @returns {number} - Index of the newly added cut
   */
  /**
   * Place or move a cut in a specific slot
   * @param {number} slotIndex - Slot index (0-5)
   * @param {number} centerX - X coordinate in image space
   * @param {number} centerY - Y coordinate in image space
   */
  function placeCutInSlot(slotIndex, centerX, centerY) {
    if (slotIndex < 0 || slotIndex >= 6) return;

    // Place the cut in the slot - only store location
    // Parameters are managed by GUI's cutParametersMap
    cutSlots[slotIndex] = {
      centerX: centerX,
      centerY: centerY,
    };

    selectedCutSlot = slotIndex;
    updateCutsArray(); // Update the cuts array for rendering
    console.log(`Placed cut in slot ${slotIndex}`);
  }

  /**
   * Update the cuts array from cutSlots (for backwards compatibility)
   */
  function updateCutsArray() {
    cuts = [];
    cutSlots.forEach((cut, slotIndex) => {
      if (cut !== null) {
        cuts.push({
          ...cut,
          slotIndex: slotIndex,
        });
      }
    });
  }

  /**
   * Select a cut slot
   * @param {number} slotIndex - Slot index to select (0-5)
   */
  function selectCutSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      // Only trigger transition if switching to a different cut
      if (slotIndex !== selectedCutSlot) {
        // Start rotation transition animation when switching cuts
        rotationTransitionStart = p.millis();

        // Invalidate cache for the new active cut so it renders with lerp animation
        cutCaches[slotIndex] = null;
        cutCacheParams[slotIndex] = null;
      }

      selectedCutSlot = slotIndex;

      // Clear caches when switching cuts to force re-render with new cut's parameters
      lastCutSize = null;
      lastSliceAmount = null;
      lastRotationAmount = null;
      lastRotationMethod = null;
      lastDisplayPosX = null;
      lastDisplayPosY = null;
      lastDisplayZoom = null;
      lastPatternPosX = null;
      lastPatternPosY = null;
      lastPatternZoom = null;
      patternImg = null;

      // Parameters are managed by GUI - they'll send us the right ones via onParameterChange
      console.log(`Selected cut slot ${slotIndex}`);
    }
  }
  /**
   * Clear a specific cut slot
   * @param {number} slotIndex - Slot index to clear
   */
  function clearCutSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      cutSlots[slotIndex] = null;
      updateCutsArray();
    }
  }

  /**
   * Clear all cuts
   */
  function clearAllCuts() {
    cutSlots = [null, null, null, null, null, null];
    cuts = [];
    selectedCutSlot = 0;
  }

  /**
   * Add a new cut at the specified position
   * @param {number} centerX - X coordinate of cut center
   * @param {number} centerY - Y coordinate of cut center
   * @returns {number} - Index of the newly added cut
   */
  function addCut(centerX, centerY) {
    // Cap at 6 cuts maximum
    if (cuts.length >= 6) {
      console.warn("Maximum of 6 cuts reached");
      return null;
    }
    const newCut = {
      id: nextCutId++,
      centerX: centerX,
      centerY: centerY,
    };
    cuts.push(newCut);
    activeCutIndex = cuts.length - 1; // Select the newly added cut
    console.log(`Cut added at (${centerX}, ${centerY}), ID: ${newCut.id}`);
    return activeCutIndex;
  }

  /**
   * Remove the active cut
   */
  function removeActiveCut() {
    if (activeCutIndex === null || cuts.length === 0) {
      console.warn("No active cut to remove");
      return;
    }
    const removedCut = cuts[activeCutIndex];
    cuts.splice(activeCutIndex, 1);

    // Update active cut index
    if (cuts.length === 0) {
      activeCutIndex = null;
    } else if (activeCutIndex >= cuts.length) {
      activeCutIndex = cuts.length - 1;
    }
    console.log(`Cut removed, ID: ${removedCut.id}`);
  }

  /**
   * Select a cut by index
   */
  function selectCut(index) {
    if (index >= 0 && index < cuts.length) {
      activeCutIndex = index;
    }
  }

  /**
   * Check if a position is close to an existing cut (for click detection)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} tolerance - Distance tolerance in pixels
   * @returns {number} - Index of nearby cut, or -1 if none found
   */
  function findNearestCut(x, y, tolerance = 20) {
    for (let i = 0; i < cuts.length; i++) {
      const dx = cuts[i].centerX - x;
      const dy = cuts[i].centerY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= tolerance) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Clear all cuts
   */
  function clearAllCuts() {
    cuts = [];
    activeCutIndex = null;
    console.log("All cuts cleared");
  }

  /**
   * Get information about current cuts state
   * @returns {string} - Human-readable cuts info
   */
  function getCutsInfo() {
    if (cuts.length === 0) {
      return "No cuts yet. Click on the image to add one.";
    } else if (activeCutIndex === null) {
      return `${cuts.length} cut${
        cuts.length !== 1 ? "s" : ""
      } placed. Click to select.`;
    } else {
      return `${cuts.length} cut${cuts.length !== 1 ? "s" : ""} placed. Cut ${
        activeCutIndex + 1
      } selected.`;
    }
  }

  /**
   * Get the indices of cuts that have been placed (for GUI button highlighting)
   * @returns {array} - Array of cut indices that have cuts placed
   */
  /**
   * Get the indices of cuts that have been placed (for GUI button highlighting)
   * @returns {array} - Array of cut slot indices (0-5) that have cuts placed
   */
  function getCutIndices() {
    const usedIndices = [];
    cutSlots.forEach((cut, slotIndex) => {
      if (cut !== null) {
        usedIndices.push(slotIndex);
      }
    });
    return usedIndices;
  }

  /**
   * Check if there is an active cut
   * @returns {boolean}
   */
  function hasActiveCut() {
    return activeCutIndex !== null && cuts.length > 0;
  }

  // ==================== Event Handlers ====================

  // Called when image is uploaded via GUI
  function handleImageLoaded(imageDataUrl) {
    // Use instance's loadImage so the image becomes a p5.Image bound to this instance
    p.loadImage(imageDataUrl, (img) => {
      loadedImage = img;
      console.log("Image loaded:", img.width, "x", img.height);

      // Clear all caches when a new image loads
      patternImg = null;
      lastPatternPosX = null;
      lastPatternPosY = null;
      lastPatternZoom = null;

      // Clear cut caches
      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
      previousActiveCutSlot = null;

      // Clear display layer cache
      display.clear();
      lastCutSize = null;
      lastSliceAmount = null;
      lastRotationAmount = null;
      lastRotationMethod = null;
      lastDisplayPosX = null;
      lastDisplayPosY = null;
      lastDisplayZoom = null;

      // Clear all cuts with new image
      cutSlots = [null, null, null, null, null, null];
      cuts = [];
      selectedCutSlot = 0;
      activeCutIndex = null;
      rotationTransitionStart = null;

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
    params = allParameters; // Resize canvas if dimensions changed
    if (paramName === "canvasWidth" || paramName === "canvasHeight") {
      p.resizeCanvas(params.canvasWidth, params.canvasHeight);
      scaleCanvasToFit(); // Re-scale after resize

      // Recreate graphics layers at new resolution
      buffer = p.createGraphics(params.canvasWidth, params.canvasHeight);
      imgLayer = p.createGraphics(params.canvasWidth, params.canvasHeight);
      display = p.createGraphics(params.canvasWidth, params.canvasHeight);

      // Clear all cuts since coordinates are now invalid in new canvas
      cuts = [];
      activeCutIndex = null;
      nextCutId = 0;
      rotationTransitionStart = null;

      // Clear cut caches when canvas size changes
      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
      previousActiveCutSlot = null;

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
      // Invalidate cut caches when zoom changes (affects positions)
      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
    }

    // Invalidate caches when parameters that affect cut rendering change
    if (
      paramName === "cutSize" ||
      paramName === "sliceAmount" ||
      paramName === "rotationAmount" ||
      paramName === "rotationSpeed" ||
      paramName === "rotationMethod" ||
      paramName === "animated"
    ) {
      // Invalidate all cut caches since rendering parameters changed
      for (let i = 0; i < 6; i++) {
        if (i !== selectedCutSlot) {
          // Don't invalidate active cut cache, it needs the lerp animation
          cutCaches[i] = null;
          cutCacheParams[i] = null;
        }
      }
    }

    // Restart lerp when rotation method changes
    if (paramName === "rotationMethod") {
      rotationTransitionStart = p.millis();
    }
  }

  function handleSave() {
    // Temporarily hide the guide circle during export
    const guideCircleWasVisible = showGuideCircle;
    showGuideCircle = false;

    // Wait a frame to ensure the guide circle is not drawn
    p.draw();

    // Save the canvas
    p.saveCanvas("output", "png");
    console.log("Canvas saved");

    // Restore the guide circle visibility
    showGuideCircle = guideCircleWasVisible;
  }

  function handleReset() {
    // Clear all cuts
    clearAllCuts();

    // Reset image transform directly in params object
    params.imagePosX = 0;
    params.imagePosY = 0;
    params.imageZoom = 1;

    // Invalidate all caches to force redraw
    lastCutSize = null;
    lastSliceAmount = null;
    lastRotationAmount = null;
    lastRotationMethod = null;
    lastDisplayPosX = null;
    lastDisplayPosY = null;
    lastDisplayZoom = null;
    lastPatternPosX = null;
    lastPatternPosY = null;
    lastPatternZoom = null;
    patternImg = null;

    // Clear graphics buffers to ensure clean state
    if (display) display.clear();
    if (buffer) buffer.clear();
    if (imgLayer) imgLayer.clear();

    // Reset rotation animation state
    rotationTransitionStart = null;

    // Update GUI controls to reflect new state
    if (gui && gui.updateParameterValue) {
      // Use setTimeout to defer GUI updates to next frame
      setTimeout(() => {
        gui.updateParameterValue("imagePosX", 0);
        gui.updateParameterValue("imagePosY", 0);
        gui.updateParameterValue("imageZoom", 1);
      }, 0);
    }

    console.log("Image reset to initial state - all cuts cleared");
  }

  // mouseWheel handler for adjusting cut size
  p.mouseWheel = function (event) {
    // Only adjust if mouse is over the canvas
    if (
      p.mouseX < 0 ||
      p.mouseX > p.width ||
      p.mouseY < 0 ||
      p.mouseY > p.height
    ) {
      return; // Don't prevent default scroll if not over canvas
    }

    // Adjust cut size with scroll wheel
    // Positive delta = scroll down = decrease size
    // Negative delta = scroll up = increase size
    const scrollSensitivity = 10; // pixels per scroll notch
    const delta = event.deltaY > 0 ? scrollSensitivity : -scrollSensitivity;

    // Get current cut size from GUI
    const currentCutSize = gui.parameters.cutSize || 300;
    const config = GUI_CONFIG.cutSize || {};

    // Calculate new cut size with bounds
    let newCutSize = currentCutSize - delta;
    newCutSize = Math.max(
      config.min || 100,
      Math.min(config.max || 1920, newCutSize)
    );

    // Update GUI and sketch
    gui.updateParameterValue("cutSize", newCutSize);

    // Prevent default scroll behavior
    return false;
  };

  /**
   * DEBUG: Get current state of the cut system for diagnostics
   * @returns {object} - Comprehensive state information
   */
  function getDebugInfo() {
    return {
      selectedCutSlot,
      cutSlots: cutSlots.map((cut, idx) => ({
        slotIndex: idx,
        hasCut: cut !== null,
        cut: cut,
      })),
      currentParameters: { ...params },
      activeCuts: cuts.length,
    };
  }

  /**
   * DEBUG: Log per-cut parameter state for verification
   */
  function logCutParameterState() {
    console.log("=== CUT PARAMETER STATE ===");
    console.log("Selected Slot:", selectedCutSlot);
    cutSlots.forEach((cut, idx) => {
      if (cut !== null) {
        console.log(`Slot ${idx}:`, {
          center: { x: cut.centerX, y: cut.centerY },
          // Note: Parameters are stored in GUI's cutParametersMap
        });
      } else {
        console.log(`Slot ${idx}: [empty]`);
      }
    });
    console.log("Current Global Params:", params);
    console.log("===========================");
  }

  // Expose debug functions globally for testing
  window.cinetiserDebug = {
    getDebugInfo,
    logCutParameterState,
    getCutSlots: () => cutSlots,
    getSelectedSlot: () => selectedCutSlot,
    getParams: () => params,
    getCutParametersMap: () =>
      window.gui ? window.gui.cutParametersMap : null,
    getCurrentCutIndex: () => (window.gui ? window.gui.currentCutIndex : null),
  };
}

// Auto-instantiate the sketch when p5 is available
if (typeof window !== "undefined" && window.p5) {
  new window.p5(sketch);
}
