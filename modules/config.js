/*
 * Configuration for GUI parameters
 */

export const GUI_CONFIG = {
  // Canvas width
  canvasWidth: {
    default: 400,
    min: 200,
    max: 1920,
    step: 10,
    label: "Canvas Width",
    section: "canvas",
  },

  // Canvas height
  canvasHeight: {
    default: 500,
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

  // Cinetisation: outer diameter of the largest ring
  cutSize: {
    default: 300,
    min: 100,
    max: 1920,
    step: 1,
    label: "Cut size",
    section: "cinetisation",
  },

  // Cinetisation: number of divisions within the cut size
  sliceAmount: {
    default: 10,
    min: 1,
    max: 30,
    step: 1,
    label: "Slice amount",
    section: "cinetisation",
  },

  // Rotation amount (degrees)
  rotationAmount: {
    default: 10,
    min: 0,
    max: 45,
    step: 1,
    label: "Rotation amount",
    section: "cinetisation",
  },

  // Rotation speed
  rotationSpeed: {
    default: 0.004,
    min: 0,
    max: 0.05,
    step: 0.001,
    label: "Speed",
    section: "cinetisation",
  },

  // Animated toggle: true = animated, false = static
  animated: {
    default: false,
    type: "boolean",
    label: "Animated",
    section: "cinetisation",
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
  cinetisation: {
    title: "Cinetisation",
    order: 3,
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
