import { Utils } from "./modules/utils.js";
import { ImageProcessor } from "./modules/image-processor.js";
import { SceneManager } from "./modules/scene-manager.js";
import { PointCloudGenerator } from "./modules/point-cloud-generator.js";
import { ResourceManager } from "./modules/resource-manager.js";
import { DepthDetector } from "./modules/depth-detector.js";
import { getDefaultParameters } from "./modules/config.js";

class DepthMapExploration {
  constructor() {
    // Get default parameters from config.js
    const defaults = getDefaultParameters();
    this.config = {
      layerWidth: defaults.compWidth,
      layerHeight: defaults.compHeight,
      pointSize: defaults.pointSize,
      zPosition: 600, // Default distance value (removed from GUI config)
      zOffsetMin: 0,
      zOffsetMax: defaults.maxDepth,
      bg: 0x000000,
    };

    // Zoom settings for scroll wheel
    this.zoomSensitivity = 30;
    this.minZoom = 100;
    this.maxZoom = 5000;

    // Initialize modules
    this.sceneManager = new SceneManager();
    this.imageProcessor = new ImageProcessor();
    this.pointCloudGenerator = new PointCloudGenerator();
    this.resourceManager = new ResourceManager();
    this.depthDetector = new DepthDetector();

    // Camera panning state
    this.cameraPosition = { x: 0, y: 0, z: this.config.zPosition };
    this.isPanning = false;
    this.lastMousePosition = { x: 0, y: 0 };
    this.panSensitivity = 1.0;

    // Pinch-to-zoom state for mobile
    this.isPinching = false;
    this.lastPinchDistance = 0;
    this.pinchSensitivity = 2.0;

    // Register modules for cleanup
    this.resourceManager.registerResource(this.sceneManager, "cleanup");
    this.resourceManager.registerResource(this.imageProcessor, "cleanup");
    this.resourceManager.registerResource(this.pointCloudGenerator, "cleanup");
    this.resourceManager.registerResource(this.depthDetector, "cleanup");

    this.init();
  }

  async init() {
    // Clean up any existing resources
    this.cleanup();

    this.setupThreeJS();
    this.setupControls();
    this.sceneManager.startAnimation();

    // Reset DOM to initial state
    this.resourceManager.resetDOMState();
  }

  cleanup() {
    this.resourceManager.cleanup();
  }

  async updateComposition(depthMapURL, displayImageURL, parameters) {
    // Update configuration
    this.config = { ...this.config, ...parameters };
    this.config.tilesX = this.config.compWidth || this.config.layerWidth;
    this.config.tilesY = this.config.compHeight || this.config.layerHeight;
    this.config.layerWidth = this.config.compWidth || this.config.layerWidth;
    this.config.layerHeight = this.config.compHeight || this.config.layerHeight;

    // Update camera position
    this.sceneManager.setCameraPosition(0, 0, this.config.zPosition);

    try {
      // Load new images
      const depthMap = await Utils.loadImage(depthMapURL);
      const displayImg = await Utils.loadImage(displayImageURL);

      // Process images
      this.imageProcessor.processImages(
        depthMap,
        displayImg,
        this.config.layerWidth,
        this.config.layerHeight
      );

      // Remove existing point cloud
      const currentPointCloud = this.pointCloudGenerator.getCurrentPointCloud();
      if (currentPointCloud) {
        this.sceneManager.removeFromScene(currentPointCloud);
      }
      this.pointCloudGenerator.cleanup();

      // Create new point cloud
      const newPointCloud = this.pointCloudGenerator.generate(
        this.imageProcessor,
        {
          layerWidth: this.config.layerWidth,
          layerHeight: this.config.layerHeight,
          tilesX: this.config.tilesX,
          tilesY: this.config.tilesY,
          pointSize: this.config.pointSize,
          zOffsetMin: this.config.zOffsetMin,
          zOffsetMax: this.config.zOffsetMax || this.config.maxDepth,
          gridDensity: this.config.gridDensity || 1.0,
        }
      );

      if (newPointCloud) {
        this.sceneManager.addToScene(newPointCloud);
      }

      // Show controls after successful generation
      this.resourceManager.showControls();
    } catch (error) {
      console.error("Error updating composition:", error);
      throw error;
    }
  }

