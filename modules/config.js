/**
 * Centralized configuration for all GUI parameters
 * Modify values here to update throughout the entire application
 */

export const GUI_CONFIG = {
  // Camera distance from the point cloud
  zPosition: {
    default: 400,
    min: 20,
    max: 1000,
    step: 20,
    label: "Distance",
  },

  // Canvas composition width
  compWidth: {
    default: 400,
    min: 200,
    max: 1200,
    step: 20,
    label: "Width",
  },

  // Canvas composition height
  compHeight: {
    default: 400,
    min: 200,
    max: 1200,
    step: 20,
    label: "Height",
  },

  // Size of individual points in the point cloud
  pointSize: {
    default: 3.5,
    min: 1,
    max: 10,
    step: 0.1,
    label: "Point Size",
  },

  // Maximum depth displacement for points
  maxDepth: {
    default: 200,
    min: 0,
    max: 600,
    step: 10,
    label: "Depth",
  },

  // Grid density for point sampling
  gridDensity: {
    default: 1.0,
    min: 0.1,
    max: 1.0,
    step: 0.1,
    label: "Density",
  },
};

/**
 * Helper function to get default values as an object
 */
export function getDefaultParameters() {
  const defaults = {};
  for (const [key, config] of Object.entries(GUI_CONFIG)) {
    defaults[key] = config.default;
  }
  return defaults;
}

/**
 * Helper function to get parameter config by key
 */
export function getParameterConfig(key) {
  return GUI_CONFIG[key] || null;
}

/**
 * Helper function to validate a parameter value
 */
export function validateParameter(key, value) {
  const config = GUI_CONFIG[key];
  if (!config) return false;

  const numValue = parseFloat(value);
  return numValue >= config.min && numValue <= config.max;
}

/**
 * Helper function to clamp a parameter value to valid range
 */
export function clampParameter(key, value) {
  const config = GUI_CONFIG[key];
  if (!config) return value;

  const numValue = parseFloat(value);
  return Math.max(config.min, Math.min(config.max, numValue));
}
