import * as THREE from 'three';
import { EventBus } from '../../shared/EventBus.js';
import { GAME_CONFIG } from './config.js';

const CELL = 1.1;
const DISC_RADIUS = 0.42;
const DISC_HEIGHT = 0.15;
const BOARD_COLOR = 0x1a3a6a;
const YELLOW_COLOR = 0xffdd44;
const PINK_COLOR = 0xff6b9d;
const EMPTY_COLOR = 0x0d1b3a;

export class ConnectFourScene {
  constructor(sceneManager, network, _ui, data) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.data = data;
    this.mySide = data.yourSide;

    this.scene = null;
    this.camera = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.cells = [];
    this.discs = [];
    this.hoverCol = -1;
    this.hoverMesh = null;
    this.isMyTurn = false;
    this._onState = null;
    this._onClick = null;
    this._onMove = null;
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    const aspect = window.innerWidth / window.innerHeight;
    const frustum = 5.5;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 100,
    );
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(5, 10, 10);
    this.scene.add(dir);

    this.buildBoard();
    this.buildHoverDisc();

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = () => {};

    this._onState = (state) => this.onGameState(state);
    EventBus.on('game:state', this._onState);

    this._onClick = (e) => this.onClick(e);
    this._onMove = (e) => this.onPointerMove(e);
    window.addEventListener('pointerdown', this._onClick);
    window.addEventListener('pointermove', this._onMove);
  }

  buildBoard() {
    const rows = GAME_CONFIG.ROWS;
    const cols = GAME_CONFIG.COLS;
    const offsetX = -(cols - 1) * CELL / 2;
    const offsetY = (rows - 1) * CELL / 2;

    // Board background
    const bgGeom = new THREE.BoxGeometry(cols * CELL + 0.4, rows * CELL + 0.4, 0.3);
    const bgMat = new THREE.MeshStandardMaterial({ color: BOARD_COLOR });
    const bg = new THREE.Mesh(bgGeom, bgMat);
    bg.position.z = -0.2;
    this.scene.add(bg);

    // Slot holes
    const slotGeom = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, 0.4, 24);
    slotGeom.rotateX(Math.PI / 2);
    const slotMat = new THREE.MeshStandardMaterial({ color: EMPTY_COLOR });

    this.cells = [];
    for (let r = 0; r < rows; r++) {
      this.cells[r] = [];
      for (let c = 0; c < cols; c++) {
        const slot = new THREE.Mesh(slotGeom, slotMat);
        slot.position.set(offsetX + c * CELL, offsetY - r * CELL, 0);
        slot.userData = { row: r, col: c };
        this.scene.add(slot);
        this.cells[r][c] = slot;
      }
    }

    // Column tap zones (invisible planes for raycasting)
    this.colZones = [];
    const zoneGeom = new THREE.PlaneGeometry(CELL, rows * CELL + 1);
    const zoneMat = new THREE.MeshBasicMaterial({ visible: false });
    for (let c = 0; c < cols; c++) {
      const zone = new THREE.Mesh(zoneGeom, zoneMat);
      zone.position.set(offsetX + c * CELL, 0, 0.3);
      zone.userData = { col: c };
      this.scene.add(zone);
      this.colZones.push(zone);
    }
  }

  buildHoverDisc() {
    const geom = new THREE.CylinderGeometry(DISC_RADIUS * 0.85, DISC_RADIUS * 0.85, DISC_HEIGHT, 24);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    this.hoverMesh = new THREE.Mesh(geom, mat);
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);
  }

  onGameState(state) {
    if (!state.board) return;
    const rows = GAME_CONFIG.ROWS;
    const cols = GAME_CONFIG.COLS;
    const offsetX = -(cols - 1) * CELL / 2;
    const offsetY = (rows - 1) * CELL / 2;

    this.isMyTurn = state.currentTurn === this.network.playerId;

    // Render discs
    // Remove old discs
    for (const d of this.discs) this.scene.remove(d);
    this.discs = [];

    const discGeom = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_HEIGHT, 24);
    discGeom.rotateX(Math.PI / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = state.board[r][c];
        if (val === 0) continue;
        const color = val === 'yellow' ? YELLOW_COLOR : PINK_COLOR;
        const mat = new THREE.MeshStandardMaterial({ color });
        const disc = new THREE.Mesh(discGeom, mat);
        disc.position.set(offsetX + c * CELL, offsetY - r * CELL, 0.1);
        this.scene.add(disc);
        this.discs.push(disc);
      }
    }

    // Highlight win line
    if (state.winLine) {
      for (const { row, col } of state.winLine) {
        const x = offsetX + col * CELL;
        const y = offsetY - row * CELL;
        const glowGeom = new THREE.RingGeometry(DISC_RADIUS * 0.9, DISC_RADIUS * 1.1, 24);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.set(x, y, 0.2);
        this.scene.add(glow);
        this.discs.push(glow);
      }
    }

    // Update hover disc color
    if (this.hoverMesh) {
      const myColor = this.mySide === 'yellow' ? YELLOW_COLOR : PINK_COLOR;
      this.hoverMesh.material.color.setHex(myColor);
      this.hoverMesh.visible = this.isMyTurn && this.hoverCol >= 0;
    }
  }

  onClick(e) {
    if (!this.isMyTurn) return;
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.colZones);
    if (hits.length > 0) {
      const col = hits[0].object.userData.col;
      this.network.sendGameAction({ type: 'drop', col });
    }
  }

  onPointerMove(e) {
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.colZones);

    if (hits.length > 0 && this.isMyTurn) {
      const col = hits[0].object.userData.col;
      this.hoverCol = col;
      const cols = GAME_CONFIG.COLS;
      const rows = GAME_CONFIG.ROWS;
      const offsetX = -(cols - 1) * CELL / 2;
      const offsetY = (rows - 1) * CELL / 2;
      this.hoverMesh.position.set(offsetX + col * CELL, offsetY + CELL * 0.9, 0.1);
      this.hoverMesh.visible = true;
    } else {
      this.hoverCol = -1;
      if (this.hoverMesh) this.hoverMesh.visible = false;
    }
  }

  updatePointer(e) {
    const x = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const y = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    this.pointer.x = (x / window.innerWidth) * 2 - 1;
    this.pointer.y = -(y / window.innerHeight) * 2 + 1;
  }

  destroy() {
    if (this._onState) EventBus.off('game:state', this._onState);
    if (this._onClick) window.removeEventListener('pointerdown', this._onClick);
    if (this._onMove) window.removeEventListener('pointermove', this._onMove);
    this.sceneManager.onUpdate = null;
    if (this.scene) {
      while (this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
    }
    this.discs = [];
    this.cells = [];
    this.colZones = [];
  }
}
