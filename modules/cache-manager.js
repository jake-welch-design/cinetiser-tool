/**
 * Cache Manager Module
 * Handles caching of inactive cut renderings for performance optimization
 */

export class CacheManager {
  constructor() {
    this.cutCaches = [null, null, null, null, null, null];
    this.cutCacheParams = [null, null, null, null, null, null];
    this.previousActiveCutSlot = null;
  }

  /**
   * Checks if a cache needs to be updated based on parameter changes
   */
  needsCacheUpdate(slotIndex, cacheKey) {
    return (
      !this.cutCaches[slotIndex] ||
      !this.cutCacheParams[slotIndex] ||
      JSON.stringify(this.cutCacheParams[slotIndex]) !==
        JSON.stringify(cacheKey)
    );
  }

  /**
   * Updates cache parameters for a specific slot
   */
  updateCacheParams(slotIndex, cacheKey) {
    this.cutCacheParams[slotIndex] = cacheKey;
  }

  /**
   * Creates a cache key from cut parameters
   */
  createCacheKey(
    centerX,
    centerY,
    maxDiameter,
    sliceAmount,
    cutSize,
    rotationAmount,
    rotationSpeed,
    animated,
    rotationMethod
  ) {
    return {
      centerX,
      centerY,
      maxDiameter,
      cutSliceAmount: sliceAmount,
      cutSize,
      rotationAmount,
      rotationSpeed,
      animated,
      rotationMethod,
    };
  }

  /**
   * Invalidates cache for a specific slot
   */
  invalidateSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      this.cutCaches[slotIndex] = null;
      this.cutCacheParams[slotIndex] = null;
    }
  }

  /**
   * Invalidates all caches
   */
  invalidateAll() {
    this.cutCaches = [null, null, null, null, null, null];
    this.cutCacheParams = [null, null, null, null, null, null];
  }

  /**
   * Invalidates all caches except the active slot
   */
  invalidateAllExcept(activeSlotIndex) {
    for (let i = 0; i < 6; i++) {
      if (i !== activeSlotIndex) {
        this.invalidateSlot(i);
      }
    }
  }

  /**
   * Checks if the active slot has changed and invalidates its cache if needed
   */
  handleActiveCutSlotChange(currentActiveSlot) {
    if (currentActiveSlot !== this.previousActiveCutSlot) {
      this.invalidateSlot(currentActiveSlot);
      this.previousActiveCutSlot = currentActiveSlot;
      return true;
    }
    return false;
  }

  /**
   * Gets the cached graphics for a slot
   */
  getCache(slotIndex) {
    return this.cutCaches[slotIndex];
  }

  /**
   * Gets all caches (for passing to render engine)
   */
  getCaches() {
    return this.cutCaches;
  }

  /**
   * Resets the cache manager state
   */
  reset() {
    this.invalidateAll();
    this.previousActiveCutSlot = null;
  }
}
