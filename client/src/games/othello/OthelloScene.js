import * as THREE from 'three';
import { EventBus } from '../../shared/EventBus.js';
import { DISPLAY_CONFIG, GAME_CONFIG } from './config.js';

export class OthelloScene {
  constructor(sceneManager, network, ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.ui = ui;
    this.gameData = gameData;

    this.scene = null;
    this.camera = null;
    this.mySide = gameData.yourSide;
    this.myId = null;
    this.gameActive = false;
    this.turnDeadlineAt = null;
    this.turnTimeMs = GAME_CONFIG.TURN_TIME_MS;
    this.turnStickerKey = GAME_CONFIG.TURN_STICKERS[0];
    this.isMyTurn = false;
    this._turnHudInterval = null;

    // Board meshes
    this.boardGroup = null;
    this.cellMeshes = [];
    this.discMeshes = [];
    this.validMoveIndicators = [];
    this.lastMoveHighlight = null;
    this._currentValidMoves = [];

    // Animations
    this.animations = [];

    // Raycaster for touch/click
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._lastTapTime = 0;

    // Reusable materials
    this._indicatorMat = null;
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Orthographic camera — top-down with slight angle for 3D disc visibility
    const aspect = window.innerWidth / window.innerHeight;
    const frustum = DISPLAY_CONFIG.CAMERA_FRUSTUM;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      0.1, 100
    );
    this.camera.position.set(0, 12, 3);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(2, 10, 4);
    mainLight.castShadow = true;
    this.scene.add(mainLight);

    this.createBoard();
    this.setupInteraction();

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = (dt) => this.update(dt);

    this._onState = (state) => this.onServerState(state);
    this._onError = (payload) => this.onActionError(payload);
    EventBus.on('game:state', this._onState);
    EventBus.on('game:action-error', this._onError);

    this._turnHudInterval = setInterval(() => this.updateTurnHUD(), 200);

