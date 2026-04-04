import * as THREE from 'three';
import { GAME_CONFIG } from './config.js';
import { createUnitModel } from './CubePetModels.js';

export class PigVsChickScene {
  constructor(sceneManager, network, ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.ui = ui;
    this.gameData = gameData;

    this.scene = null;
    this.camera = null;
    this.units = new Map(); // id -> unit
    this.mySide = gameData.yourSide;
    this.myDirection = gameData.yourDirection; // 1 = bottom-to-top, -1 = top-to-bottom
    this.gameActive = false;

    // Lane positions (x coordinates for 5 lanes)
    const totalWidth = GAME_CONFIG.NUM_LANES * GAME_CONFIG.LANE_WIDTH;
    this.laneXPositions = [];
    for (let i = 0; i < GAME_CONFIG.NUM_LANES; i++) {
      this.laneXPositions.push(-totalWidth / 2 + GAME_CONFIG.LANE_WIDTH / 2 + i * GAME_CONFIG.LANE_WIDTH);
    }
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x88cc55);

    // Camera — perspective with tilted view to see 3D models
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    // Tilted angle — see both fences and 3D model shapes
    this.camera.position.set(0, 13, 9);
    this.camera.lookAt(0, 0, -1);

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

    this.sceneManager.setScene(this.scene, this.camera);
    this.sceneManager.onUpdate = (dt) => this.update(dt);

    // Show game UI
    this.ui.showGameHUD({
      p1Side: this.gameData.p1Side,
      p2Side: this.gameData.p2Side,
      p1Label: this.gameData.p1Label,
      p2Label: this.gameData.p2Label,
      myDirection: this.myDirection,
    });

