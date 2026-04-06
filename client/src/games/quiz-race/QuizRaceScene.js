import * as THREE from 'three';

// Ambient floating question-mark shapes background for Quiz Race.
// Gameplay is entirely HUD-driven — this scene is just eye-candy.

const SHAPE_COUNT = 20;
const DRIFT_SPEED = 0.2;

export class QuizRaceScene {
  constructor(sceneManager, _network, _ui, _data) {
    this.sceneManager = sceneManager;
    this.scene = null;
    this.camera = null;
    this.shapes = [];
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0a2e);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -10 * aspect, 10 * aspect, 10, -10, 0.1, 100,
    );
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    this.createShapes();

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = (dt) => this.update(dt);
  }

  createShapes() {
    // Small circles and diamonds floating around
    const circleGeom = new THREE.CircleGeometry(0.25, 16);
    const diamondGeom = new THREE.BufferGeometry();

    // Diamond shape (rotated square)
    const s = 0.3;
    const verts = new Float32Array([
      0, s, 0,
      s, 0, 0,
      0, -s, 0,
      0, -s, 0,
      -s, 0, 0,
      0, s, 0,
    ]);
    diamondGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));

    const spread = 22;
    for (let i = 0; i < SHAPE_COUNT; i++) {
      const hue = 0.7 + Math.random() * 0.2; // purples/blues
      const color = new THREE.Color().setHSL(hue % 1, 0.5, 0.5);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.06 + Math.random() * 0.1,
      });
      const geom = i % 2 === 0 ? circleGeom : diamondGeom;
      const mesh = new THREE.Mesh(geom, mat);

      mesh.position.set(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        -1 - Math.random() * 5,
      );
      const scale = 0.5 + Math.random() * 2;
      mesh.scale.set(scale, scale, 1);
      mesh.rotation.z = Math.random() * Math.PI * 2;

      this.scene.add(mesh);
      this.shapes.push({
        mesh,
        vy: (0.1 + Math.random() * 0.3) * DRIFT_SPEED,
        vr: (Math.random() - 0.5) * 0.2,
        resetY: -12,
        spawnY: 12,
      });
    }
  }

  update(dt) {
    for (const s of this.shapes) {
      s.mesh.position.y += s.vy * dt;
      s.mesh.rotation.z += s.vr * dt;
      if (s.mesh.position.y > s.spawnY) {
        s.mesh.position.y = s.resetY;
        s.mesh.position.x = (Math.random() - 0.5) * 22;
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
    this.shapes = [];
  }
}