    if (this.gameData.reconnect) {
      this.gameActive = true;
    } else {
      this.startCountdown();
    }
  }

  createBoard() {
    this.boardGroup = new THREE.Group();
    const size = DISPLAY_CONFIG.BOARD_SIZE;
    const cell = DISPLAY_CONFIG.CELL_SIZE;
    const boardWidth = size * cell;
    const half = boardWidth / 2;

    // Board base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(boardWidth + 0.4, 0.2, boardWidth + 0.4),
      new THREE.MeshToonMaterial({ color: 0x2e8b57 })
    );
    base.position.y = -0.1;
    base.receiveShadow = true;
    this.boardGroup.add(base);

    // Wooden border
    const borderMat = new THREE.MeshToonMaterial({ color: 0x5c3a1e });
    const bt = 0.3;
    const bh = 0.15;
    const borders = [
      [boardWidth + bt * 2 + 0.4, bt, 0, -half - bt / 2 - 0.2],
      [boardWidth + bt * 2 + 0.4, bt, 0, half + bt / 2 + 0.2],
      [bt, boardWidth + 0.4, -half - bt / 2 - 0.2, 0],
      [bt, boardWidth + 0.4, half + bt / 2 + 0.2, 0],
    ];
    for (const [w, d, x, z] of borders) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), borderMat);
      b.position.set(x, bh / 2 - 0.1, z);
      this.boardGroup.add(b);
    }

    // Cells
    this.cellMeshes = [];
    this.discMeshes = [];
    for (let r = 0; r < size; r++) {
      this.cellMeshes[r] = [];
      this.discMeshes[r] = [];
      for (let c = 0; c < size; c++) {
        const x = -half + cell / 2 + c * cell;
        const z = -half + cell / 2 + r * cell;
        const isEven = (r + c) % 2 === 0;
        const cellMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cell - 0.02, cell - 0.02),
          new THREE.MeshToonMaterial({ color: isEven ? 0x339966 : 0x2e8b57 })
        );
        cellMesh.rotation.x = -Math.PI / 2;
        cellMesh.position.set(x, 0.01, z);
        cellMesh.userData = { row: r, col: c };
        this.boardGroup.add(cellMesh);
        this.cellMeshes[r][c] = cellMesh;
        this.discMeshes[r][c] = null;
      }
    }

    // Grid lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x1a6b37 });
    for (let i = 0; i <= size; i++) {
      const pos = -half + i * cell;
      const hLine = new THREE.Mesh(new THREE.PlaneGeometry(boardWidth, 0.02), lineMat);
      hLine.rotation.x = -Math.PI / 2;
      hLine.position.set(0, 0.015, pos);
      this.boardGroup.add(hLine);

      const vLine = new THREE.Mesh(new THREE.PlaneGeometry(0.02, boardWidth), lineMat);
      vLine.rotation.x = -Math.PI / 2;
      vLine.position.set(pos, 0.015, 0);
      this.boardGroup.add(vLine);
    }

    // Center dot markers (standard Othello positions)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x1a6b37 });
    const dotGeo = new THREE.CircleGeometry(0.06, 16);
    for (const [r, c] of [[2, 2], [2, 6], [6, 2], [6, 6]]) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(-half + c * cell, 0.02, -half + r * cell);
      this.boardGroup.add(dot);
    }

    this.scene.add(this.boardGroup);
  }

  getCellPos(row, col) {
    const cell = DISPLAY_CONFIG.CELL_SIZE;
    const half = (DISPLAY_CONFIG.BOARD_SIZE * cell) / 2;
    return {
      x: -half + cell / 2 + col * cell,
      z: -half + cell / 2 + row * cell,
    };
  }

  createDisc(side) {
    const r = DISPLAY_CONFIG.DISC_RADIUS;
    const h = DISPLAY_CONFIG.DISC_HEIGHT;
    const color = side === 'black' ? 0x1a1a1a : 0xf0f0f0;
    const edgeColor = side === 'black' ? 0x333333 : 0xcccccc;

    const group = new THREE.Group();

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 32),
      new THREE.MeshToonMaterial({ color })
    );
    disc.castShadow = true;
    group.add(disc);

    // Edge ring on top
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.02, r, 32),
      new THREE.MeshBasicMaterial({ color: edgeColor, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = h / 2 + 0.005;
    group.add(ring);

    group.userData = { side };
    return group;
  }

  placeDisc(row, col, side, animate = true) {
    // Remove existing disc
    const existing = this.discMeshes[row][col];
    if (existing) {
      this.boardGroup.remove(existing);
      this.disposeMesh(existing);
    }

    const disc = this.createDisc(side);
    const { x, z } = this.getCellPos(row, col);
    const restY = DISPLAY_CONFIG.DISC_HEIGHT / 2 + 0.01;

    if (animate) {
      disc.position.set(x, 2, z);
      disc.scale.setScalar(0.01);
      this.animations.push({
        type: 'place',
        target: disc,
        endY: restY,
        progress: 0,
        duration: 0.3,
      });
    } else {
      disc.position.set(x, restY, z);
    }

    this.boardGroup.add(disc);
    this.discMeshes[row][col] = disc;
  }

  flipDisc(row, col, newSide, delay) {
    this.animations.push({
      type: 'flip',
      row,
      col,
      newSide,
      progress: 0,
      duration: 0.4,
      delay,
      swapped: false,
    });
  }

  setupInteraction() {
    const canvas = this.sceneManager.renderer.domElement;

    const handleTap = (clientX, clientY) => {
      const now = Date.now();
      if (now - this._lastTapTime < 300) return;
      this._lastTapTime = now;

      this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const allCells = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          allCells.push(this.cellMeshes[r][c]);
        }
      }

      const intersects = this.raycaster.intersectObjects(allCells);
      if (intersects.length > 0) {
        const { row, col } = intersects[0].object.userData;
        this.onCellTap(row, col);
      }
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleTap(t.clientX, t.clientY);
    }, { passive: false });

    canvas.addEventListener('click', (e) => {
      handleTap(e.clientX, e.clientY);
    });
  }

  onCellTap(row, col) {
    if (!this.gameActive) return;
    if (!this._currentValidMoves) return;

    const isValid = this._currentValidMoves.some(([r, c]) => r === row && c === col);
    if (!isValid) return;

    this.network.sendGameAction({ type: 'place-disc', row, col });
  }

  startCountdown() {
    let count = 3;
    this.ui.showCountdown(count);
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        this.ui.showCountdown(count);
      } else if (count === 0) {
        this.ui.showCountdown('GO!');
      } else {
        clearInterval(timer);
        this.gameActive = true;
      }
    }, 800);
  }

  // ==================== ANIMATION LOOP ====================

  update(dt) {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i];

      if (a.type === 'place') {
        a.progress += dt / a.duration;
        if (a.progress >= 1) {
          a.target.position.y = a.endY;
          a.target.scale.setScalar(1);
          this.animations.splice(i, 1);
        } else {
          const t = this.easeOutBounce(a.progress);
          a.target.position.y = 2 + (a.endY - 2) * t;
          a.target.scale.setScalar(Math.min(1, a.progress * 3));
        }
      } else if (a.type === 'flip') {
        if (a.delay > 0) {
          a.delay -= dt;
          continue;
        }
        a.progress += dt / a.duration;

        const disc = this.discMeshes[a.row]?.[a.col];
        if (!disc) {
          this.animations.splice(i, 1);
          continue;
        }

        if (a.progress >= 1) {
          // Replace with final disc
          this.boardGroup.remove(disc);
          this.disposeMesh(disc);
          this.discMeshes[a.row][a.col] = null;
          this.placeDisc(a.row, a.col, a.newSide, false);
          this.animations.splice(i, 1);
        } else {
          // 3D rotation around X axis
          const angle = a.progress * Math.PI;
          disc.rotation.x = angle;

          // Lift during flip
          const restY = DISPLAY_CONFIG.DISC_HEIGHT / 2 + 0.01;
          disc.position.y = restY + Math.sin(angle) * 0.5;

          // Swap color at midpoint
          if (a.progress >= 0.5 && !a.swapped) {
            a.swapped = true;
            const newColor = a.newSide === 'black' ? 0x1a1a1a : 0xf0f0f0;
            disc.traverse((child) => {
              if (child.isMesh && child.geometry.type === 'CylinderGeometry') {
                child.material.color.setHex(newColor);
              }
            });
          }
        }
      }
    }

    // Pulse valid move indicators
    if (this.validMoveIndicators.length > 0) {
      const pulse = 0.45 + Math.sin(Date.now() * 0.005) * 0.25;
      this._indicatorMat.opacity = pulse;
    }
  }

  easeOutBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
  }

  // ==================== SERVER STATE ====================

  onServerState(state) {
    if (!state.board) return;

    this.myId = state.yourId;
    this.isMyTurn = state.currentTurn === this.myId;
    this._currentValidMoves = this.isMyTurn ? state.validMoves : [];
    this.turnDeadlineAt = Number.isFinite(state.turnDeadlineAt) ? state.turnDeadlineAt : null;
    this.turnTimeMs = Number.isFinite(state.turnTimeMs) ? state.turnTimeMs : GAME_CONFIG.TURN_TIME_MS;
    this.turnStickerKey = typeof state.turnStickerKey === 'string'
      ? state.turnStickerKey
      : GAME_CONFIG.TURN_STICKERS[0];

    if (state.lastMove && !this.gameData.reconnect) {
      // Animate the new disc + flips
      const { row, col, side, flipped } = state.lastMove;
      this.placeDisc(row, col, side, true);
      flipped.forEach(([fr, fc], idx) => {
        this.flipDisc(fr, fc, side, 0.05 * (idx + 1));
      });
    } else {
      // Full board sync (initial state or reconnect)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const val = state.board[r][c];
          const existing = this.discMeshes[r]?.[c];
          if (val !== 0 && !existing) {
            this.placeDisc(r, c, val, false);
          } else if (val === 0 && existing) {
            this.boardGroup.remove(existing);
            this.disposeMesh(existing);
            this.discMeshes[r][c] = null;
          }
        }
      }
      if (this.gameData.reconnect) this.gameData.reconnect = false;
    }

    this.updateValidMoveIndicators(this._currentValidMoves);
    this.updateLastMoveHighlight(state.lastMove);

    // Update HUD
    if (this.ui.activeHUD) {
      if (this.ui.activeHUD.updateScore) this.ui.activeHUD.updateScore(state.scores);
      if (this.ui.activeHUD.updateTurn) this.updateTurnHUD();
    }

    // Pass toast
    if (state.passed) {
      const label = state.passed.charAt(0).toUpperCase() + state.passed.slice(1);
      this.ui.showError(`${label} has no valid moves — skipped!`);
    }
  }

  updateValidMoveIndicators(moves) {
    // Remove old
    for (const ind of this.validMoveIndicators) {
      this.boardGroup.remove(ind);
    }
    this.validMoveIndicators = [];

    if (!moves || moves.length === 0) return;

    // Create shared material (reuse for pulse animation)
    if (!this._indicatorMat) {
      this._indicatorMat = new THREE.MeshBasicMaterial({
        color: 0xffee55,
        transparent: true,
        opacity: 0.6,
      });
    }

    const geo = new THREE.CircleGeometry(DISPLAY_CONFIG.DISC_RADIUS * 0.6, 16);
    for (const [r, c] of moves) {
      const { x, z } = this.getCellPos(r, c);
      const ind = new THREE.Mesh(geo, this._indicatorMat);
      ind.rotation.x = -Math.PI / 2;
      ind.position.set(x, 0.02, z);
      this.boardGroup.add(ind);
      this.validMoveIndicators.push(ind);
    }
  }

  updateLastMoveHighlight(lastMove) {
    if (this.lastMoveHighlight) {
      this.boardGroup.remove(this.lastMoveHighlight);
      this.disposeMesh(this.lastMoveHighlight);
      this.lastMoveHighlight = null;
    }

    if (!lastMove) return;

    const { x, z } = this.getCellPos(lastMove.row, lastMove.col);
    const cs = DISPLAY_CONFIG.CELL_SIZE;
    const highlight = new THREE.Mesh(
      new THREE.RingGeometry(cs / 2 - 0.08, cs / 2 - 0.02, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      })
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.set(x, 0.025, z);
    this.boardGroup.add(highlight);
    this.lastMoveHighlight = highlight;
  }

  // ==================== CLEANUP ====================

  onActionError(payload) {
    if (!payload || payload.code !== 'TURN_TIMEOUT') return;
    if (!this.ui.activeHUD || typeof this.ui.activeHUD.showTimeoutPenalty !== 'function') return;
    this.ui.activeHUD.showTimeoutPenalty(payload);
  }

  updateTurnHUD() {
    if (!this.ui.activeHUD || !this.ui.activeHUD.updateTurn) return;
    const msLeft = this.turnDeadlineAt ? Math.max(0, this.turnDeadlineAt - Date.now()) : 0;
    this.ui.activeHUD.updateTurn(this.isMyTurn, this.mySide, msLeft, this.turnTimeMs, {
      turnStickerKey: this.turnStickerKey,
    });
  }

  disposeMesh(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material !== this._indicatorMat) {
          child.material.dispose();
        }
      }
    });
  }

  destroy() {
    this.gameActive = false;
    this.sceneManager.onUpdate = null;
    EventBus.off('game:state', this._onState);
    EventBus.off('game:action-error', this._onError);
    if (this._turnHudInterval) {
      clearInterval(this._turnHudInterval);
      this._turnHudInterval = null;
    }

    if (this.boardGroup) {
      this.boardGroup.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
      this.scene.remove(this.boardGroup);
    }

    this._indicatorMat = null;
    this.animations = [];
    this.validMoveIndicators = [];
    this.lastMoveHighlight = null;
  }
}
