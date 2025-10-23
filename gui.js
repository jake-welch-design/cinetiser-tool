import { getDefaultParameters, GUI_CONFIG, clampParameter } from "./modules/config.js";

/**
 * GUI Controller - handles all GUI interactions
 */
class GUIController {
  constructor() {
    this.imageFile = null;
    this.parameters = getDefaultParameters();

    // Reference to sketch instance (set by sketch.js)
    this.sketch = null;

    this.initializeControls();
    this.setupEventListeners();
  }

  initializeControls() {
    // File input elements
    this.imageInput = document.getElementById("imageInput");

    // Clear file input on page load
    if (this.imageInput) {
      this.imageInput.value = "";
    }

    // Parameter controls - dynamically created from config.js
    this.controls = {};
    console.log("Looking for controls from GUI_CONFIG:", Object.keys(GUI_CONFIG));

    Object.keys(GUI_CONFIG).forEach((paramKey) => {
      const slider = document.getElementById(paramKey);
      const input = document.getElementById(paramKey + "Value");

      console.log(`Searching for ${paramKey}:`, {
        sliderFound: !!slider,
        inputFound: !!input,
        sliderElement: slider,
        inputElement: input,
      });

      if (slider && input) {
        this.controls[paramKey] = { slider, input };
        console.log(`✓ Control registered for: ${paramKey}`);
      } else {
        console.warn(`✗ Control not found for parameter: ${paramKey}`);
      }
    });

    console.log("Final controls object:", this.controls);

    // Buttons
    this.saveBtn = document.getElementById("saveBtn");
    this.guiToggleBtn = document.getElementById("gui-toggle");
    this.guiCloseBtn = document.getElementById("gui-close");
    this.guiPanel = document.getElementById("gui-panel");

    // GUI toggle state (defaults to open)
    this.isGuiOpen = true;
    if (this.guiPanel) {
      this.guiPanel.classList.remove("hidden");
    }
    document.body.classList.remove("gui-hidden");
    if (this.guiToggleBtn) {
      this.guiToggleBtn.style.display = "none";
    }
  }

