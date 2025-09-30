import { GUI_CONFIG } from "./modules/config.js";

/**
 * Dynamically generate GUI controls from configuration
 */
function generateGUIControls() {
  const guiSection = document.querySelector(".gui-section:nth-of-type(2)"); // The section with controls
  if (!guiSection) {
    console.error("GUI controls section not found");
    return;
  }

  // Clear existing controls (keep only the file upload section)
  const existingControls = guiSection.querySelectorAll(".range-container");
  existingControls.forEach((control) => control.remove());

  // Generate controls from config
  Object.entries(GUI_CONFIG).forEach(([key, config]) => {
    const containerDiv = document.createElement("div");
    containerDiv.className = "range-container";

    containerDiv.innerHTML = `
      <label>${config.label}:</label>
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
    `;

    guiSection.appendChild(containerDiv);
  });
}

// Generate controls when DOM is loaded
document.addEventListener("DOMContentLoaded", generateGUIControls);

export { generateGUIControls };
