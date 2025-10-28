/**
 * Cut Manager Module
 * Handles all cut-related state management and operations
 */

export class CutManager {
  constructor() {
    this.cutSlots = [null, null, null, null, null, null];
    this.selectedCutSlot = 0;
    this.cuts = [];
    this.activeCutIndex = null;
    this.nextCutId = 0;
  }

  placeCutInSlot(slotIndex, centerX, centerY) {
    if (slotIndex < 0 || slotIndex >= 6) return false;

    this.cutSlots[slotIndex] = {
      centerX: centerX,
      centerY: centerY,
    };

    this.selectedCutSlot = slotIndex;
    this.updateCutsArray();
    console.log(`Placed cut in slot ${slotIndex}`);
    return true;
  }

  updateCutsArray() {
    this.cuts = [];
    this.cutSlots.forEach((cut, slotIndex) => {
      if (cut !== null) {
        this.cuts.push({
          ...cut,
          slotIndex: slotIndex,
        });
      }
    });
  }

  selectCutSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      const wasChanged = slotIndex !== this.selectedCutSlot;
      this.selectedCutSlot = slotIndex;
      console.log(`Selected cut slot ${slotIndex}`);
      return wasChanged;
    }
    return false;
  }

  clearCutSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < 6) {
      this.cutSlots[slotIndex] = null;
      this.updateCutsArray();
      return true;
    }
    return false;
  }

  clearAllCuts() {
    this.cutSlots = [null, null, null, null, null, null];
    this.cuts = [];
    this.selectedCutSlot = 0;
    this.activeCutIndex = null;
    console.log("All cuts cleared");
  }

  addCut(centerX, centerY) {
    if (this.cuts.length >= 6) {
      console.warn("Maximum of 6 cuts reached");
      return null;
    }
    const newCut = {
      id: this.nextCutId++,
      centerX: centerX,
      centerY: centerY,
    };
    this.cuts.push(newCut);
    this.activeCutIndex = this.cuts.length - 1;
    console.log(`Cut added at (${centerX}, ${centerY}), ID: ${newCut.id}`);
    return this.activeCutIndex;
  }

  removeActiveCut() {
    if (this.activeCutIndex === null || this.cuts.length === 0) {
      console.warn("No active cut to remove");
      return false;
    }
    const removedCut = this.cuts[this.activeCutIndex];
    this.cuts.splice(this.activeCutIndex, 1);

    if (this.cuts.length === 0) {
      this.activeCutIndex = null;
    } else if (this.activeCutIndex >= this.cuts.length) {
      this.activeCutIndex = this.cuts.length - 1;
    }
    console.log(`Cut removed, ID: ${removedCut.id}`);
    return true;
  }

  selectCut(index) {
    if (index >= 0 && index < this.cuts.length) {
      this.activeCutIndex = index;
      return true;
    }
    return false;
  }

  findNearestCut(x, y, tolerance = 20) {
    for (let i = 0; i < this.cuts.length; i++) {
      const dx = this.cuts[i].centerX - x;
      const dy = this.cuts[i].centerY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= tolerance) {
        return i;
      }
    }
    return -1;
  }

  getCutsInfo() {
    if (this.cuts.length === 0) {
      return "No cuts yet. Click on the image to add one.";
    } else if (this.activeCutIndex === null) {
      return `${this.cuts.length} cut${
        this.cuts.length !== 1 ? "s" : ""
      } placed. Click to select.`;
    } else {
      return `${this.cuts.length} cut${
        this.cuts.length !== 1 ? "s" : ""
      } placed. Cut ${this.activeCutIndex + 1} selected.`;
    }
  }

  getCutIndices() {
    const usedIndices = [];
    this.cutSlots.forEach((cut, slotIndex) => {
      if (cut !== null) {
        usedIndices.push(slotIndex);
      }
    });
    return usedIndices;
  }

  hasActiveCut() {
    return this.activeCutIndex !== null && this.cuts.length > 0;
  }

  getCuts() {
    return this.cuts;
  }

  getCutSlots() {
    return this.cutSlots;
  }

  getSelectedCutSlot() {
    return this.selectedCutSlot;
  }

  getActiveCutIndex() {
    return this.activeCutIndex;
  }

  getCutCount() {
    return this.cuts.length;
  }
}
