import gui from "./gui.js";
import { getDefaultParameters } from "./modules/config.js";
import {
  drawImageCover,
  drawImageContain,
  calculatePositionBounds,
  calculateMinZoom,
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
      const patternImg = imgLayer.get();

      // Prepare display layer
      display.clear();

      // Animation angle (oscillates)
      const angle = p.map(p.sin(p.frameCount * speed), -1, 1, -rotAmt, rotAmt);

      // Use GUI parameters for slice size and amount
      let sliceSize = Math.max(1, params.sliceSize || 50);
      const requestedAmount = Math.max(1, Math.floor(params.sliceAmount || 5));

      // Determine the canvas limit and if requestedAmount * sliceSize exceeds it, clamp sliceSize
      const canvasMinDim = Math.min(p.width, p.height);
      let effectiveAmount = requestedAmount;
      let maxDiameter = sliceSize * effectiveAmount;
      if (maxDiameter > canvasMinDim) {
        // Prefer keeping the requested number of slices; scale down sliceSize so total fits
        sliceSize = canvasMinDim / requestedAmount;
        // ensure sliceSize is at least 1 pixel
        sliceSize = Math.max(1, sliceSize);
        maxDiameter = sliceSize * requestedAmount;
      }

      // Determine rotation amount and speed from params
      const rotationAmount = params.rotationAmount || rotAmt;
      const rotationSpeed = params.rotationSpeed || speed;
      const isAnimated = params.animated !== undefined ? params.animated : true;

      // Build circular, rotating layers into `display` sampling from patternImg
      // ring center should be based on the clamped image position so slices anchor to visible image
      const centerX = p.width / 2 + posX;
      const centerY = p.height / 2 + posY;

      for (let i = 0; i < requestedAmount; i++) {
        const currentSize = maxDiameter - i * sliceSize;
        const currentRotation = p.radians(
          (isAnimated
            ? p.map(
                p.sin(p.frameCount * rotationSpeed),
                -1,
                1,
                -rotationAmount,
                rotationAmount
              )
            : rotationAmount) * i
        );

        const sw = Math.max(1, Math.floor(currentSize));
        const sh = Math.max(1, Math.floor(currentSize));

        // sample top-left coordinates on the pattern image
        const sx = Math.max(0, Math.floor(centerX - sw / 2));
        const sy = Math.max(0, Math.floor(centerY - sh / 2));

        // create temp graphics the size of the ring and copy clipped circle
        const temp = p.createGraphics(sw, sh);
        temp.clear();
        temp.push();
        temp.drawingContext.save();
        temp.drawingContext.beginPath();
        temp.drawingContext.ellipse(
          sw / 2,
          sh / 2,
          sw / 2,
          sh / 2,
          0,
          0,
          Math.PI * 2
        );
        temp.drawingContext.clip();
        temp.image(patternImg, 0, 0, sw, sh, sx, sy, sw, sh);
        temp.drawingContext.restore();
        temp.pop();

        // composite into display, centered at image center
        display.push();
        display.imageMode(display.CENTER);
        display.translate(centerX, centerY);
        display.rotate(currentRotation);
        display.image(temp, 0, 0);
        display.pop();
      }

      // Draw the composed display layer onto the main canvas on top of base image
      p.imageMode(p.CORNER);
      p.image(display, 0, 0, p.width, p.height);
    } else {
      // Placeholder text
      p.fill(255);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text("Upload an image to begin", p.width / 2, p.height / 2);
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

      // Update zoom and position slider bounds when canvas size changes
      updateZoomSliderBounds();
      updatePositionSliderBounds();
    }

    // Update position slider bounds when zoom changes
    if (paramName === "imageZoom") {
      updatePositionSliderBounds();
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
