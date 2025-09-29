import { pipeline } from "@huggingface/transformers";

/**
 * Handles automatic depth detection from regular images using Transformers.js
 */
export class DepthDetector {
  constructor() {
    this.depthEstimator = null;
    this.isLoading = false;
    this.isInitialized = false;
  }

  /**
   * Initialize the depth estimation pipeline
   */
  async initialize() {
    if (this.isInitialized || this.isLoading) {
      return;
    }

    try {
      this.isLoading = true;
      console.log("Loading depth estimation model...");
      
      // Create depth-estimation pipeline using the same model as the Node.js version
      this.depthEstimator = await pipeline(
        "depth-estimation",
        "Xenova/depth-anything-small-hf"
      );
      
      this.isInitialized = true;
      this.isLoading = false;
      console.log("Depth estimation model loaded successfully");
    } catch (error) {
      this.isLoading = false;
      console.error("Error loading depth estimation model:", error);
      throw error;
    }
  }

  /**
   * Generate depth map from an image file
   * @param {File} imageFile - The input image file
   * @returns {Promise<HTMLImageElement>} - The generated depth map as an image
   */
  async generateDepthMap(imageFile) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log("Generating depth map for image:", imageFile.name);
      
      // Convert file to data URL for the model
      const imageUrl = await this._fileToDataURL(imageFile);
      
      // Generate depth map using the model
      const output = await this.depthEstimator(imageUrl);
      
      // Convert the depth RawImage to a canvas and then to an image element
      const depthImage = await this._rawImageToImage(output.depth);
      
      console.log("Depth map generated successfully");
      return depthImage;
    } catch (error) {
      console.error("Error generating depth map:", error);
      throw error;
    }
  }

  /**
   * Convert file to data URL
   */
  _fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert RawImage from transformers to HTML Image element
   */
  async _rawImageToImage(rawImage) {
    return new Promise((resolve, reject) => {
      try {
        // Create a canvas to render the raw image data
        const canvas = document.createElement('canvas');
        canvas.width = rawImage.width;
        canvas.height = rawImage.height;
        const ctx = canvas.getContext('2d');
        
        // Create ImageData from the raw image
        const imageData = ctx.createImageData(rawImage.width, rawImage.height);
        
        // Copy data from RawImage to ImageData
        // RawImage.data is Uint8Array with grayscale values
        for (let i = 0; i < rawImage.data.length; i++) {
          const pixelIndex = i * 4;
          const grayValue = rawImage.data[i];
          
          // Set RGB to same grayscale value, alpha to 255
          imageData.data[pixelIndex] = grayValue;     // R
          imageData.data[pixelIndex + 1] = grayValue; // G
          imageData.data[pixelIndex + 2] = grayValue; // B
          imageData.data[pixelIndex + 3] = 255;       // A
        }
        
        // Put the image data on canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Convert canvas to image element
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = canvas.toDataURL();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if the depth detector is ready to use
   */
  isReady() {
    return this.isInitialized && !this.isLoading;
  }

  /**
   * Check if the depth detector is currently loading
   */
  isModelLoading() {
    return this.isLoading;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.depthEstimator = null;
    this.isInitialized = false;
    this.isLoading = false;
  }
}