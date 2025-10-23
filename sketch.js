import gui from "./gui.js";
import { getDefaultParameters } from "./modules/config.js";
import { drawImageCover, drawImageContain, calculatePositionBounds, calculateMinZoom } from "./modules/image-processor.js";

// p5.js Sketch - Instance Mode

let params = getDefaultParameters();

export default function sketch(p) {
  let loadedImage = null;
  let canvasElement = null;

  p.setup = function () {
    const canvas = p.createCanvas(params.canvasWidth, params.canvasHeight);
    canvas.parent("canvas-container");
    canvasElement = canvas.elt;
    p.background(0);

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
      // Draw image to fill canvas, centered and cropped to maintain aspect ratio
      // Use position and zoom parameters
      drawImageCover(p, loadedImage, p.width, p.height, params.imagePosX, params.imagePosY, params.imageZoom);
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

    const minZoom = calculateMinZoom(loadedImage.width, loadedImage.height, params.canvasWidth, params.canvasHeight);

    // Update zoom slider with calculated minimum, keep max at 3.0
    gui.updateSliderBounds("imageZoom", minZoom, 3.0);

    // Reset zoom to 1.0 (full cover)
    gui.updateParameterValue("imageZoom", 1.0);

    console.log(`Zoom bounds updated: min=${minZoom.toFixed(3)}, max=3.0`);
  }

  // Update the min/max values of position sliders based on image, canvas dimensions, and zoom
  function updatePositionSliderBounds() {
    if (!loadedImage) return;

    const bounds = calculatePositionBounds(loadedImage.width, loadedImage.height, params.canvasWidth, params.canvasHeight, params.imageZoom);

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
