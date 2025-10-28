import gui from "./gui.js";
import { getDefaultParameters, GUI_CONFIG } from "./modules/config.js";
import {
  drawImageCover,
  drawImageContain,
  calculatePositionBounds,
  calculateMinZoom,
  calculateCoverDimensions,
} from "./modules/image-processor.js";

let params = getDefaultParameters();

export default function sketch(p) {
  let loadedImage = null;
  let canvasElement = null;
  let buffer = null;
  let imgLayer = null;
  let display = null;

  let showCursorPreview = false;
  let cursorX = 0;
  let cursorY = 0;

  let cutSlots = [null, null, null, null, null, null];
  let selectedCutSlot = 0;
  let cuts = [];
  let activeCutIndex = null;

  let rotationTransitionStart = null;
  let rotationTransitionDuration = 1000;
  let showGuideCircle = true;

  let patternImg = null;
  let lastPatternPosX = null;
  let lastPatternPosY = null;
  let lastPatternZoom = null;

  let lastCutSize = null;
  let lastSliceAmount = null;
  let lastRotationAmount = null;
  let lastRotationMethod = null;
  let lastDisplayPosX = null;
  let lastDisplayPosY = null;
  let lastDisplayZoom = null;

  let cutCaches = [null, null, null, null, null, null];
  let cutCacheParams = [null, null, null, null, null, null];
  let previousActiveCutSlot = null;

  let bg = 0;
  let size = 500;
  let slice = 50;
  let rotAmt = 10;
  let speed = 0.004;
  let fps = 60;

  p.setup = function () {
    const canvas = p.createCanvas(params.canvasWidth, params.canvasHeight);
    canvas.parent("canvas-container");
    canvasElement = canvas.elt;
    p.background(0);

    buffer = p.createGraphics(p.width, p.height);
    imgLayer = p.createGraphics(p.width, p.height);
    display = p.createGraphics(p.width, p.height);

    scaleCanvasToFit();

    gui.connectSketch({
      onImageLoaded: handleImageLoaded,
      onParameterChange: handleParameterChange,
      saveCanvas: handleSave,
      resetImage: handleReset,
      removeActiveCut: removeActiveCut,
      getCutsInfo: getCutsInfo,
      hasActiveCut: hasActiveCut,
      getCutIndices: getCutIndices,
      selectCutSlot: selectCutSlot,
    });

    window.addEventListener("resize", scaleCanvasToFit);

    console.log("p5.js (instance mode) sketch ready");
  };

  p.draw = function () {
    if ((p.key === "h" || p.key === "H") && p.keyIsPressed) {
      showGuideCircle = !showGuideCircle;
      p.key = "";
    }

    p.background(0);

    if (loadedImage) {
      const isAnimatedMode =
        params.animated !== undefined ? params.animated : true;
      const hasSlices = cuts.length > 0;

      const ringParametersChanged =
        lastCutSize !== params.cutSize ||
        lastSliceAmount !== params.sliceAmount ||
        lastRotationAmount !== params.rotationAmount ||
        lastRotationMethod !== params.rotationMethod;

      const imageTransformChanged =
        lastDisplayPosX !== params.imagePosX ||
        lastDisplayPosY !== params.imagePosY ||
        lastDisplayZoom !== params.imageZoom;

      if (
        !isAnimatedMode &&
        hasSlices &&
        rotationTransitionStart === null &&
        !ringParametersChanged &&
        !imageTransformChanged
      ) {
        const posBounds = calculatePositionBounds(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height,
          params.imageZoom
        );

        const posX = Math.max(
          posBounds.minX,
          Math.min(posBounds.maxX, params.imagePosX || 0)
        );
        const posY = Math.max(
          posBounds.minY,
          Math.min(posBounds.maxY, params.imagePosY || 0)
        );

        drawImageCover(
          p,
          loadedImage,
          p.width,
          p.height,
          posX,
          posY,
          params.imageZoom
        );

        p.imageMode(p.CORNER);
        p.image(display, 0, 0, p.width, p.height);

        if (showCursorPreview) {
          const coverDims = calculateCoverDimensions(
            loadedImage.width,
            loadedImage.height,
            p.width,
            p.height
          );

          const posBounds = calculatePositionBounds(
            loadedImage.width,
            loadedImage.height,
            p.width,
            p.height,
            params.imageZoom
          );

          const posX = Math.max(
            posBounds.minX,
            Math.min(posBounds.maxX, params.imagePosX || 0)
          );
          const posY = Math.max(
            posBounds.minY,
            Math.min(posBounds.maxY, params.imagePosY || 0)
          );

          const zoomedImageWidth = coverDims.width * params.imageZoom;
          const zoomedImageHeight = coverDims.height * params.imageZoom;

          const imageCenterX = p.width / 2 + posX;
          const imageCenterY = p.height / 2 + posY;

          const imageLeft = imageCenterX - zoomedImageWidth / 2;
          const imageRight = imageCenterX + zoomedImageWidth / 2;
          const imageTop = imageCenterY - zoomedImageHeight / 2;
          const imageBottom = imageCenterY + zoomedImageHeight / 2;

          const previewCutParams = gui.getParametersForSlot(selectedCutSlot);
          let previewCutSize = Math.max(1, previewCutParams.cutSize || 300);
          const maxAllowedDiameter = Math.min(
            zoomedImageWidth,
            zoomedImageHeight
          );
          if (previewCutSize > maxAllowedDiameter) {
            previewCutSize = maxAllowedDiameter;
          }

          const previewSliceAmount = Math.max(
            1,
            Math.floor(previewCutParams.sliceAmount || 10)
          );
          const ringThickness = previewCutSize / previewSliceAmount;
          const adjustedPreviewSize = previewCutSize - ringThickness;

          const cutSizeRadius = adjustedPreviewSize / 2;

          const clampedCursorX = Math.max(
            imageLeft + cutSizeRadius,
            Math.min(imageRight - cutSizeRadius, cursorX)
          );
          const clampedCursorY = Math.max(
            imageTop + cutSizeRadius,
            Math.min(imageBottom - cutSizeRadius, cursorY)
          );

          if (showGuideCircle) {
            p.stroke(255, 0, 0);
            p.strokeWeight(1);
            p.noFill();
            p.ellipse(
              clampedCursorX,
              clampedCursorY,
              adjustedPreviewSize,
              adjustedPreviewSize
            );
          }
        }
        return;
      }

      const posBounds = calculatePositionBounds(
        loadedImage.width,
        loadedImage.height,
        p.width,
        p.height,
        params.imageZoom
      );

      const posX = Math.max(
        posBounds.minX,
        Math.min(posBounds.maxX, params.imagePosX || 0)
      );
      const posY = Math.max(
        posBounds.minY,
        Math.min(posBounds.maxY, params.imagePosY || 0)
      );

      drawImageCover(
        p,
        loadedImage,
        p.width,
        p.height,
        posX,
        posY,
        params.imageZoom
      );

      const needsPatternUpdate =
        lastPatternPosX !== posX ||
        lastPatternPosY !== posY ||
        lastPatternZoom !== params.imageZoom;

      if (needsPatternUpdate) {
        imgLayer.clear();
        drawImageCover(
          imgLayer,
          loadedImage,
          imgLayer.width,
          imgLayer.height,
          posX,
          posY,
          params.imageZoom
        );

        patternImg = imgLayer.get();

        lastPatternPosX = posX;
        lastPatternPosY = posY;
        lastPatternZoom = params.imageZoom;
      }

      display.clear();

      const angle = p.map(p.sin(p.frameCount * speed), -1, 1, -rotAmt, rotAmt);

      const selectedCutParams = gui.getParametersForSlot(selectedCutSlot);
      let cutSize = Math.max(1, selectedCutParams.cutSize || 300);
      const sliceAmount = Math.max(
        1,
        Math.floor(selectedCutParams.sliceAmount || 10)
      );

      if (loadedImage) {
        const coverDims = calculateCoverDimensions(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height
        );

        const zoomedImageWidth = coverDims.width * params.imageZoom;
        const zoomedImageHeight = coverDims.height * params.imageZoom;

        const maxAllowedDiameter = Math.min(
          zoomedImageWidth,
          zoomedImageHeight
        );
        if (cutSize > maxAllowedDiameter) {
          cutSize = maxAllowedDiameter;
        }
      }

      const ringThickness = cutSize / sliceAmount;

      if (cuts.length > 0) {
        const coverDims = calculateCoverDimensions(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height
        );

        const zoomedImageWidth = coverDims.width * params.imageZoom;
        const zoomedImageHeight = coverDims.height * params.imageZoom;

        const imageCenterX = p.width / 2 + posX;
        const imageCenterY = p.height / 2 + posY;

        const imageLeft = imageCenterX - zoomedImageWidth / 2;
        const imageRight = imageCenterX + zoomedImageWidth / 2;
        const imageTop = imageCenterY - zoomedImageHeight / 2;
        const imageBottom = imageCenterY + zoomedImageHeight / 2;

        const rotationAmount =
          params.rotationAmount !== undefined ? params.rotationAmount : rotAmt;
        const rotationSpeed = params.rotationSpeed || speed;
        const isAnimated =
          params.animated !== undefined ? params.animated : true;

        const frameRate = 60;
        const cycleDuration =
          ((Math.PI * 2) / Math.max(rotationSpeed, 0.0001) / frameRate) * 1000;
        rotationTransitionDuration = Math.max(500, cycleDuration * 0.05);

        let rotationProgress = 1.0;
        if (rotationTransitionStart !== null) {
          const elapsed = p.millis() - rotationTransitionStart;
          rotationProgress = Math.min(
            elapsed / rotationTransitionDuration,
            1.0
          );
          if (rotationProgress >= 1.0) {
            rotationTransitionStart = null;
          }
        }

        if (selectedCutSlot !== previousActiveCutSlot) {
          cutCaches[selectedCutSlot] = null;
          previousActiveCutSlot = selectedCutSlot;
        }

        for (let cutIdx = 0; cutIdx < cuts.length; cutIdx++) {
          const cut = cuts[cutIdx];
          const isActiveCut = cut.slotIndex === selectedCutSlot;
          const slotIndex = cut.slotIndex;

          const cutParams = gui.getParametersForSlot(slotIndex);

          let cutSize = Math.max(1, cutParams.cutSize || 300);
          const cutSliceAmount = Math.max(
            1,
            Math.floor(cutParams.sliceAmount || 10)
          );

          if (loadedImage) {
            const maxAllowedDiameter = Math.min(
              zoomedImageWidth,
              zoomedImageHeight
            );
            if (cutSize > maxAllowedDiameter) {
              cutSize = maxAllowedDiameter;
            }
          }

          const maxDiameter = cutSize;
          const maxRadius = maxDiameter / 2;

          const canvasSpaceX = imageCenterX + cut.centerX * params.imageZoom;
          const canvasSpaceY = imageCenterY + cut.centerY * params.imageZoom;

          const clampedCenterX = Math.max(
            imageLeft + maxRadius,
            Math.min(imageRight - maxRadius, canvasSpaceX)
          );
          const clampedCenterY = Math.max(
            imageTop + maxRadius,
            Math.min(imageBottom - maxRadius, canvasSpaceY)
          );

          if (isActiveCut) {
            renderCutSlices(
              clampedCenterX,
              clampedCenterY,
              maxDiameter,
              cutSliceAmount,
              cutSize,
              cutParams.rotationAmount,
              cutParams.rotationSpeed,
              cutParams.animated,
              rotationProgress,
              true,
              cutParams
            );
          } else {
            const cacheKey = {
              centerX: clampedCenterX,
              centerY: clampedCenterY,
              maxDiameter,
              cutSliceAmount,
              cutSize,
              rotationAmount: cutParams.rotationAmount,
              rotationSpeed: cutParams.rotationSpeed,
              animated: cutParams.animated,
              rotationMethod: cutParams.rotationMethod,
            };

            const needsCacheUpdate =
              !cutCaches[slotIndex] ||
              !cutCacheParams[slotIndex] ||
              JSON.stringify(cutCacheParams[slotIndex]) !==
                JSON.stringify(cacheKey);

            if (needsCacheUpdate) {
              renderCutSlicesToBuffer(
                cutCaches,
                slotIndex,
                clampedCenterX,
                clampedCenterY,
                maxDiameter,
                cutSliceAmount,
                cutSize,
                cutParams.rotationAmount,
                cutParams.rotationSpeed,
                cutParams.animated,
                1.0,
                cutParams
              );
              cutCacheParams[slotIndex] = cacheKey;
            }

            if (cutCaches[slotIndex]) {
              display.image(cutCaches[slotIndex], 0, 0);
            }
          }
        }
      }

      lastCutSize = params.cutSize;
      lastSliceAmount = params.sliceAmount;
      lastRotationAmount = params.rotationAmount;
      lastRotationMethod = params.rotationMethod;

      lastDisplayPosX = params.imagePosX;
      lastDisplayPosY = params.imagePosY;
      lastDisplayZoom = params.imageZoom;

      p.imageMode(p.CORNER);
      p.image(display, 0, 0, p.width, p.height);

      if (showCursorPreview) {
        const coverDims = calculateCoverDimensions(
          loadedImage.width,
          loadedImage.height,
          p.width,
          p.height
        );

        const zoomedImageWidth = coverDims.width * params.imageZoom;
        const zoomedImageHeight = coverDims.height * params.imageZoom;

        const imageCenterX = p.width / 2 + posX;
        const imageCenterY = p.height / 2 + posY;

        const imageLeft = imageCenterX - zoomedImageWidth / 2;
        const imageRight = imageCenterX + zoomedImageWidth / 2;
        const imageTop = imageCenterY - zoomedImageHeight / 2;
        const imageBottom = imageCenterY + zoomedImageHeight / 2;

        const previewCutParams2 = gui.getParametersForSlot(selectedCutSlot);
        let previewCutSize = Math.max(1, previewCutParams2.cutSize || 300);
        const maxAllowedDiameter = Math.min(
          zoomedImageWidth,
          zoomedImageHeight
        );
        if (previewCutSize > maxAllowedDiameter) {
          previewCutSize = maxAllowedDiameter;
        }

        const sliceAmount = Math.max(
          1,
          Math.floor(previewCutParams2.sliceAmount || 10)
        );
        const ringThickness = previewCutSize / sliceAmount;
        const adjustedPreviewSize = previewCutSize - ringThickness;

        const maxRadius = adjustedPreviewSize / 2;

        const clampedCursorX = Math.max(
          imageLeft + maxRadius,
          Math.min(imageRight - maxRadius, cursorX)
        );
        const clampedCursorY = Math.max(
          imageTop + maxRadius,
          Math.min(imageBottom - maxRadius, cursorY)
        );

        if (showGuideCircle) {
          p.stroke(255, 0, 0);
          p.strokeWeight(1);
          p.noFill();
          p.ellipse(
            clampedCursorX,
            clampedCursorY,
            adjustedPreviewSize,
            adjustedPreviewSize
          );
        }
      }
    } else {
      p.fill(255);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.text("Upload an image to begin", p.width / 2, p.height / 2);
    }
  };

  p.mouseMoved = function () {
    if (loadedImage) {
      if (
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height
      ) {
        cursorX = p.mouseX;
        cursorY = p.mouseY;
        showCursorPreview = true;
      } else {
        showCursorPreview = false;
      }
    }
  };

  p.mousePressed = function () {
    const canvasRect = canvasElement.getBoundingClientRect();
    const pageX = canvasRect.left + p.mouseX;
    const pageY = canvasRect.top + p.mouseY;

    const clickTarget = document.elementFromPoint(pageX, pageY);

    if (clickTarget) {
      if (
        clickTarget.tagName === "INPUT" ||
        clickTarget.tagName === "BUTTON" ||
        clickTarget.tagName === "LABEL" ||
        clickTarget.tagName === "SELECT"
      ) {
        return;
      }

      if (clickTarget.closest("input, button, label, select, textarea")) {
        return;
      }

      if (
        clickTarget.closest("#gui-container") ||
        clickTarget.closest("#gui-panel") ||
        clickTarget.closest("#controls-section")
      ) {
        return;
      }

      if (
        clickTarget.closest(".switch") ||
        clickTarget.closest(".range-container")
      ) {
        return;
      }
    }

    const guiPanel = document.getElementById("gui-panel");
    if (guiPanel && guiPanel.classList.contains("open")) {
      const guiRect = guiPanel.getBoundingClientRect();
      if (
        pageX >= guiRect.left &&
        pageX <= guiRect.right &&
        pageY >= guiRect.top &&
        pageY <= guiRect.bottom
      ) {
        return;
      }
    }

    const guiToggle = document.getElementById("gui-toggle");
    if (guiToggle) {
      const toggleRect = guiToggle.getBoundingClientRect();
      if (
        pageX >= toggleRect.left &&
        pageX <= toggleRect.right &&
        pageY >= toggleRect.top &&
        pageY <= toggleRect.bottom
      ) {
        return;
      }
    }

    if (
      loadedImage &&
      p.mouseX >= 0 &&
      p.mouseX <= p.width &&
      p.mouseY >= 0 &&
      p.mouseY <= p.height
    ) {
      const posBounds = calculatePositionBounds(
        loadedImage.width,
        loadedImage.height,
        p.width,
        p.height,
        params.imageZoom
      );

      const posX = Math.max(
        posBounds.minX,
        Math.min(posBounds.maxX, params.imagePosX || 0)
      );
      const posY = Math.max(
        posBounds.minY,
        Math.min(posBounds.maxY, params.imagePosY || 0)
      );

      const coverDims = calculateCoverDimensions(
        loadedImage.width,
        loadedImage.height,
        p.width,
        p.height
      );

      const zoomedImageWidth = coverDims.width * params.imageZoom;
      const zoomedImageHeight = coverDims.height * params.imageZoom;

      const imageCenterX = p.width / 2 + posX;
      const imageCenterY = p.height / 2 + posY;

      const imageLeft = imageCenterX - zoomedImageWidth / 2;
      const imageRight = imageCenterX + zoomedImageWidth / 2;
      const imageTop = imageCenterY - zoomedImageHeight / 2;
      const imageBottom = imageCenterY + zoomedImageHeight / 2;

      const selectedCutParamsForClick =
        gui.getParametersForSlot(selectedCutSlot);
      const cutSizeRadius = selectedCutParamsForClick.cutSize / 2;

      const clampedClickX = Math.max(
        imageLeft + cutSizeRadius,
        Math.min(imageRight - cutSizeRadius, p.mouseX)
      );
      const clampedClickY = Math.max(
        imageTop + cutSizeRadius,
        Math.min(imageBottom - cutSizeRadius, p.mouseY)
      );

      const imageSpaceX = (clampedClickX - imageCenterX) / params.imageZoom;
      const imageSpaceY = (clampedClickY - imageCenterY) / params.imageZoom;

      placeCutInSlot(selectedCutSlot, imageSpaceX, imageSpaceY);
      console.log(`Cut placed in slot ${selectedCutSlot}`);

      rotationTransitionStart = p.millis();
      showCursorPreview = false;
      return false;
    }
  };

  function scaleCanvasToFit() {
    if (!canvasElement) return;

    const container = document.getElementById("canvas-container");

    if (container) container.style.padding = "10px";

    const margin = 20;
    const maxWidth = window.innerWidth - margin;
    const maxHeight = window.innerHeight - margin;

    const canvasAspect = params.canvasWidth / params.canvasHeight;
    const windowAspect = maxWidth / maxHeight;

    let scale;
    if (canvasAspect > windowAspect) {
      scale = maxWidth / params.canvasWidth;
    } else {
      scale = maxHeight / params.canvasHeight;
    }

    scale = Math.min(scale, 1);

    canvasElement.style.width = `${params.canvasWidth * scale}px`;
    canvasElement.style.height = `${params.canvasHeight * scale}px`;
  }

  function renderCutSlicesToBuffer(
    cutCachesArray,
    slotIndex,
    centerX,
    centerY,
    maxDiameter,
    sliceAmount,
    cutSize,
    rotationAmount,
    rotationSpeed,
    isAnimated,
    rotationProgress,
    cutParams = params
  ) {
    if (!cutCachesArray[slotIndex]) {
      cutCachesArray[slotIndex] = p.createGraphics(p.width, p.height);
    }

    const cachedLayer = cutCachesArray[slotIndex];
    cachedLayer.clear();

    const ringThickness = cutSize / sliceAmount;

    if (rotationAmount === 0) return;

    for (let i = 0; i < sliceAmount; i++) {
      const currentSize = maxDiameter - i * ringThickness;

      const lerpedRotationAmount = rotationAmount * rotationProgress;
      const rotationMethod = cutParams.rotationMethod || "incremental";

      let currentRotation;
      if (isAnimated) {
        const animatedValue = p.map(
          p.sin(p.frameCount * rotationSpeed),
          -1,
          1,
          -lerpedRotationAmount,
          lerpedRotationAmount
        );

        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount =
            lerpedRotationAmount *
            Math.sin(p.frameCount * rotationSpeed + phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(animatedValue * i);
        }
      } else {
        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount = lerpedRotationAmount * Math.sin(phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(lerpedRotationAmount * i);
        }
      }

      const sw = Math.max(1, Math.ceil(currentSize));
      const sh = Math.max(1, Math.ceil(currentSize));

      const bufferScale = 2;
      const bufferW = Math.ceil(sw * bufferScale);
      const bufferH = Math.ceil(sh * bufferScale);

      const localCenterX = centerX - (p.width / 2 - imgLayer.width / 2);
      const localCenterY = centerY - (p.height / 2 - imgLayer.height / 2);

      const sx = Math.max(
        0,
        Math.min(patternImg.width - sw, localCenterX - sw / 2)
      );
      const sy = Math.max(
        0,
        Math.min(patternImg.height - sh, localCenterY - sh / 2)
      );

      if (!buffer || buffer.width !== bufferW || buffer.height !== bufferH) {
        if (buffer) buffer.remove();
        buffer = p.createGraphics(bufferW, bufferH);
      }

      buffer.clear();
      buffer.push();
      buffer.drawingContext.save();
      buffer.drawingContext.beginPath();
      buffer.drawingContext.ellipse(
        bufferW / 2,
        bufferH / 2,
        bufferW / 2,
        bufferH / 2,
        0,
        0,
        Math.PI * 2
      );
      buffer.drawingContext.clip();
      buffer.image(patternImg, 0, 0, bufferW, bufferH, sx, sy, sw, sh);
      buffer.drawingContext.restore();
      buffer.pop();

      cachedLayer.push();
      cachedLayer.imageMode(cachedLayer.CENTER);
      cachedLayer.translate(centerX, centerY);
      cachedLayer.rotate(currentRotation);
      cachedLayer.image(buffer, 0, 0, sw, sh);
      cachedLayer.pop();
    }
  }

  function renderCutSlices(
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
    cutParams = params
  ) {
    const ringThickness = cutSize / sliceAmount;

    if (rotationAmount === 0) return;

    for (let i = 0; i < sliceAmount; i++) {
      const currentSize = maxDiameter - i * ringThickness;

      const lerpedRotationAmount = rotationAmount * rotationProgress;
      const rotationMethod = cutParams.rotationMethod || "incremental";

      let currentRotation;
      if (isAnimated) {
        const animatedValue = p.map(
          p.sin(p.frameCount * rotationSpeed),
          -1,
          1,
          -lerpedRotationAmount,
          lerpedRotationAmount
        );

        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount =
            lerpedRotationAmount *
            Math.sin(p.frameCount * rotationSpeed + phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(animatedValue * i);
        }
      } else {
        if (rotationMethod === "wave") {
          const waveFrequency = 3;
          const phaseOffset = (i / sliceAmount) * Math.PI * 2 * waveFrequency;
          const waveAmount = lerpedRotationAmount * Math.sin(phaseOffset);
          currentRotation = p.radians(waveAmount);
        } else {
          currentRotation = p.radians(lerpedRotationAmount * i);
        }
      }

      const sw = Math.max(1, Math.ceil(currentSize));
      const sh = Math.max(1, Math.ceil(currentSize));

      const bufferScale = 2;
      const bufferW = Math.ceil(sw * bufferScale);
      const bufferH = Math.ceil(sh * bufferScale);

      const localCenterX = centerX - (p.width / 2 - imgLayer.width / 2);
      const localCenterY = centerY - (p.height / 2 - imgLayer.height / 2);

      const sx = Math.max(
        0,
        Math.min(patternImg.width - sw, localCenterX - sw / 2)
      );
      const sy = Math.max(
        0,
        Math.min(patternImg.height - sh, localCenterY - sh / 2)
      );

      if (!buffer || buffer.width !== bufferW || buffer.height !== bufferH) {
        if (buffer) buffer.remove();
        buffer = p.createGraphics(bufferW, bufferH);
      }

      buffer.clear();
      buffer.push();
      buffer.drawingContext.save();
      buffer.drawingContext.beginPath();
      buffer.drawingContext.ellipse(
        bufferW / 2,
        bufferH / 2,
        bufferW / 2,
        bufferH / 2,
        0,
        0,
        Math.PI * 2
      );
      buffer.drawingContext.clip();
      buffer.image(patternImg, 0, 0, bufferW, bufferH, sx, sy, sw, sh);
      buffer.drawingContext.restore();
      buffer.pop();

      display.push();
      display.imageMode(display.CENTER);
      display.translate(centerX, centerY);
      display.rotate(currentRotation);
      display.image(buffer, 0, 0, sw, sh);
      display.pop();
    }
  }

  function placeCutInSlot(slotIndex, centerX, centerY) {
    if (slotIndex < 0 || slotIndex >= 6) return;

    cutSlots[slotIndex] = {
      centerX: centerX,
      centerY: centerY,
    };

    selectedCutSlot = slotIndex;
    updateCutsArray();
    console.log(`Placed cut in slot ${slotIndex}`);
  }

  function updateCutsArray() {
    cuts = [];
    cutSlots.forEach((cut, slotIndex) => {
      if (cut !== null) {
        cuts.push({
          ...cut,
          slotIndex: slotIndex,
        });
      }
    });
  }

  function selectCutSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      if (slotIndex !== selectedCutSlot) {
        rotationTransitionStart = p.millis();

        cutCaches[slotIndex] = null;
        cutCacheParams[slotIndex] = null;
      }

      selectedCutSlot = slotIndex;

      lastCutSize = null;
      lastSliceAmount = null;
      lastRotationAmount = null;
      lastRotationMethod = null;
      lastDisplayPosX = null;
      lastDisplayPosY = null;
      lastDisplayZoom = null;
      lastPatternPosX = null;
      lastPatternPosY = null;
      lastPatternZoom = null;
      patternImg = null;

      console.log(`Selected cut slot ${slotIndex}`);
    }
  }

  function clearCutSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      cutSlots[slotIndex] = null;
      updateCutsArray();
    }
  }

  function clearAllCuts() {
    cutSlots = [null, null, null, null, null, null];
    cuts = [];
    selectedCutSlot = 0;
  }

  function addCut(centerX, centerY) {
    if (cuts.length >= 6) {
      console.warn("Maximum of 6 cuts reached");
      return null;
    }
    const newCut = {
      id: nextCutId++,
      centerX: centerX,
      centerY: centerY,
    };
    cuts.push(newCut);
    activeCutIndex = cuts.length - 1;
    console.log(`Cut added at (${centerX}, ${centerY}), ID: ${newCut.id}`);
    return activeCutIndex;
  }

  function removeActiveCut() {
    if (activeCutIndex === null || cuts.length === 0) {
      console.warn("No active cut to remove");
      return;
    }
    const removedCut = cuts[activeCutIndex];
    cuts.splice(activeCutIndex, 1);

    if (cuts.length === 0) {
      activeCutIndex = null;
    } else if (activeCutIndex >= cuts.length) {
      activeCutIndex = cuts.length - 1;
    }
    console.log(`Cut removed, ID: ${removedCut.id}`);
  }

  function selectCut(index) {
    if (index >= 0 && index < cuts.length) {
      activeCutIndex = index;
    }
  }

  function findNearestCut(x, y, tolerance = 20) {
    for (let i = 0; i < cuts.length; i++) {
      const dx = cuts[i].centerX - x;
      const dy = cuts[i].centerY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= tolerance) {
        return i;
      }
    }
    return -1;
  }

  function getCutsInfo() {
    if (cuts.length === 0) {
      return "No cuts yet. Click on the image to add one.";
    } else if (activeCutIndex === null) {
      return `${cuts.length} cut${
        cuts.length !== 1 ? "s" : ""
      } placed. Click to select.`;
    } else {
      return `${cuts.length} cut${cuts.length !== 1 ? "s" : ""} placed. Cut ${
        activeCutIndex + 1
      } selected.`;
    }
  }

  function getCutIndices() {
    const usedIndices = [];
    cutSlots.forEach((cut, slotIndex) => {
      if (cut !== null) {
        usedIndices.push(slotIndex);
      }
    });
    return usedIndices;
  }

  function hasActiveCut() {
    return activeCutIndex !== null && cuts.length > 0;
  }

  function handleImageLoaded(imageDataUrl) {
    p.loadImage(imageDataUrl, (img) => {
      loadedImage = img;
      console.log("Image loaded:", img.width, "x", img.height);

      patternImg = null;
      lastPatternPosX = null;
      lastPatternPosY = null;
      lastPatternZoom = null;

      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
      previousActiveCutSlot = null;

      display.clear();
      lastCutSize = null;
      lastSliceAmount = null;
      lastRotationAmount = null;
      lastRotationMethod = null;
      lastDisplayPosX = null;
      lastDisplayPosY = null;
      lastDisplayZoom = null;

      cutSlots = [null, null, null, null, null, null];
      cuts = [];
      selectedCutSlot = 0;
      activeCutIndex = null;
      rotationTransitionStart = null;

      updateZoomSliderBounds();
      updatePositionSliderBounds();
      updateCutSizeSliderBounds();
    });
  }

  function updateZoomSliderBounds() {
    if (!loadedImage) return;

    const minZoom = calculateMinZoom(
      loadedImage.width,
      loadedImage.height,
      params.canvasWidth,
      params.canvasHeight
    );

    gui.updateSliderBounds("imageZoom", minZoom, 3.0);
    gui.updateParameterValue("imageZoom", 1.0);

    console.log(`Zoom bounds updated: min=${minZoom.toFixed(3)}, max=3.0`);
  }

  function updatePositionSliderBounds() {
    if (!loadedImage) return;

    const bounds = calculatePositionBounds(
      loadedImage.width,
      loadedImage.height,
      params.canvasWidth,
      params.canvasHeight,
      params.imageZoom
    );

    gui.updateSliderBounds("imagePosX", bounds.minX, bounds.maxX);
    gui.updateSliderBounds("imagePosY", bounds.minY, bounds.maxY);

    gui.updateParameterValue("imagePosX", 0);
    gui.updateParameterValue("imagePosY", 0);
  }

  function updateCutSizeSliderBounds() {
    if (!loadedImage) return;

    const coverDims = calculateCoverDimensions(
      loadedImage.width,
      loadedImage.height,
      params.canvasWidth,
      params.canvasHeight
    );

    const zoomedImageWidth = coverDims.width * params.imageZoom;
    const zoomedImageHeight = coverDims.height * params.imageZoom;

    const maxDiameter = Math.min(zoomedImageWidth, zoomedImageHeight);

    gui.updateSliderBounds("cutSize", 100, maxDiameter);

    console.log(`Cut size bounds updated: max=${maxDiameter.toFixed(1)}`);
  }

  function handleParameterChange(paramName, value, allParameters) {
    params = allParameters;
    if (paramName === "canvasWidth" || paramName === "canvasHeight") {
      p.resizeCanvas(params.canvasWidth, params.canvasHeight);
      scaleCanvasToFit();

      buffer = p.createGraphics(params.canvasWidth, params.canvasHeight);
      imgLayer = p.createGraphics(params.canvasWidth, params.canvasHeight);
      display = p.createGraphics(params.canvasWidth, params.canvasHeight);

      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
      previousActiveCutSlot = null;

      lastPatternPosX = null;
      lastPatternPosY = null;
      lastPatternZoom = null;

      updateZoomSliderBounds();
      updatePositionSliderBounds();
      updateCutSizeSliderBounds();
    }

    if (paramName === "imageZoom") {
      updatePositionSliderBounds();
      updateCutSizeSliderBounds();
      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
    }

    if (paramName === "imagePosX" || paramName === "imagePosY") {
      cutCaches = [null, null, null, null, null, null];
      cutCacheParams = [null, null, null, null, null, null];
    }

    if (
      paramName === "cutSize" ||
      paramName === "sliceAmount" ||
      paramName === "rotationAmount" ||
      paramName === "rotationSpeed" ||
      paramName === "rotationMethod" ||
      paramName === "animated"
    ) {
      for (let i = 0; i < 6; i++) {
        if (i !== selectedCutSlot) {
          cutCaches[i] = null;
          cutCacheParams[i] = null;
        }
      }
    }

    if (paramName === "rotationMethod") {
      rotationTransitionStart = p.millis();
    }
  }

  function handleSave() {
    const guideCircleWasVisible = showGuideCircle;
    showGuideCircle = false;

    p.draw();

    p.saveCanvas("output", "png");
    console.log("Canvas saved");

    showGuideCircle = guideCircleWasVisible;
  }

  function handleReset() {
    clearAllCuts();

    params.imagePosX = 0;
    params.imagePosY = 0;
    params.imageZoom = 1;

    lastCutSize = null;
    lastSliceAmount = null;
    lastRotationAmount = null;
    lastRotationMethod = null;
    lastDisplayPosX = null;
    lastDisplayPosY = null;
    lastDisplayZoom = null;
    lastPatternPosX = null;
    lastPatternPosY = null;
    lastPatternZoom = null;
    patternImg = null;

    if (display) display.clear();
    if (buffer) buffer.clear();
    if (imgLayer) imgLayer.clear();

    rotationTransitionStart = null;

    if (gui && gui.updateParameterValue) {
      setTimeout(() => {
        gui.updateParameterValue("imagePosX", 0);
        gui.updateParameterValue("imagePosY", 0);
        gui.updateParameterValue("imageZoom", 1);
      }, 0);
    }

    console.log("Image reset to initial state - all cuts cleared");
  }

  p.mouseWheel = function (event) {
    if (
      p.mouseX < 0 ||
      p.mouseX > p.width ||
      p.mouseY < 0 ||
      p.mouseY > p.height
    ) {
      return;
    }

    const scrollSensitivity = 10;
    const delta = event.deltaY > 0 ? scrollSensitivity : -scrollSensitivity;

    const currentCutSize = gui.parameters.cutSize || 300;
    const config = GUI_CONFIG.cutSize || {};

    let newCutSize = currentCutSize - delta;
    newCutSize = Math.max(
      config.min || 100,
      Math.min(config.max || 1920, newCutSize)
    );

    gui.updateParameterValue("cutSize", newCutSize);

    return false;
  };

  function getDebugInfo() {
    return {
      selectedCutSlot,
      cutSlots: cutSlots.map((cut, idx) => ({
        slotIndex: idx,
        hasCut: cut !== null,
        cut: cut,
      })),
      currentParameters: { ...params },
      activeCuts: cuts.length,
    };
  }

  function logCutParameterState() {
    console.log("=== CUT PARAMETER STATE ===");
    console.log("Selected Slot:", selectedCutSlot);
    cutSlots.forEach((cut, idx) => {
      if (cut !== null) {
        console.log(`Slot ${idx}:`, {
          center: { x: cut.centerX, y: cut.centerY },
        });
      } else {
        console.log(`Slot ${idx}: [empty]`);
      }
    });
    console.log("Current Global Params:", params);
    console.log("===========================");
  }

  window.cinetiserDebug = {
    getDebugInfo,
    logCutParameterState,
    getCutSlots: () => cutSlots,
    getSelectedSlot: () => selectedCutSlot,
    getParams: () => params,
    getCutParametersMap: () =>
      window.gui ? window.gui.cutParametersMap : null,
    getCurrentCutIndex: () => (window.gui ? window.gui.currentCutIndex : null),
  };
}

if (typeof window !== "undefined" && window.p5) {
  new window.p5(sketch);
}
