/**
 * Configuration for GUI parameters
 */

export const GUI_CONFIG = {
  // Maximum depth z displacement
  maxDepth: {
    default: 200,
    min: 0,
    max: 600,
    step: 10,
    label: "Depth Amount",
  },

  // Size of individual points
  pointSize: {
    default: 2,
    min: 1,
    max: 10,
    step: 0.1,
    label: "Point Size",
  },

  // Grid density
  gridDensity: {
    default: 1.0,
    min: 0.1,
    max: 1.0,
    step: 0.1,
    label: "Grid Density",
  },

  // Composition width
  compWidth: {
    default: 400,
    min: 200,
    max: 1200,
    step: 20,
    label: "Width",
  },

  // Composition height
  compHeight: {
    default: 600,
    min: 200,
    max: 1200,
    step: 20,
    label: "Height",
  },

  // Composition z position
  zPosition: {
    default: 600,
    min: 20,
    max: 1000,
    step: 20,
    label: "Distance",
  },
};

export function getDefaultParameters() {
  const defaults = {};
  for (const [key, config] of Object.entries(GUI_CONFIG)) {
    defaults[key] = config.default;
  }
  return defaults;
}

export function getParameterConfig(key) {
  return GUI_CONFIG[key] || null;
}

export function validateParameter(key, value) {
  const config = GUI_CONFIG[key];
  if (!config) return false;

  const numValue = parseFloat(value);
  return numValue >= config.min && numValue <= config.max;
}

export function clampParameter(key, value) {
  const config = GUI_CONFIG[key];
  if (!config) return value;

  const numValue = parseFloat(value);
  return Math.max(config.min, Math.min(config.max, numValue));
}