  /**
   * Process regular images with automatic depth detection
   * @param {File} sourceImageFile - The source image file for depth detection
   * @param {File} displayImageFile - The color/display image file
   * @param {Object} parameters - Processing parameters
   * @param {Function} onDepthGenerated - Callback when depth map is generated (for preview update)
   */
  async updateCompositionWithDepthDetection(
    sourceImageFile,
    displayImageFile,
    parameters,
    onDepthGenerated
  ) {
    // Update configuration
    this.config = { ...this.config, ...parameters };
    this.config.tilesX = this.config.compWidth || this.config.layerWidth;
    this.config.tilesY = this.config.compHeight || this.config.layerHeight;
    this.config.layerWidth = this.config.compWidth || this.config.layerWidth;
    this.config.layerHeight = this.config.compHeight || this.config.layerHeight;

    // Update camera position
    this.sceneManager.setCameraPosition(0, 0, this.config.zPosition);

    try {
      console.log("Starting depth detection process...");

      // Generate depth map from the source image
      const depthResult = await this.depthDetector.generateDepthMap(
        sourceImageFile
      );

      // Call the callback to update the preview if provided
      if (onDepthGenerated && typeof onDepthGenerated === "function") {
        onDepthGenerated(depthResult.depthDataUrl);
      }

      // Load the display image
      const displayImageURL = await this._fileToDataURL(displayImageFile);
      const displayImg = await Utils.loadImage(displayImageURL);

      console.log("Processing images with generated depth map...");

      // Process images (depth map is now generated, display image is loaded)
      this.imageProcessor.processImages(
        depthResult.depthImage,
        displayImg,
        this.config.layerWidth,
        this.config.layerHeight
      );

      // Remove existing point cloud
      const currentPointCloud = this.pointCloudGenerator.getCurrentPointCloud();
      if (currentPointCloud) {
        this.sceneManager.removeFromScene(currentPointCloud);
      }
      this.pointCloudGenerator.cleanup();

      // Create new point cloud
      const newPointCloud = this.pointCloudGenerator.generate(
        this.imageProcessor,
        {
          layerWidth: this.config.layerWidth,
          layerHeight: this.config.layerHeight,
          tilesX: this.config.tilesX,
          tilesY: this.config.tilesY,
          pointSize: this.config.pointSize,
          zOffsetMin: this.config.zOffsetMin,
          zOffsetMax: this.config.zOffsetMax || this.config.maxDepth,
          gridDensity: this.config.gridDensity || 1.0,
        }
      );

      if (newPointCloud) {
        this.sceneManager.addToScene(newPointCloud);
      }

      // Show controls after successful generation
      this.resourceManager.showControls();
    } catch (error) {
      console.error("Error updating composition with depth detection:", error);
      throw error;
    }
  }

  /**
   * Update composition using existing depth map (for parameter changes like width/height)
   * @param {HTMLImageElement} existingDepthMap - Already generated depth map
   * @param {HTMLImageElement} displayImg - The display image
   * @param {Object} parameters - Processing parameters
   */
  async updateCompositionWithExistingDepthMap(
    existingDepthMap,
    displayImg,
    parameters
  ) {
    // Update configuration
    this.config = { ...this.config, ...parameters };
    this.config.tilesX = this.config.compWidth || this.config.layerWidth;
    this.config.tilesY = this.config.compHeight || this.config.layerHeight;
    this.config.layerWidth = this.config.compWidth || this.config.layerWidth;
    this.config.layerHeight = this.config.compHeight || this.config.layerHeight;

    // Update camera position
    this.sceneManager.setCameraPosition(0, 0, this.config.zPosition);

    try {
      console.log(
        "Updating composition with existing depth map (no AI processing)..."
      );

      // Process images using existing depth map
      this.imageProcessor.processImages(
        existingDepthMap,
        displayImg,
        this.config.layerWidth,
        this.config.layerHeight
      );

      // Remove existing point cloud
      const currentPointCloud = this.pointCloudGenerator.getCurrentPointCloud();
      if (currentPointCloud) {
        this.sceneManager.removeFromScene(currentPointCloud);
      }
      this.pointCloudGenerator.cleanup();

      // Create new point cloud
      const newPointCloud = this.pointCloudGenerator.generate(
        this.imageProcessor,
        {
          layerWidth: this.config.layerWidth,
          layerHeight: this.config.layerHeight,
          tilesX: this.config.tilesX,
          tilesY: this.config.tilesY,
          pointSize: this.config.pointSize,
          zOffsetMin: this.config.zOffsetMin,
          zOffsetMax: this.config.zOffsetMax || this.config.maxDepth,
          gridDensity: this.config.gridDensity || 1.0,
        }
      );

      if (newPointCloud) {
        this.sceneManager.addToScene(newPointCloud);
      }

      // Show controls after successful generation
      this.resourceManager.showControls();
    } catch (error) {
      console.error(
        "Error updating composition with existing depth map:",
        error
      );
      throw error;
    }
  }

