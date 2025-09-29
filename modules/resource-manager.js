/**
 * Manages DOM state and resource cleanup
 */
export class ResourceManager {
  constructor() {
    this.managedResources = new Set();
  }

  /**
   * Register a resource for management
   */
  registerResource(resource, cleanupMethod) {
    this.managedResources.add({ resource, cleanupMethod });
  }

  /**
   * Reset DOM elements to initial state
   */
  resetDOMState() {
    // Reset DOM elements to initial state
    const loadingElement = document.getElementById("loading");
    const controlsElement = document.getElementById("controls");

    if (loadingElement) {
      loadingElement.textContent =
        "Upload depth map and display images to begin";
      loadingElement.classList.remove("hidden");
    }

    if (controlsElement) {
      controlsElement.classList.add("hidden");
    }

    // Clear any file inputs if they exist
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      input.value = "";
    });

    // Clear any image previews if they exist
    const previews = document.querySelectorAll('img[id$="Preview"]');
    previews.forEach((preview) => {
      preview.src = "";
      preview.style.display = "none";
    });

    // Reset generate button if it exists
    const generateBtn = document.getElementById("generateBtn");
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = "Generate";
    }

    // Reset GUI controller if it exists
    if (window.guiController) {
      window.guiController.resetState();
    }
  }

  /**
   * Show controls and hide loading message
   */
  showControls() {
    const loadingElement = document.getElementById("loading");
    const controlsElement = document.getElementById("controls");

    if (loadingElement) {
      loadingElement.classList.add("hidden");
    }

    if (controlsElement) {
      controlsElement.classList.remove("hidden");
    }
  }

  /**
   * Clean up all managed resources
   */
  cleanup() {
    this.managedResources.forEach(({ resource, cleanupMethod }) => {
      try {
        if (typeof cleanupMethod === "string" && resource[cleanupMethod]) {
          resource[cleanupMethod]();
        } else if (typeof cleanupMethod === "function") {
          cleanupMethod(resource);
        } else if (resource.cleanup) {
          resource.cleanup();
        }
      } catch (error) {
        console.error("Error cleaning up resource:", error);
      }
    });

    this.managedResources.clear();
  }

  /**
   * Clear cached URLs from window
   */
  static clearCachedURLs() {
    if (window.cachedDepthMapURL) {
      URL.revokeObjectURL(window.cachedDepthMapURL);
      window.cachedDepthMapURL = null;
    }
    if (window.cachedDisplayImageURL) {
      URL.revokeObjectURL(window.cachedDisplayImageURL);
      window.cachedDisplayImageURL = null;
    }
  }
}
