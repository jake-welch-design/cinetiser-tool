// GUI Control System for Depth Map Explorer
class GUIController {
  constructor() {
    this.depthMapFile = null;
    this.displayImageFile = null;
    this.parameters = {
      zPosition: 400,
      compWidth: 288,
      compHeight: 384,
      pointSize: 3.5,
      maxDepth: 100,
    };

    // Store processed images for reuse (to avoid re-running AI)
    this.generatedDepthMap = null;
    this.loadedDisplayImage = null;

    // Add throttling for live updates
    this.updateThrottleTimeout = null;
    this.THROTTLE_DELAY = 150; // milliseconds

    this.initializeControls();
    this.setupEventListeners();
    // Sidebar is now always visible - no toggle needed
  }

  initializeControls() {
    // File input elements
    this.depthMapInput = document.getElementById("depthMapInput");
    this.displayImageInput = document.getElementById("displayImageInput");
    this.depthMapPreview = document.getElementById("depthMapPreview");
    this.displayImagePreview = document.getElementById("displayImagePreview");

    // Parameter controls
    this.controls = {
      zPosition: {
        slider: document.getElementById("zPosition"),
        input: document.getElementById("zPositionValue"),
      },
      compWidth: {
        slider: document.getElementById("compWidth"),
        input: document.getElementById("compWidthValue"),
      },
      compHeight: {
        slider: document.getElementById("compHeight"),
        input: document.getElementById("compHeightValue"),
      },
      pointSize: {
        slider: document.getElementById("pointSize"),
        input: document.getElementById("pointSizeValue"),
      },
      maxDepth: {
        slider: document.getElementById("maxDepth"),
        input: document.getElementById("maxDepthValue"),
      },
    };

    // Buttons
    this.generateBtn = document.getElementById("generateBtn");
    this.saveBtn = document.getElementById("saveBtn");

    // Initially disable generate button
    this.generateBtn.disabled = true;
  }

