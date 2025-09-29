import { Utils } from "./modules/utils.js";
import { ImageProcessor } from "./modules/image-processor.js";
import { SceneManager } from "./modules/scene-manager.js";
import { PointCloudGenerator } from "./modules/point-cloud-generator.js";
import { ResourceManager } from "./modules/resource-manager.js";
import { DepthDetector } from "./modules/depth-detector.js";

class DepthMapExploration {
  constructor() {
    // Default parameters
    this.config = {
      layerWidth: 288,
      layerHeight: 384,
      pointSize: 3.5,
      zPosition: 400,
      zOffsetMin: 0,
      zOffsetMax: 100,
      bg: 0x000000,
    };

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

    // Register modules for cleanup
    this.resourceManager.registerResource(this.sceneManager, "cleanup");
    this.resourceManager.registerResource(this.imageProcessor, "cleanup");
    this.resourceManager.registerResource(this.pointCloudGenerator, "cleanup");
    this.resourceManager.registerResource(this.depthDetector, "cleanup");

    this.init();
  }

  async init() {
    // Clean up any existing resources first
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
   */
  async updateCompositionWithDepthDetection(sourceImageFile, displayImageFile, parameters) {
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
      const depthMapImage = await this.depthDetector.generateDepthMap(sourceImageFile);
      
      // Load the display image
      const displayImageURL = await this._fileToDataURL(displayImageFile);
      const displayImg = await Utils.loadImage(displayImageURL);

      console.log("Processing images with generated depth map...");

      // Process images (depth map is now generated, display image is loaded)
      this.imageProcessor.processImages(
        depthMapImage,
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

    // Mouse down - start panning
    canvas.addEventListener("mousedown", (event) => {
      // Only pan with left mouse button
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

    // Mouse move - perform panning
    canvas.addEventListener("mousemove", (event) => {
      if (this.isPanning) {
        const deltaX = event.clientX - this.lastMousePosition.x;
        const deltaY = event.clientY - this.lastMousePosition.y;

        // Update camera position based on mouse movement
        // Invert Y axis to make movement feel natural
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

    // Mouse up - stop panning
    canvas.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.isPanning = false;
        canvas.style.cursor = "grab";
        event.preventDefault();
      }
    });

    // Mouse leave - stop panning
    canvas.addEventListener("mouseleave", () => {
      this.isPanning = false;
      canvas.style.cursor = "grab";
    });

    // Set initial cursor
    canvas.style.cursor = "grab";

    // Touch events for mobile support
    canvas.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) {
        this.isPanning = true;
        const touch = event.touches[0];
        this.lastMousePosition = {
          x: touch.clientX,
          y: touch.clientY,
        };
        event.preventDefault();
      }
    });

    canvas.addEventListener("touchmove", (event) => {
      if (this.isPanning && event.touches.length === 1) {
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
      }
    });

    canvas.addEventListener("touchend", () => {
      this.isPanning = false;
    });
  }

  setupControls() {
    // Keyboard controls
    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "s") {
        this.saveFrame();
      } else if (event.key.toLowerCase() === "r") {
        // Reset camera position
        this.resetCameraPosition();
      }
    });
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
