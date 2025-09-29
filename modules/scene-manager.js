import * as THREE from "three";

/**
 * Manages the Three.js scene, camera, and renderer
 */
export class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animationId = null;
  }

  /**
   * Initialize the Three.js scene
   */
  init(backgroundColor = 0x000000, cameraZ = 400) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor);

    // Calculate canvas dimensions (subtract sidebar width)
    const sidebarWidth = 380;
    const canvasWidth = window.innerWidth - sidebarWidth;
    const canvasHeight = window.innerHeight;

    // Create perspective camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvasWidth / canvasHeight,
      0.1,
      2000
    );
    this.camera.position.z = cameraZ;

    // Create renderer with flat color rendering
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(canvasWidth, canvasHeight);

    // Disable tone mapping to preserve exact colors
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    document.body.appendChild(this.renderer.domElement);

    // Handle window resize
    window.addEventListener("resize", () => this.onWindowResize(), false);

    return this.scene;
  }

  /**
   * Start the animation loop
   */
  startAnimation() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /**
   * Stop the animation loop
   */
  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Update camera position
   */
  setCameraPosition(x, y, z) {
    if (this.camera) {
      this.camera.position.set(x, y, z);
    }
  }

  /**
   * Add object to scene
   */
  addToScene(object) {
    if (this.scene) {
      this.scene.add(object);
    }
  }

  /**
   * Remove object from scene
   */
  removeFromScene(object) {
    if (this.scene && object) {
      this.scene.remove(object);
    }
  }

  /**
   * Save current frame as image
   */
  saveFrame(filename = `depth_map_collage_${Date.now()}.png`) {
    this.renderer.render(this.scene, this.camera);

    const link = document.createElement("a");
    link.download = filename;
    link.href = this.renderer.domElement.toDataURL();
    link.click();
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    if (this.camera && this.renderer) {
      // Calculate canvas dimensions (subtract sidebar width)
      const sidebarWidth = 380;
      const canvasWidth = window.innerWidth - sidebarWidth;
      const canvasHeight = window.innerHeight;

      this.camera.aspect = canvasWidth / canvasHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(canvasWidth, canvasHeight);
    }
  }

  /**
   * Get renderer canvas element
   */
  getCanvas() {
    return this.renderer?.domElement;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopAnimation();

    if (this.renderer) {
      this.renderer.dispose();
      // Remove canvas from DOM if it exists
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(
          this.renderer.domElement
        );
      }
      this.renderer = null;
    }

    if (this.scene) {
      // Dispose of all scene children
      while (this.scene.children.length > 0) {
        const child = this.scene.children[0];
        this.scene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      this.scene = null;
    }

    this.camera = null;
  }
}
