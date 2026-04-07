import * as THREE from 'three';
import { GAME_CONFIG } from './config.js';
import { createUnitModel } from './CubePetModels.js';
import { EventBus } from '../../shared/EventBus.js';
import { emitSpectacle, SPECTACLE_EVENTS } from '../../shared/SpectacleHooks.js';

// ── Floating HP bar (canvas → Sprite) ────────────────────────
function createHPLabel(weight, maxHp) {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');

  drawHPLabel(ctx, 1.0); // full HP

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.6, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.7, 0.12, 1);
  sprite.renderOrder = 999;

  return { sprite, canvas, ctx, texture, maxHp, _lastPct: 1.0 };
}

function drawHPLabel(ctx, pct) {
  const w = 48, h = 8;
  ctx.clearRect(0, 0, w, h);

  // Thin bar background
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, 0, 0, w, h, 3);

  // HP fill
  const fillW = Math.max(0, (w - 2) * pct);
  const r = Math.floor(255 * (1 - pct));
  const g = Math.floor(200 * pct);
  ctx.fillStyle = `rgb(${r},${g},40)`;
  roundRect(ctx, 1, 1, fillW, h - 2, 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

function updateHPLabel(label, hp) {
  const pct = Math.max(0, hp / label.maxHp);
  if (Math.abs(pct - label._lastPct) < 0.01) return; // skip if unchanged
  label._lastPct = pct;
  drawHPLabel(label.ctx, pct);
  label.texture.needsUpdate = true;
}

// ──────────────────────────────────────────────────────────────

export class PigVsChickScene {
  constructor(sceneManager, network, ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.ui = ui;
    this.gameData = gameData;

    this.scene = null;
    this.camera = null;
    this.units = new Map();
    this.mySide = gameData.yourSide;
    this.myDirection = gameData.yourDirection;
    this.gameActive = false;

    this._particleGeo = new THREE.SphereGeometry(0.06, 6, 6);
    this._particleMats = {
      pig: new THREE.MeshToonMaterial({ color: 0xffc8e8 }),
      chicken: new THREE.MeshToonMaterial({ color: 0xfff080 }),
      chick: new THREE.MeshToonMaterial({ color: 0xfff080 }),
    };

    const totalWidth = GAME_CONFIG.NUM_LANES * GAME_CONFIG.LANE_WIDTH;
    this.laneXPositions = [];
    for (let i = 0; i < GAME_CONFIG.NUM_LANES; i++) {
      this.laneXPositions.push(-totalWidth / 2 + GAME_CONFIG.LANE_WIDTH / 2 + i * GAME_CONFIG.LANE_WIDTH);
    }

    this._comboWindowMs = 2500;
    this._killTimestamps = [];
    this._lastPlayerHP = null;
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0e870);

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();

    // Camera — flip for P2 so your units always appear at bottom
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);

    if (this.myDirection === 1) {
      // P1: camera behind +Z, looking toward -Z
      this.camera.position.set(0, 13, 9);
      this.camera.lookAt(0, 0, -1);
    } else {
      // P2: camera behind -Z, looking toward +Z (flipped view)
      this.camera.position.set(0, 13, -9);
      this.camera.lookAt(0, 0, 1);
    }

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e0, 0.8);
    sun.position.set(3, 15, 8);
    sun.castShadow = true;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    this.scene.add(sun);

    this.createBattlefield();
    this.createLaneHighlights();

    // Invisible ground plane for raycasting
    const groundGeo = new THREE.PlaneGeometry(30, GAME_CONFIG.LANE_HEIGHT + 4);
    const groundMat = new THREE.MeshBasicMaterial({ visible: false });
    this._groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this._groundPlane.rotation.x = -Math.PI / 2;
    this._groundPlane.position.y = 0;
    this.scene.add(this._groundPlane);

    this._onCanvasTap = (e) => this._handleLaneTap(e);
    this.sceneManager.renderer.domElement.addEventListener('pointerdown', this._onCanvasTap);

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = () => this.update();

    this._onState = (state) => this.onServerState(state);
    EventBus.on('game:state', this._onState);

    if (this.gameData.reconnect) {
      this.gameActive = true;
    } else {
      this.startCountdown();
    }
  }

  createBattlefield() {
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const totalWidth = GAME_CONFIG.NUM_LANES * GAME_CONFIG.LANE_WIDTH + 2;

    const fieldGeo = new THREE.PlaneGeometry(totalWidth + 4, GAME_CONFIG.LANE_HEIGHT + 4);
    const fieldMat = new THREE.MeshToonMaterial({ color: 0x98e468 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.02;
    field.receiveShadow = true;
    this.scene.add(field);

    for (let i = 0; i <= GAME_CONFIG.NUM_LANES; i++) {
      const x = -totalWidth / 2 + 1 + i * GAME_CONFIG.LANE_WIDTH;
      const lineGeo = new THREE.PlaneGeometry(0.04, GAME_CONFIG.LANE_HEIGHT);
      const lineMat = new THREE.MeshToonMaterial({ color: 0x80d058 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, -0.01, 0);
      this.scene.add(line);
    }

    for (let lane = 0; lane < GAME_CONFIG.NUM_LANES; lane++) {
      const lx = this.laneXPositions[lane];
      for (let s = -3; s <= 3; s++) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.015, GAME_CONFIG.LANE_HEIGHT - 1),
          new THREE.MeshToonMaterial({ color: 0x80c858, transparent: true, opacity: 0.4 })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(lx + s * 0.22, -0.005, 0);
        this.scene.add(stripe);
      }
    }

    [halfLane + 0.5, -halfLane - 0.5].forEach((z) => {
      const fenceGeo = new THREE.PlaneGeometry(totalWidth, 0.8);
      const fenceMat = new THREE.MeshToonMaterial({ color: 0x8B6914, side: THREE.DoubleSide });
      const fence = new THREE.Mesh(fenceGeo, fenceMat);
      fence.position.set(0, 0.4, z);
      this.scene.add(fence);

      for (let p = 0; p < 6; p++) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8),
          new THREE.MeshToonMaterial({ color: 0x6B4F14 })
        );
        post.position.set(-totalWidth / 2 + 1 + p * (totalWidth / 5), 0.45, z);
        this.scene.add(post);
      }
    });

    [-totalWidth / 2 - 1.5, totalWidth / 2 + 1.5].forEach((x) => {
      for (let z = -4; z <= 4; z += 2.5) {
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 8, 8),
          new THREE.MeshToonMaterial({ color: 0x4a8c3f })
        );
        bush.position.set(x + (Math.random() - 0.5) * 0.3, 0.15, z + Math.random() * 0.5);
        bush.castShadow = true;
        this.scene.add(bush);
      }
    });
  }

  // ── Lane highlights ─────────────────────────────────────────
  createLaneHighlights() {
    this._laneHighlights = [];
    for (let i = 0; i < GAME_CONFIG.NUM_LANES; i++) {
      const geo = new THREE.PlaneGeometry(GAME_CONFIG.LANE_WIDTH - 0.1, GAME_CONFIG.LANE_HEIGHT);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xaaffaa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(this.laneXPositions[i], 0.005, 0);
      this.scene.add(mesh);
      this._laneHighlights.push(mesh);
    }
  }

  _flashLane(lane) {
    this._laneHighlights.forEach((h, i) => {
      h.material.opacity = i === lane ? 0.18 : 0;
    });
    if (this._laneFlashTimer) clearTimeout(this._laneFlashTimer);
    this._laneFlashTimer = setTimeout(() => {
      this._laneHighlights.forEach((h) => { h.material.opacity = 0; });
    }, 500);
  }

  // ──────────────────────────────────────────────────────────────

  startCountdown() {
    let count = 3;
    this.ui.showCountdown(count);
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.ui.showCountdown(count);
      } else if (count === 0) {
        this.ui.showCountdown('GO!');
      } else {
        clearInterval(interval);
        this.gameActive = true;
      }
    }, 800);
  }

  spawnUnit(data) {
    const { side, tier, direction, id, lane } = data;
    const config = GAME_CONFIG.UNITS[tier - 1];

    const model = createUnitModel(side, tier);
    const baseScale = 1.4 + (tier - 1) * 0.3;
    model.scale.setScalar(baseScale);

    const laneX = this.laneXPositions[lane] || 0;
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const startZ = direction === 1 ? halfLane : -halfLane;

    model.position.set(laneX, 0, startZ);

    if (direction === 1) {
      model.rotation.y = Math.PI;
    }

    this.scene.add(model);

    // Floating HP bar + weight label
    const weight = data.weight || config.weight || 10;
    const maxHp = data.maxHp || config.hp;
    const hpLabel = createHPLabel(weight, maxHp);
    hpLabel._weight = weight;
    const labelHeight = 1.0 + (tier - 1) * 0.22;
    hpLabel.sprite.position.set(0, labelHeight, 0);
    model.add(hpLabel.sprite);

    const unit = {
      id,
      model,
      side,
      tier,
      direction,
      lane,
      hp: data.hp || maxHp,
      maxHp,
      weight,
      state: data.state || 'march',
      z: startZ,
      targetX: laneX,
      targetZ: startZ,
      hpLabel,
    };

    this.units.set(id, unit);
    emitSpectacle(SPECTACLE_EVENTS.ENTRANCE, { lane, side, tier });
  }

  update(dt = 0.016) {
    if (!this.gameActive) return;

    const lerpFactor = Math.min(1, dt * 12);

    for (const [, unit] of this.units) {
      if (!unit._pushing) {
        unit.model.position.x += (unit.targetX - unit.model.position.x) * lerpFactor;
      }
      unit.model.position.z += (unit.targetZ - unit.model.position.z) * lerpFactor;

      if (unit.state !== 'dead') {
        // Gentle bob when marching, faster shake when pushing
        if (unit.state === 'push') {
          unit.model.position.y = Math.sin(Date.now() * 0.015 + unit.id * 50) * 0.06;
        } else {
          unit.model.position.y = Math.sin(Date.now() * 0.005 + unit.id * 50) * 0.04;
        }
      }
    }
  }

  _handleLaneTap(e) {
    if (!this.gameActive) return;

    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObject(this._groundPlane);
    if (hits.length === 0) return;

    const hitX = hits[0].point.x;

    let bestLane = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.laneXPositions.length; i++) {
      const dist = Math.abs(hitX - this.laneXPositions[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestLane = i;
      }
    }

    if (bestDist <= GAME_CONFIG.LANE_WIDTH / 2) {
      this._flashLane(bestLane);
      EventBus.emit('lane:tapped', bestLane);
    }
  }

  onServerState(state) {
    if (!state.units) return;

    const serverIds = new Set(state.units.map((u) => u.id));

    // Remove dead units
    for (const [id, unit] of this.units) {
      if (!serverIds.has(id)) {
        if (unit._pushShake) clearInterval(unit._pushShake);
        this.spawnDeathParticles(unit.model.position.clone(), unit.side);
        // Dispose HP label
        if (unit.hpLabel) {
          unit.hpLabel.texture.dispose();
          unit.hpLabel.sprite.material.dispose();
        }
        this.disposeModel(unit.model);
        this.units.delete(id);

        emitSpectacle(SPECTACLE_EVENTS.KILL, { lane: unit.lane, side: unit.side, tier: unit.tier });
        const now = Date.now();
        this._killTimestamps.push(now);
        this._killTimestamps = this._killTimestamps.filter((t) => now - t <= this._comboWindowMs);
        if (this._killTimestamps.length >= 2) {
          emitSpectacle(SPECTACLE_EVENTS.COMBO, { kills: this._killTimestamps.length });
        }
      }
    }

    // Add/update units
    for (const su of state.units) {
      let unit = this.units.get(su.id);

      if (!unit) {
        this.spawnUnit(su);
        unit = this.units.get(su.id);
      }

      if (unit) {
        const laneX = this.laneXPositions[su.lane] || 0;
        unit.targetX = laneX;
        unit.targetZ = su.z;
        unit.z = su.z;
        unit.hp = su.hp;
        unit.state = su.state;
        if (!unit._nearMissEmitted && su.hp > 0 && su.hp <= Math.max(1, Math.floor(unit.maxHp * 0.2))) {
          unit._nearMissEmitted = true;
          emitSpectacle(SPECTACLE_EVENTS.NEAR_MISS, { lane: su.lane, side: su.side, id: su.id });
        }

        // Update floating HP bar
        if (unit.hpLabel) {
          updateHPLabel(unit.hpLabel, su.hp);
        }

        // Push shake effect
        if (su.state === 'push' && !unit._pushing) {
          emitSpectacle(SPECTACLE_EVENTS.HIT, { lane: su.lane, side: su.side, id: su.id });
          unit._pushing = true;
          unit._pushShake = setInterval(() => {
            if (unit.state !== 'push') {
              clearInterval(unit._pushShake);
              unit._pushing = false;
              unit.model.position.x = unit.targetX;
              return;
            }
            unit.model.position.x = unit.targetX + (Math.random() - 0.5) * 0.06;
          }, 80);
        }
        if (su.state !== 'push' && unit._pushing) {
          clearInterval(unit._pushShake);
          unit._pushing = false;
          unit.model.position.x = unit.targetX;
        }
      }
    }

    if (state.playerHP) {
      if (this._lastPlayerHP && state.playerHP.mine < this._lastPlayerHP.mine) {
        emitSpectacle(SPECTACLE_EVENTS.BASE_HIT, {
          amount: this._lastPlayerHP.mine - state.playerHP.mine,
          side: this.mySide,
        });
      }
      this._lastPlayerHP = { ...state.playerHP };
      this.ui.updateHP(state.playerHP, this.gameData);
    }
    if (state.energy !== undefined) {
      this.ui.updateEnergy(state.energy, GAME_CONFIG.MAX_ENERGY);
      this.ui.updateSpawnButtons(state.energy);
    }
  }

  spawnDeathParticles(pos, side) {
    const mat = this._particleMats[side] || this._particleMats.pig;
    const particles = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(this._particleGeo, mat);
      p.position.copy(pos);
      p.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 3
      );
      this.scene.add(p);
      particles.push(p);
    }
    let t = 0;
    const animate = () => {
      t += 0.035;
      if (t >= 1) {
        particles.forEach((p) => this.scene.remove(p));
        return;
      }
      particles.forEach((p) => {
        p.position.add(p.velocity.clone().multiplyScalar(0.016));
        p.velocity.y -= 9.8 * 0.016;
        p.scale.setScalar(1 - t);
      });
      requestAnimationFrame(animate);
    };
    animate();
  }

  disposeModel(model) {
    this.scene.remove(model);
    model.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }

  destroy() {
    this.gameActive = false;
    this.sceneManager.onUpdate = null;
    EventBus.off('game:state', this._onState);
    if (this._onCanvasTap) {
      this.sceneManager.renderer.domElement.removeEventListener('pointerdown', this._onCanvasTap);
    }
    if (this._laneFlashTimer) clearTimeout(this._laneFlashTimer);
    for (const [, unit] of this.units) {
      if (unit._pushShake) clearInterval(unit._pushShake);
      if (unit.hpLabel) {
        unit.hpLabel.texture.dispose();
        unit.hpLabel.sprite.material.dispose();
      }
      this.disposeModel(unit.model);
    }
    this.units.clear();
    this._particleGeo.dispose();
    Object.values(this._particleMats).forEach((m) => m.dispose());
    // Dispose lane highlights
    if (this._laneHighlights) {
      this._laneHighlights.forEach((h) => {
        h.geometry.dispose();
        h.material.dispose();
      });
    }
  }
}