  /**
   * Helper method to convert file to data URL
   */
  _fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Public methods for GUI to update parameters in real-time
  updatePointSize(size) {
    this.config.pointSize = size;
    const currentPointCloud = this.pointCloudGenerator.getCurrentPointCloud();
    if (currentPointCloud && currentPointCloud.material) {
      currentPointCloud.material.size = size;
    }
  }

  updateCameraPosition(x, y, z) {
    // Update both config and internal camera position tracking
    if (x !== undefined) this.cameraPosition.x = x;
    if (y !== undefined) this.cameraPosition.y = y;
    if (z !== undefined) {
      this.cameraPosition.z = z;
      this.config.zPosition = z;
    }

    this.sceneManager.setCameraPosition(
      this.cameraPosition.x,
      this.cameraPosition.y,
      this.cameraPosition.z
    );
  }

  updateMaxDepth(maxDepth) {
    this.config.zOffsetMax = maxDepth;
    this.config.maxDepth = maxDepth; // Keep both for compatibility
    return this.pointCloudGenerator.updateMaxDepth(maxDepth);
  }

  // Getter methods for backward compatibility
  get pointCloud() {
    return this.pointCloudGenerator.getCurrentPointCloud();
  }

  get camera() {
    return this.sceneManager.camera;
  }

  get pointSize() {
    return this.config.pointSize;
  }

  set pointSize(value) {
    this.updatePointSize(value);
  }

  get zPosition() {
    return this.config.zPosition;
  }

  set zPosition(value) {
    this.updateCameraPosition(undefined, undefined, value);
  }

  setupThreeJS() {
    this.sceneManager.init(this.config.bg, this.config.zPosition);
    this.setupCameraPanning();
  }