    this.startCountdown();
  }

  createBattlefield() {
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const totalWidth = GAME_CONFIG.NUM_LANES * GAME_CONFIG.LANE_WIDTH + 2;

    // Main grass field
    const fieldGeo = new THREE.PlaneGeometry(totalWidth + 4, GAME_CONFIG.LANE_HEIGHT + 4);
    const fieldMat = new THREE.MeshToonMaterial({ color: 0x7ec850 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.02;
    field.receiveShadow = true;
    this.scene.add(field);

    // Lane stripes (darker grass lines, like the reference)
    for (let i = 0; i <= GAME_CONFIG.NUM_LANES; i++) {
      const x = -totalWidth / 2 + 1 + i * GAME_CONFIG.LANE_WIDTH;
      const lineGeo = new THREE.PlaneGeometry(0.04, GAME_CONFIG.LANE_HEIGHT);
      const lineMat = new THREE.MeshToonMaterial({ color: 0x6ab842 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, -0.01, 0);
      this.scene.add(line);
    }

    // Vertical grass texture lines within each lane
    for (let lane = 0; lane < GAME_CONFIG.NUM_LANES; lane++) {
      const lx = this.laneXPositions[lane];
      for (let s = -3; s <= 3; s++) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.015, GAME_CONFIG.LANE_HEIGHT - 1),
          new THREE.MeshToonMaterial({ color: 0x72b848, transparent: true, opacity: 0.4 })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(lx + s * 0.22, -0.005, 0);
        this.scene.add(stripe);
      }
    }

    // Base zones (top = enemy or player depending on direction)
    const baseColors = [0xff6b9d, 0x6bc5ff]; // pink, blue
    [halfLane + 0.5, -halfLane - 0.5].forEach((z, i) => {
      // Fence
      const fenceGeo = new THREE.PlaneGeometry(totalWidth, 0.8);
      const fenceMat = new THREE.MeshToonMaterial({
        color: 0x8B6914,
        side: THREE.DoubleSide,
      });
      const fence = new THREE.Mesh(fenceGeo, fenceMat);
      fence.position.set(0, 0.4, z);
      this.scene.add(fence);

      // Fence posts
      for (let p = 0; p < 6; p++) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8),
          new THREE.MeshToonMaterial({ color: 0x6B4F14 })
        );
        post.position.set(-totalWidth / 2 + 1 + p * (totalWidth / 5), 0.45, z);
        this.scene.add(post);
      }
    });

    // Side grass decoration — small, far from lanes
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
    // Scale based on tier
    const baseScale = 1.4 + (tier - 1) * 0.3;
    model.scale.setScalar(baseScale);

    // Position in the correct lane
    const laneX = this.laneXPositions[lane] || 0;
    const halfLane = GAME_CONFIG.LANE_HEIGHT / 2;
    const startZ = direction === 1 ? halfLane : -halfLane;

    model.position.set(laneX, 0, startZ);

    // Face march direction — P1 marches toward -Z (top), P2 toward +Z (bottom)
    if (direction === 1) {
      model.rotation.y = Math.PI; // face -Z (toward top/enemy base)
    }
    // direction === -1: default orientation faces +Z (toward bottom/enemy base)

    this.scene.add(model);

    const unit = {
      id,
      model,
      side,
      tier,
      direction,
      lane,
      hp: data.hp || config.hp,
      maxHp: config.hp,
      state: data.state || 'march',
      z: startZ,
    };

    this.units.set(id, unit);
  }

  update(dt) {
    if (!this.gameActive) return;

    // Animate units — gentle bob
    for (const [, unit] of this.units) {
      if (unit.state !== 'dead') {
        unit.model.position.y = Math.sin(Date.now() * 0.005 + unit.id * 50) * 0.04;
      }
    }
  }

  onServerState(state) {
    if (!state.units) return;

    const serverIds = new Set(state.units.map((u) => u.id));

    // Remove units that server no longer tracks
    for (const [id, unit] of this.units) {
      if (!serverIds.has(id)) {
        this.spawnDeathParticles(unit.model.position.clone(), unit.side);
        this.scene.remove(unit.model);
        this.units.delete(id);
      }
    }

    // Add/update units
    for (const su of state.units) {
      let unit = this.units.get(su.id);

      if (!unit) {
        // New unit — spawn it
        this.spawnUnit(su);
        unit = this.units.get(su.id);
      }

      if (unit) {
        // Update position
        const laneX = this.laneXPositions[su.lane] || 0;
        unit.model.position.x = laneX;
        unit.model.position.z = su.z;
        unit.z = su.z;
        unit.hp = su.hp;
        unit.state = su.state;

        // Flash red when fighting
        if (su.state === 'fight' && !unit._fighting) {
          unit._fighting = true;
          unit._fightFlash = setInterval(() => {
            if (unit.state !== 'fight') {
              clearInterval(unit._fightFlash);
              unit._fighting = false;
              return;
            }
            // Quick shake
            unit.model.position.x = laneX + (Math.random() - 0.5) * 0.08;
          }, 100);
        }
        if (su.state !== 'fight' && unit._fighting) {
          clearInterval(unit._fightFlash);
          unit._fighting = false;
          unit.model.position.x = laneX;
        }
      }
    }

    // Update UI
    if (state.playerHP) {
      this.ui.updateHP(state.playerHP, this.gameData);
    }
    if (state.energies) {
      const myEnergy = state.energies[this.network.playerId];
      if (myEnergy !== undefined) {
        this.ui.updateEnergy(myEnergy, GAME_CONFIG.MAX_ENERGY);
        this.ui.updateSpawnButtons(myEnergy);
      }
    }
  }

  onRoundEnd(data) {
    // Not used in HP-pool mode — game ends when HP reaches 0
  }

  spawnDeathParticles(pos, side) {
    const color = side === 'pig' ? 0xffb0c8 : 0xffe066;
    const particles = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshToonMaterial({ color })
      );
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

  destroy() {
    this.gameActive = false;
    this.sceneManager.onUpdate = null;
    for (const [, unit] of this.units) {
      if (unit._fightFlash) clearInterval(unit._fightFlash);
      this.scene.remove(unit.model);
    }
    this.units.clear();
  }
}