  setupEventListeners() {
    // File input handler
    if (this.imageInput) {
      this.imageInput.addEventListener("change", (e) => this.handleImageUpload(e));
    }

    // Parameter control handlers
    Object.keys(this.controls).forEach((param) => {
      const control = this.controls[param];

      if (!control.slider || !control.input) return;

      // Sync slider and number input with validation
      control.slider.addEventListener("input", (e) => {
        const value = clampParameter(param, e.target.value);
        this.parameters[param] = value;
        control.input.value = value;
        this.onParameterChange(param, value);
      });

      control.input.addEventListener("input", (e) => {
        const value = clampParameter(param, e.target.value);
        this.parameters[param] = value;
        control.slider.value = value;
        this.onParameterChange(param, value);
      });
    });

    // Canvas preset buttons
    const presetButtons = document.querySelectorAll(".canvas-preset-btn");
    presetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const width = parseInt(button.getAttribute("data-width"));
        const height = parseInt(button.getAttribute("data-height"));
        this.applyCanvasPreset(width, height);
      });
    });

    // Button handlers
    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => this.saveImage());
    }
    if (this.guiToggleBtn) {
      this.guiToggleBtn.addEventListener("click", () => this.openGui());
    }
    if (this.guiCloseBtn) {
      this.guiCloseBtn.addEventListener("click", () => {
        this.closeGui();
      });
    }

    // ESC key to close GUI
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isGuiOpen) {
        this.closeGui();
      }
    });
  }

  applyCanvasPreset(width, height) {
    // Update parameter values
    this.parameters.canvasWidth = width;
    this.parameters.canvasHeight = height;

    // Update UI controls
    if (this.controls.canvasWidth) {
      this.controls.canvasWidth.slider.value = width;
      this.controls.canvasWidth.input.value = width;
    }
    if (this.controls.canvasHeight) {
      this.controls.canvasHeight.slider.value = height;
      this.controls.canvasHeight.input.value = height;
    }

    // Notify sketch
    this.onParameterChange("canvasWidth", width);
    this.onParameterChange("canvasHeight", height);
  }

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.imageFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
      // Notify sketch if connected
      if (this.sketch && this.sketch.onImageLoaded) {
        this.sketch.onImageLoaded(e.target.result);
      }
    };

    reader.readAsDataURL(file);
  }

  onParameterChange(paramName, value) {
    // Notify sketch of parameter change if connected
    if (this.sketch && this.sketch.onParameterChange) {
      this.sketch.onParameterChange(paramName, value, this.parameters);
    }
  }

  saveImage() {
    // Call sketch's save function if available
    if (this.sketch && this.sketch.saveCanvas) {
      this.sketch.saveCanvas();
    } else {
      console.warn("No save function available");
    }
  }

  openGui() {
    this.isGuiOpen = true;
    if (this.guiPanel) {
      this.guiPanel.classList.remove("hidden");
    }
    document.body.classList.remove("gui-hidden");
    if (this.guiToggleBtn) {
      this.guiToggleBtn.style.display = "none";
    }
  }

  closeGui() {
    this.isGuiOpen = false;
    if (this.guiPanel) {
      this.guiPanel.classList.add("hidden");
    }
    document.body.classList.add("gui-hidden");
    if (this.guiToggleBtn) {
      this.guiToggleBtn.style.display = "inline-block";
    }
  }

  // Update slider bounds dynamically (e.g., when image loads)
  updateSliderBounds(paramKey, min, max) {
    const control = this.controls[paramKey];
    if (!control || !control.slider || !control.input) {
      console.warn(`Cannot update bounds for ${paramKey}: control not found`);
      return;
    }

    // Update slider and input min/max attributes
    control.slider.min = min;
    control.slider.max = max;
    control.input.min = min;
    control.input.max = max;

    // Check if movement is possible (min != max)
    const canMove = Math.abs(max - min) > 0.01; // Use small epsilon for floating point comparison

    if (canMove) {
      // Enable the controls
      control.slider.disabled = false;
      control.input.disabled = false;
      control.slider.style.opacity = "1";
      control.input.style.opacity = "1";
      control.slider.style.cursor = "pointer";
    } else {
      // Disable the controls when no movement is possible
      control.slider.disabled = true;
      control.input.disabled = true;
      control.slider.style.opacity = "0.4";
      control.input.style.opacity = "0.4";
      control.slider.style.cursor = "not-allowed";
    }

    // Clamp current value to new bounds
    const currentValue = this.parameters[paramKey];
    const clampedValue = Math.max(min, Math.min(max, currentValue));

    if (currentValue !== clampedValue) {
      this.updateParameterValue(paramKey, clampedValue);
    }

    console.log(`Updated bounds for ${paramKey}: [${min}, ${max}], canMove: ${canMove}`);
  }

  // Update a parameter value programmatically
  updateParameterValue(paramKey, value) {
    const control = this.controls[paramKey];
    if (!control || !control.slider || !control.input) {
      console.warn(`Cannot update value for ${paramKey}: control not found`);
      return;
    }

    this.parameters[paramKey] = value;
    control.slider.value = value;
    control.input.value = value;

    // Notify sketch
    this.onParameterChange(paramKey, value);
  }

  // Method to connect the sketch instance
  connectSketch(sketch) {
    this.sketch = sketch;
  }
}

// Create global GUI instance when DOM is ready
let gui = null;

// Initialize GUI after DOM and controls are ready
function initGUI() {
  console.log("Initializing GUI Controller...");
  gui = new GUIController();
  window.gui = gui; // Make available globally
  console.log("GUI Controller initialized");
  console.log("Available controls:", Object.keys(gui.controls));
}

// Wait for the gui-generator to dispatch the 'guiControlsGenerated' event
window.addEventListener("guiControlsGenerated", () => {
  console.log("GUI controls generated event received");
  initGUI();
});

// Fallback: if event was already dispatched or gui-generator loads in different order
setTimeout(() => {
  if (!gui) {
    console.log("Initializing GUI via fallback timeout");
    initGUI();
  }
}, 500);

// Export proxy that ensures GUI is ready
export default new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === "connectSketch") {
        return (sketch) => {
          if (gui) {
            gui.connectSketch(sketch);
          } else {
            // If GUI not ready yet, wait for it
            const checkGui = setInterval(() => {
              if (gui) {
                gui.connectSketch(sketch);
                clearInterval(checkGui);
              }
            }, 50);
          }
        };
      }
      // For any other property, try to access it from gui
      if (gui && prop in gui) {
        const value = gui[prop];
        return typeof value === "function" ? value.bind(gui) : value;
      }
      return undefined;
    },
  }
);
