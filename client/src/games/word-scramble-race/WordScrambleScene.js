import * as THREE from 'three';

/** Minimal 3D scene — gameplay is DOM (grid) in the overlay HUD. */
export class WordScrambleScene {
  constructor(sceneManager, network, ui, gameData) {
    this.sceneManager = sceneManager;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12121f);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
  }

  init() {
    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = null;
  }

  destroy() {
    this.sceneManager.onUpdate = null;
  }
}
