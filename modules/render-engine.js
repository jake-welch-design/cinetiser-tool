/**
 * Render Engine Module
 * Handles all cut rendering operations including active cuts and cached inactive cuts
 */

export class RenderEngine {
  constructor(p) {
    this.p = p;
    this.buffer = null;
  }

  /**
   * Renders cut slices directly to the display layer (for active cuts with animation)
   */
  renderCutSlices(
    display,
    patternImg,
    imgLayer,
    centerX,
    centerY,
    maxDiameter,
    sliceAmount,
    cutSize,
    rotationAmount,
    rotationSpeed,
    isAnimated,
    rotationProgress,
    isActiveCut,
    cutParams
  ) {
    const ringThickness = cutSize / sliceAmount;

    if (rotationAmount === 0) return;

    for (let i = 0; i < sliceAmount; i++) {
      const currentSize = maxDiameter - i * ringThickness;

      const lerpedRotationAmount = rotationAmount * rotationProgress;
      const rotationMethod = cutParams.rotationMethod || "incremental";

      let currentRotation = this._calculateRotation(
        i,
        sliceAmount,
        lerpedRotationAmount,
        rotationSpeed,
        isAnimated,
        rotationMethod
      );

      const sw = Math.max(1, Math.ceil(currentSize));
      const sh = Math.max(1, Math.ceil(currentSize));

      const bufferScale = 2;
      const bufferW = Math.ceil(sw * bufferScale);
      const bufferH = Math.ceil(sh * bufferScale);

      const localCenterX = centerX - (this.p.width / 2 - imgLayer.width / 2);
      const localCenterY = centerY - (this.p.height / 2 - imgLayer.height / 2);

      const sx = Math.max(
        0,
        Math.min(patternImg.width - sw, localCenterX - sw / 2)
      );
      const sy = Math.max(
        0,
        Math.min(patternImg.height - sh, localCenterY - sh / 2)
      );

      // Create or resize buffer if needed
      if (!this.buffer || this.buffer.width !== bufferW || this.buffer.height !== bufferH) {
        if (this.buffer) this.buffer.remove();
        this.buffer = this.p.createGraphics(bufferW, bufferH);
      }

      // Render circular slice
      this.buffer.clear();
      this.buffer.push();
      this.buffer.drawingContext.save();
      this.buffer.drawingContext.beginPath();
      this.buffer.drawingContext.ellipse(
        bufferW / 2,
        bufferH / 2,
        bufferW / 2,
        bufferH / 2,
        0,
        0,
        Math.PI * 2
      );
      this.buffer.drawingContext.clip();
      this.buffer.image(patternImg, 0, 0, bufferW, bufferH, sx, sy, sw, sh);
      this.buffer.drawingContext.restore();
      this.buffer.pop();

      // Draw to display layer with rotation
      display.push();
      display.imageMode(display.CENTER);
      display.translate(centerX, centerY);
      display.rotate(currentRotation);
      display.image(this.buffer, 0, 0, sw, sh);
      display.pop();
    }

    this.p.redraw();
  }

  /**
   * Renders cut slices to a cached buffer (for inactive cuts)
   */
  renderCutSlicesToBuffer(
    cutCachesArray,
    slotIndex,
    patternImg,
    imgLayer,
    centerX,
    centerY,
    maxDiameter,
    sliceAmount,
    cutSize,
    rotationAmount,
    rotationSpeed,
    isAnimated,
    rotationProgress,
    cutParams
  ) {
    // Create cache graphics if it doesn't exist
    if (!cutCachesArray[slotIndex]) {
      cutCachesArray[slotIndex] = this.p.createGraphics(this.p.width, this.p.height);
    }

    const cachedLayer = cutCachesArray[slotIndex];
    cachedLayer.clear();

    const ringThickness = cutSize / sliceAmount;

    if (rotationAmount === 0) return;

    for (let i = 0; i < sliceAmount; i++) {
      const currentSize = maxDiameter - i * ringThickness;

      const lerpedRotationAmount = rotationAmount * rotationProgress;
      const rotationMethod = cutParams.rotationMethod || "incremental";

      let currentRotation = this._calculateRotation(
        i,
        sliceAmount,
        lerpedRotationAmount,
        rotationSpeed,
        isAnimated,
        rotationMethod
      );

      const sw = Math.max(1, Math.ceil(currentSize));
      const sh = Math.max(1, Math.ceil(currentSize));

      const bufferScale = 2;
      const bufferW = Math.ceil(sw * bufferScale);
      const bufferH = Math.ceil(sh * bufferScale);

      const localCenterX = centerX - (this.p.width / 2 - imgLayer.width / 2);
      const localCenterY = centerY - (this.p.height / 2 - imgLayer.height / 2);

      const sx = Math.max(
        0,
        Math.min(patternImg.width - sw, localCenterX - sw / 2)
      );
      const sy = Math.max(
        0,
        Math.min(patternImg.height - sh, localCenterY - sh / 2)
      );

      // Create or resize buffer if needed
      if (!this.buffer || this.buffer.width !== bufferW || this.buffer.height !== bufferH) {
        if (this.buffer) this.buffer.remove();
        this.buffer = this.p.createGraphics(bufferW, bufferH);
      }

      // Render circular slice
      this.buffer.clear();
      this.buffer.push();
      this.buffer.drawingContext.save();
      this.buffer.drawingContext.beginPath();
      this.buffer.drawingContext.ellipse(
        bufferW / 2,
        bufferH / 2,
        bufferW / 2,
        bufferH / 2,
        0,
        0,
        Math.PI * 2
      );
      this.buffer.drawingContext.clip();
      this.buffer.image(patternImg, 0, 0, bufferW, bufferH, sx, sy, sw, sh);
      this.buffer.drawingContext.restore();
      this.buffer.pop();

      // Draw to cached layer with rotation
      cachedLayer.push();
      cachedLayer.imageMode(cachedLayer.CENTER);
      cachedLayer.translate(centerX, centerY);
      cachedLayer.rotate(currentRotation);
      cachedLayer.image(this.buffer, 0, 0, sw, sh);
      cachedLayer.pop();
    }
  }

  /**
   * Calculates rotation based on animation method
   * @private
   */
  _calculateRotation(
    sliceIndex,
    totalSlices,
    lerpedRotationAmount,
    rotationSpeed,
    isAnimated,
    rotationMethod
  ) {
    if (isAnimated) {
      const animatedValue = this.p.map(
        this.p.sin(this.p.frameCount * rotationSpeed),
        -1,
        1,
        -lerpedRotationAmount,
        lerpedRotationAmount
      );

      if (rotationMethod === "wave") {
        const waveFrequency = 3;
        const phaseOffset = (sliceIndex / totalSlices) * Math.PI * 2 * waveFrequency;
        const waveAmount =
          lerpedRotationAmount *
          Math.sin(this.p.frameCount * rotationSpeed + phaseOffset);
        return this.p.radians(waveAmount);
      } else {
        return this.p.radians(animatedValue * sliceIndex);
      }
    } else {
      if (rotationMethod === "wave") {
        const waveFrequency = 3;
        const phaseOffset = (sliceIndex / totalSlices) * Math.PI * 2 * waveFrequency;
        const waveAmount = lerpedRotationAmount * Math.sin(phaseOffset);
        return this.p.radians(waveAmount);
      } else {
        return this.p.radians(lerpedRotationAmount * sliceIndex);
      }
    }
  }

  /**
   * Cleans up resources
   */
  dispose() {
    if (this.buffer) {
      this.buffer.remove();
      this.buffer = null;
    }
  }
}
