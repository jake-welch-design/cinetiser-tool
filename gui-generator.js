import {
  GUI_CONFIG,
  GUI_SECTIONS,
  getCanvasPresets,
} from "./modules/config.js";

/**
 * Dynamically generate GUI controls from configuration
 */
function generateGUIControls() {
  const guiSection = document.getElementById("controls-section");
  if (!guiSection) {
    console.error("GUI controls section not found");
    return;
  }

  // Clear existing controls
  guiSection.innerHTML = "";

  // Add Canvas Presets Section
  const canvasPresetsSection = document.createElement("div");
  canvasPresetsSection.className = "canvas-presets-section";

  const presetsHeader = document.createElement("h3");
  presetsHeader.className = "gui-section-header";
  presetsHeader.textContent = "Canvas Presets";
  canvasPresetsSection.appendChild(presetsHeader);

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "canvas-preset-buttons";
  buttonsContainer.id = "canvas-preset-buttons";
  canvasPresetsSection.appendChild(buttonsContainer);

  guiSection.appendChild(canvasPresetsSection);

  // Generate preset buttons
  const canvasPresets = getCanvasPresets();
  canvasPresets.forEach((preset) => {
    const button = document.createElement("button");
    button.className = "canvas-preset-btn";
    button.textContent = preset.label;
    button.setAttribute("data-width", preset.width);
    button.setAttribute("data-height", preset.height);
    buttonsContainer.appendChild(button);
  });

  // Group controls by section
  const controlsBySection = {};
  Object.entries(GUI_CONFIG).forEach(([key, config]) => {
    const section = config.section || "other";
    if (!controlsBySection[section]) {
      controlsBySection[section] = [];
    }
    controlsBySection[section].push({ key, config });
  });

  // Sort sections by order
  const sortedSections = Object.entries(GUI_SECTIONS).sort(
    ([, a], [, b]) => a.order - b.order
  );

  // Generate sections
  sortedSections.forEach(([sectionKey, sectionConfig]) => {
    const controls = controlsBySection[sectionKey];
    if (!controls || controls.length === 0) return;

    // Add separator
    const separator = document.createElement("div");
    separator.className = "gui-section-separator";
    guiSection.appendChild(separator);

    // Add section header
    const header = document.createElement("h3");
    header.className = "gui-section-header";
    header.textContent = sectionConfig.title;
    guiSection.appendChild(header);

    // Add controls for this section
    controls.forEach(({ key, config }) => {
      const containerDiv = document.createElement("div");
      containerDiv.className = "range-container";

      // If the config defines a boolean type, render a checkbox instead
      if (config.type === "boolean") {
        // render a switch-style checkbox. Add CSS for .switch and .switch-slider in stylesheet to style it
        containerDiv.innerHTML = `
          <label>${config.label}:</label>
          <div>
            <label class="switch">
              <input type="checkbox" id="${key}" ${
          config.default ? "checked" : ""
        } />
              <span class="switch-slider"></span>
            </label>
          </div>
        `;
      } else {
        containerDiv.innerHTML = `
          <label>${config.label}:</label>
          <div>
            <input type="range" 
                   id="${key}" 
                   min="${config.min}" 
                   max="${config.max}" 
                   step="${config.step}" 
                   value="${config.default}">
            <input type="number" 
                   id="${key}Value" 
                   min="${config.min}" 
                   max="${config.max}" 
                   step="${config.step}" 
                   value="${config.default}">
          </div>
        `;
      }

      guiSection.appendChild(containerDiv);
      console.log(
        `Created control for: ${key} (${config.label}) in section: ${sectionKey}`
      );
    });
  });

  console.log("GUI controls generated");
  console.log("Total controls created:", Object.keys(GUI_CONFIG).length);

  // Dispatch event after a short delay to ensure gui.js has loaded and set up its listener
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("guiControlsGenerated"));
    console.log("guiControlsGenerated event dispatched");
  }, 50);
}

// Generate GUI controls when page loads
// Check if DOM is already loaded, otherwise wait for DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", generateGUIControls);
} else {
  // DOM is already loaded, generate controls immediately
  generateGUIControls();
}

export { generateGUIControls };