  setupEventListeners() {
    // File input handlers
    this.depthMapInput.addEventListener("change", (e) =>
      this.handleDepthMapUpload(e)
    );
    this.displayImageInput.addEventListener("change", (e) =>
      this.handleDisplayImageUpload(e)
    );

    // Parameter control handlers
    Object.keys(this.controls).forEach((param) => {
      const control = this.controls[param];

      // Sync slider and number input
      control.slider.addEventListener("input", (e) => {
        this.parameters[param] = parseFloat(e.target.value);
        control.input.value = e.target.value;
        this.onParameterChange(param, this.parameters[param]);
      });

      control.input.addEventListener("input", (e) => {
        this.parameters[param] = parseFloat(e.target.value);
        control.slider.value = e.target.value;
        this.onParameterChange(param, this.parameters[param]);
      });
    });

    // Button handlers
    this.generateBtn.addEventListener("click", () =>
      this.generateComposition()
    );
    this.saveBtn.addEventListener("click", () => this.saveImage());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        this.saveImage();
      }
    });
  }

  handleDepthMapUpload(event) {
    const file = event.target.files[0];
    if (file) {
      this.depthMapFile = file;
      this.previewImage(file, this.depthMapPreview);
      this.checkGenerateReady();
    }
  }

  handleDisplayImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
      this.displayImageFile = file;
      this.previewImage(file, this.displayImagePreview);
      this.checkGenerateReady();
    }
  }

  previewImage(file, previewElement) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewElement.src = e.target.result;
      previewElement.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  checkGenerateReady() {
    this.generateBtn.disabled = !(this.depthMapFile && this.displayImageFile);
  }

  async generateComposition() {
    if (!this.depthMapFile || !this.displayImageFile) {
      alert("Please select both source image and display image files.");
      return;
    }

    try {
      this.setLoadingState("Loading AI model...");

      // Check if depth detector is ready, if not initialize it
      if (
        window.depthMapExplorer &&
        !window.depthMapExplorer.depthDetector.isReady()
      ) {
        if (!window.depthMapExplorer.depthDetector.isModelLoading()) {
          await window.depthMapExplorer.depthDetector.initialize();
        }
      }

      this.setLoadingState("Generating depth map...");

      // Use depth detection to automatically generate depth map from source image
      if (window.depthMapExplorer) {
        await window.depthMapExplorer.updateCompositionWithDepthDetection(
          this.depthMapFile, // This will be used for depth detection
          this.displayImageFile, // This will be used for color
          this.parameters,
          // Callback to update depth map preview and store processed images
          async (depthDataUrl) => {
            this.updateDepthMapPreview(depthDataUrl);
            this.setLoadingState("Creating 3D point cloud...");

            // Store the generated depth map for reuse
            this.generatedDepthMap = await this.loadImageFromDataUrl(
              depthDataUrl
            );

            // Store the loaded display image for reuse
            const displayImageURL = await this.fileToDataURL(
              this.displayImageFile
            );
            this.loadedDisplayImage = await this.loadImageFromDataUrl(
              displayImageURL
            );
          }
        );
      }
    } catch (error) {
      console.error("Error generating composition:", error);
      alert(
        "Error generating composition. Please check the console for details."
      );
    } finally {
      this.clearLoadingState();
    }
  }

  /**
   * Set loading state with animation in main canvas area
   */
  setLoadingState(message) {
    this.generateBtn.disabled = true;
    this.generateBtn.textContent = message;

    // Update the main loading element with animation
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.classList.add("loading");
      loadingElement.innerHTML = `
        <div>${message}</div>
        <div class="loading-dots">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      `;
      loadingElement.classList.remove("hidden");
    }
  }

  /**
   * Clear loading state
   */
  clearLoadingState() {
    this.generateBtn.disabled = false;
    this.generateBtn.textContent = "Generate";

    // Hide the loading element
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.classList.remove("loading");
      loadingElement.classList.add("hidden");
    }
  }

  /**
   * Update the depth map preview with generated depth map
   */
  updateDepthMapPreview(depthDataUrl) {
    if (this.depthMapPreview) {
      this.depthMapPreview.src = depthDataUrl;
      this.depthMapPreview.style.display = "block";
    }
  }

  /**
   * Load image from data URL
   */
  loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  onParameterChange(paramName, value) {
    // Real-time parameter updates
    console.log(`Parameter ${paramName} changed to ${value}`);

    if (!window.depthMapExplorer) {
      return; // Application not ready yet
    }

    // Point size, Z position, and max depth can be updated immediately without regenerating geometry
    if (paramName === "pointSize") {
      this.updatePointSize(value);
    } else if (paramName === "zPosition") {
      this.updateZPosition(value);
    } else if (paramName === "maxDepth") {
      // Try to update max depth in real-time
      this.updateMaxDepth(value);
    } else if (paramName === "compWidth" || paramName === "compHeight") {
      // Width/height changes should use existing processed images (no AI re-processing)
      this.throttledUpdateWithExistingImages();
    } else {
      // For other parameters, throttle updates to avoid too many regenerations
      this.throttledUpdate();
    }
  }

  throttledUpdate(customDelay = null) {
    // Clear existing timeout
    if (this.updateThrottleTimeout) {
      clearTimeout(this.updateThrottleTimeout);
    }

    // Use custom delay or default throttle delay
    const delay = customDelay !== null ? customDelay : this.THROTTLE_DELAY;

    // Set new timeout for throttled update
    this.updateThrottleTimeout = setTimeout(() => {
      this.updateWithCurrentImages();
    }, delay);
  }

  throttledUpdateWithExistingImages(customDelay = null) {
    // Clear existing timeout
    if (this.updateThrottleTimeout) {
      clearTimeout(this.updateThrottleTimeout);
    }

    // Use custom delay or default throttle delay
    const delay = customDelay !== null ? customDelay : this.THROTTLE_DELAY;

    // Set new timeout for throttled update with existing images
    this.updateThrottleTimeout = setTimeout(() => {
      this.updateWithExistingImages();
    }, delay);
  }

  updatePointSize(size) {
    if (window.depthMapExplorer) {
      window.depthMapExplorer.updatePointSize(size);
    }
  }

  updateZPosition(zPos) {
    if (window.depthMapExplorer) {
      window.depthMapExplorer.updateCameraPosition(0, 0, zPos);
    }
  }

  updateMaxDepth(maxDepth) {
    if (window.depthMapExplorer) {
      const success = window.depthMapExplorer.updateMaxDepth(maxDepth);
      if (!success) {
        // Fallback to regeneration if real-time update fails
        console.log(
          "Real-time maxDepth update failed, falling back to regeneration"
        );
        this.throttledUpdate(50);
      }
    }
  }

  async updateWithCurrentImages() {
    // Only regenerate if we have both images loaded
    if (!this.depthMapFile || !this.displayImageFile) {
      return; // No images to work with
    }

    try {
      this.setLoadingState("Updating...");

      // Use depth detection to regenerate with current parameters
      await window.depthMapExplorer.updateCompositionWithDepthDetection(
        this.depthMapFile,
        this.displayImageFile,
        this.parameters,
        // Callback to update depth map preview
        (depthDataUrl) => {
          this.updateDepthMapPreview(depthDataUrl);
        }
      );
    } catch (error) {
      console.error("Error updating composition live:", error);
    } finally {
      this.clearLoadingState();
    }
  }

  async updateWithExistingImages() {
    // Only update if we have processed images stored
    if (!this.generatedDepthMap || !this.loadedDisplayImage) {
      console.log(
        "No processed images available, falling back to full regeneration"
      );
      return this.updateWithCurrentImages();
    }

    try {
      this.setLoadingState("Updating layout...");

      // Use existing processed images (no AI processing needed)
      await window.depthMapExplorer.updateCompositionWithExistingDepthMap(
        this.generatedDepthMap,
        this.loadedDisplayImage,
        this.parameters
      );
    } catch (error) {
      console.error("Error updating with existing images:", error);
      // Fallback to full regeneration if existing images fail
      return this.updateWithCurrentImages();
    } finally {
      this.clearLoadingState();
    }
  }

  saveImage() {
    if (window.depthMapExplorer) {
      window.depthMapExplorer.saveFrame();
    }
  }

  // Method to get current parameters
  getParameters() {
    return { ...this.parameters };
  }

  // Method to update parameters programmatically
  setParameter(name, value) {
    if (this.controls[name]) {
      this.parameters[name] = value;
      this.controls[name].slider.value = value;
      this.controls[name].input.value = value;
    }
  }

  resetState() {
    // Reset file state
    this.depthMapFile = null;
    this.displayImageFile = null;

    // Clear stored processed images
    this.generatedDepthMap = null;
    this.loadedDisplayImage = null;

    // Reset parameters to defaults
    this.parameters = {
      zPosition: 400,
      compWidth: 288,
      compHeight: 384,
      pointSize: 3.5,
      maxDepth: 100,
    };

    // Update all controls to default values
    Object.keys(this.controls).forEach((name) => {
      const control = this.controls[name];
      const defaultValue = this.parameters[name];
      if (control.slider) control.slider.value = defaultValue;
      if (control.input) control.input.value = defaultValue;
    });

    // Clear previews
    if (this.depthMapPreview) {
      this.depthMapPreview.src = "";
      this.depthMapPreview.style.display = "none";
    }
    if (this.displayImagePreview) {
      this.displayImagePreview.src = "";
      this.displayImagePreview.style.display = "none";
    }

    // Clear file inputs
    if (this.depthMapInput) this.depthMapInput.value = "";
    if (this.displayImageInput) this.displayImageInput.value = "";

    // Disable generate button
    this.checkGenerateReady();

    // Clear any throttle timeouts
    if (this.updateThrottleTimeout) {
      clearTimeout(this.updateThrottleTimeout);
      this.updateThrottleTimeout = null;
    }
  }
}

// Clean up GUI state before page refresh
window.addEventListener("beforeunload", () => {
  if (window.guiController) {
    window.guiController.resetState();
  }
});

// Initialize GUI controller when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Clean up any existing instance
  if (window.guiController) {
    window.guiController.resetState();
  }
  window.guiController = new GUIController();
});

export { GUIController };
