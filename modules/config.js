/*
 * Configuration for GUI parameters
 */

export const GUI_CONFIG = {
  // Canvas width
  canvasWidth: {
    default: 700,
    min: 200,
    max: 1920,
    step: 10,
    label: "Canvas Width",
    section: "canvas",
  },

  // Canvas height
  canvasHeight: {
    default: 600,
    min: 200,
    max: 1920,
    step: 10,
    label: "Canvas Height",
    section: "canvas",
  },

  // X Position of image
  imagePosX: {
    default: 0,
    min: -500,
    max: 500,
    step: 1,
    label: "X position",
    section: "image",
  },

  // Y Position of image
  imagePosY: {
    default: 0,
    min: -500,
    max: 500,
    step: 1,
    label: "Y position",
    section: "image",
  },

  // Zoom level of image
  imageZoom: {
    default: 1.0,
    min: 0.1,
    max: 3.0,
    step: 0.01,
    label: "Zoom",
    section: "image",
  },
};

// Define sections and their display properties
export const GUI_SECTIONS = {
  canvas: {
    title: "Canvas",
    order: 1,
  },
  image: {
    title: "Image",
    order: 2,
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

export function getCanvasPresets() {
  return [
    {
      label: "9:16 (Portrait)",
      width: 1080,
      height: 1920,
    },
    {
      label: "16:9 (Landscape)",
      width: 1920,
      height: 1080,
    },
    {
      label: "4:5 (Portrait)",
      width: 1080,
      height: 1350,
    },
    {
      label: "5:4 (Landscape)",
      width: 1350,
      height: 1080,
    },
    {
      label: "1:1 (Square)",
      width: 1080,
      height: 1080,
    },
  ];
}
