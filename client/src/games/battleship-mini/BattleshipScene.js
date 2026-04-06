import * as THREE from 'three';

// Ambient ocean-wave background for Battleship Mini.
// Gameplay is entirely HUD-driven — this scene is just eye-candy.

const WAVE_COUNT = 15;
const DRIFT_SPEED = 0.15;

export class BattleshipScene {
  constructor(sceneManager, _network, _ui, _data) {
    this.sceneManager = sceneManager;
    this.scene = null;
    this.camera = null;
    this.waves = [];
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -10 * aspect, 10 * aspect, 10, -10, 0.1, 100,
    );
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    this.createWaves();

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = (dt) => this.update(dt);
  }

  createWaves() {
    // Horizontal wave lines drifting upward
    const geom = new THREE.PlaneGeometry(25, 0.08);
    const spread = 22;

    for (let i = 0; i < WAVE_COUNT; i++) {
      const hue = 0.55 + Math.random() * 0.1; // ocean blues
      const color = new THREE.Color().setHSL(hue, 0.4, 0.35);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.05 + Math.random() * 0.08,
      });
      const mesh = new THREE.Mesh(geom, mat);

      mesh.position.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * spread,
        -1 - Math.random() * 3,
      );
      const scaleX = 0.4 + Math.random() * 0.8;
      mesh.scale.set(scaleX, 1, 1);

      this.scene.add(mesh);
      this.waves.push({
        mesh,
        vy: (0.1 + Math.random() * 0.2) * DRIFT_SPEED,
        vx: (Math.random() - 0.5) * 0.1,
        resetY: -12,
        spawnY: 12,
      });
    }
  }

  update(dt) {
    for (const w of this.waves) {
      w.mesh.position.y += w.vy * dt;
      w.mesh.position.x += w.vx * dt;
      if (w.mesh.position.y > w.spawnY) {
        w.mesh.position.y = w.resetY;
        w.mesh.position.x = (Math.random() - 0.5) * 6;
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
    this.waves = [];
  }
}
