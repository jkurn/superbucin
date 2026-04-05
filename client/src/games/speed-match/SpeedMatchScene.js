import * as THREE from 'three';

// Ambient floating-hearts background for Speed Match.
// Gameplay is entirely HUD-driven — this scene is just eye-candy.

const HEART_COUNT = 25;
const DRIFT_SPEED = 0.3;

export class SpeedMatchScene {
  constructor(sceneManager, network, ui, data) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.ui = ui;
    this.data = data;

    this.scene = null;
    this.camera = null;
    this.hearts = [];
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -10 * aspect, 10 * aspect, 10, -10, 0.1, 100,
    );
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    // Soft ambient light
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    this.createHearts();

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = (dt) => this.update(dt);
  }

  createHearts() {
    const heartShape = new THREE.Shape();
    const s = 0.15;
    heartShape.moveTo(0, s * 1.5);
    heartShape.bezierCurveTo(s * 2, s * 4.5, s * 6, s * 2, 0, -s * 1.5);
    heartShape.moveTo(0, s * 1.5);
    heartShape.bezierCurveTo(-s * 2, s * 4.5, -s * 6, s * 2, 0, -s * 1.5);

    const geom = new THREE.ShapeGeometry(heartShape);

    for (let i = 0; i < HEART_COUNT; i++) {
      const hue = 0.9 + Math.random() * 0.15; // pinks to reds
      const color = new THREE.Color().setHSL(hue % 1, 0.6, 0.55);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.08 + Math.random() * 0.12,
      });
      const mesh = new THREE.Mesh(geom, mat);

      const spread = 22;
      mesh.position.set(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        -1 - Math.random() * 5,
      );
      const scale = 0.5 + Math.random() * 1.5;
      mesh.scale.set(scale, scale, 1);
      mesh.rotation.z = Math.random() * Math.PI * 2;

      this.scene.add(mesh);
      this.hearts.push({
        mesh,
        vy: (0.2 + Math.random() * 0.4) * DRIFT_SPEED,
        vr: (Math.random() - 0.5) * 0.3,
        resetY: -12,
        spawnY: 12,
      });
    }
  }

  update(dt) {
    for (const h of this.hearts) {
      h.mesh.position.y += h.vy * dt;
      h.mesh.rotation.z += h.vr * dt;
      if (h.mesh.position.y > h.spawnY) {
        h.mesh.position.y = h.resetY;
        h.mesh.position.x = (Math.random() - 0.5) * 22;
      }
    }
  }

  destroy() {
    this.sceneManager.onUpdate = null;
    if (this.scene) {
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
    }
    this.hearts = [];
  }
}