  setupCameraPanning() {
    const canvas = this.sceneManager.getCanvas();
    if (!canvas) return;

    canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.isPanning = true;
        this.lastMousePosition = {
          x: event.clientX,
          y: event.clientY,
        };
        canvas.style.cursor = "grabbing";
        event.preventDefault();
      }
    });

    canvas.addEventListener("mousemove", (event) => {
      if (this.isPanning) {
        const deltaX = event.clientX - this.lastMousePosition.x;
        const deltaY = event.clientY - this.lastMousePosition.y;

        // Update camera position based on mouse movement
        // Invert Y axis
        this.cameraPosition.x -= deltaX * this.panSensitivity;
        this.cameraPosition.y += deltaY * this.panSensitivity;

        this.updateCameraPosition(
          this.cameraPosition.x,
          this.cameraPosition.y,
          this.cameraPosition.z
        );

        this.lastMousePosition = {
          x: event.clientX,
          y: event.clientY,
        };

        event.preventDefault();
      }
    });

    canvas.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.isPanning = false;
        canvas.style.cursor = "grab";
        event.preventDefault();
      }
    });

    canvas.addEventListener("mouseleave", () => {
      this.isPanning = false;
      canvas.style.cursor = "grab";
    });

    canvas.style.cursor = "grab";

    // Touch events for mobile support
    canvas.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) {
        // Single finger - start panning
        this.isPanning = true;
        this.isPinching = false;
        const touch = event.touches[0];
        this.lastMousePosition = {
          x: touch.clientX,
          y: touch.clientY,
        };
        event.preventDefault();
      } else if (event.touches.length === 2) {
        // Two fingers - start pinching
        this.isPinching = true;
        this.isPanning = false;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        this.lastPinchDistance = this.getTouchDistance(touch1, touch2);
        event.preventDefault();
      }
    });

    canvas.addEventListener("touchmove", (event) => {
      if (this.isPanning && event.touches.length === 1) {
        // Single finger panning
        const touch = event.touches[0];
        const deltaX = touch.clientX - this.lastMousePosition.x;
        const deltaY = touch.clientY - this.lastMousePosition.y;

        this.cameraPosition.x -= deltaX * this.panSensitivity;
        this.cameraPosition.y += deltaY * this.panSensitivity;

        this.updateCameraPosition(
          this.cameraPosition.x,
          this.cameraPosition.y,
          this.cameraPosition.z
        );

        this.lastMousePosition = {
          x: touch.clientX,
          y: touch.clientY,
        };

        event.preventDefault();
      } else if (this.isPinching && event.touches.length === 2) {
        // Two finger pinch-to-zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = this.getTouchDistance(touch1, touch2);
        
        if (this.lastPinchDistance > 0) {
          const distanceDelta = currentDistance - this.lastPinchDistance;
          const zoomDelta = -distanceDelta * this.pinchSensitivity;
          
          const newZ = Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraPosition.z + zoomDelta));
          
          this.cameraPosition.z = newZ;
          this.config.zPosition = newZ;
          
          this.updateCameraPosition(
            this.cameraPosition.x,
            this.cameraPosition.y,
            this.cameraPosition.z
          );
        }
        
        this.lastPinchDistance = currentDistance;
        event.preventDefault();
      }
    });

    canvas.addEventListener("touchend", (event) => {
      if (event.touches.length === 0) {
        // All fingers lifted
        this.isPanning = false;
        this.isPinching = false;
        this.lastPinchDistance = 0;
      } else if (event.touches.length === 1 && this.isPinching) {
        // Went from pinch to single finger - start panning
        this.isPinching = false;
        this.isPanning = true;
        const touch = event.touches[0];
        this.lastMousePosition = {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
      event.preventDefault();
    });
  }

  // Helper function to calculate distance between two touch points
  getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  setupControls() {
    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "s") {
        this.saveFrame();
      } else if (event.key.toLowerCase() === "r") {
        this.resetCameraPosition();
      }
    });

    // Add scroll wheel zoom control
    const canvas = this.sceneManager.getCanvas();
    if (canvas) {
      canvas.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();

          // Zoom in/out based on wheel direction
          const delta =
            event.deltaY > 0 ? this.zoomSensitivity : -this.zoomSensitivity;
          const newZ = Math.max(
            this.minZoom,
            Math.min(this.maxZoom, this.cameraPosition.z + delta)
          );

          this.cameraPosition.z = newZ;
          this.config.zPosition = newZ;

          this.updateCameraPosition(
            this.cameraPosition.x,
            this.cameraPosition.y,
            this.cameraPosition.z
          );
        },
        { passive: false }
      );
    }
  }

  resetCameraPosition() {
    this.cameraPosition = { x: 0, y: 0, z: this.config.zPosition };
    this.updateCameraPosition(0, 0, this.config.zPosition);
  }

  saveFrame() {
    this.sceneManager.saveFrame();
  }
}

// Clean up resources before page unload
window.addEventListener("beforeunload", () => {
  if (window.depthMapExplorer) {
    window.depthMapExplorer.cleanup();
  }
});

// Ensure clean state on page load/refresh
window.addEventListener("load", () => {
  // Clean up any existing instance
  if (window.depthMapExplorer) {
    window.depthMapExplorer.cleanup();
  }

  // Clear any cached object URLs from previous sessions
  ResourceManager.clearCachedURLs();

  // Create fresh instance
  window.depthMapExplorer = new DepthMapExploration();
});
