import * as THREE from 'three';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.renderer = null;
    this.activeScene = null;
    this.activeCamera = null;
    this.clock = new THREE.Clock();
    this.scenes = {};
    this.onUpdate = null;
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x1a1a2e);
    this.renderer.shadowMap.enabled = true;
    this.container.insertBefore(this.renderer.domElement, this.container.firstChild);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.activeCamera) {
      if (this.activeCamera.isOrthographicCamera) {
        const aspect = w / h;
        const frustum = 10;
        this.activeCamera.left = -frustum * aspect;
        this.activeCamera.right = frustum * aspect;
        this.activeCamera.top = frustum;
        this.activeCamera.bottom = -frustum;
      } else {
        this.activeCamera.aspect = w / h;
      }
      this.activeCamera.updateProjectionMatrix();
    }
  }

  setScene(scene, camera) {
    this.activeScene = scene;
    this.activeCamera = camera;
    this.onResize();
  }

  startLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = this.clock.getDelta();
      if (this.onUpdate) this.onUpdate(dt);
      if (this.activeScene && this.activeCamera) {
        this.renderer.render(this.activeScene, this.activeCamera);
      }
    };
    animate();
  }
}
