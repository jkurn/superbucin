import { MEMORY_MATCH_CONFIG } from './config.js';
import { getPairs } from './packs.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSlots(pairs) {
  const cards = [];
  pairs.forEach((p) => {
    cards.push({ pairId: p.pairId, variant: 0, face: p.a });
    cards.push({ pairId: p.pairId, variant: 1, face: p.b });
  });
  return shuffle(cards);
}

export class MemoryMatchGameState {
  constructor(player1, player2, emitCallback, roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;
    this.roomOptions = {
      packId: roomOptions.packId || MEMORY_MATCH_CONFIG.DEFAULT_PACK,
      gridSize: roomOptions.gridSize || MEMORY_MATCH_CONFIG.DEFAULT_GRID,
      speedMode: roomOptions.speedMode ?? MEMORY_MATCH_CONFIG.SPEED_MODE_DEFAULT,
    };

    this.gridSize = this.roomOptions.gridSize >= 6 ? 6 : 4;
    this.pairCount = this.gridSize * this.gridSize / 2;
    this.packId = this.roomOptions.packId;
    this.speedMode = !!this.roomOptions.speedMode;

    this.slots = [];
    this.matched = new Set();
    this.selection = [];
    this.scores = { [player1.id]: 0, [player2.id]: 0 };
    this.currentTurn = player1.id;
    this.pendingTimer = null;
    this.speedTimer = null;
    this.startedAt = null;
    this.active = false;
  }

  start() {
    this.active = true;
    const pairs = getPairs(this.packId, this.gridSize).slice(0, this.pairCount);
    if (pairs.length < this.pairCount) {
      console.warn(`Memory match: pack ${this.packId} short on pairs; got ${pairs.length}, need ${this.pairCount}`);
    }
    this.slots = buildSlots(pairs.slice(0, this.pairCount));
    this.matched.clear();
    this.selection = [];
    this.scores[this.p1.id] = 0;
    this.scores[this.p2.id] = 0;
    this.currentTurn = this.p1.id;
    this.startedAt = Date.now();

    if (this.speedTimer) clearInterval(this.speedTimer);
    if (this.speedMode) {
      this.speedTimer = setInterval(() => this.broadcastState(), 1000);
    }

    this.broadcastState();
  }

  stop() {
    this.active = false;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
  }

  pause() {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
  }

  resume() {
    if (!this.active) return;
    if (this.speedMode && !this.speedTimer) {
      this.speedTimer = setInterval(() => {
        this.elapsedSec = Math.floor((Date.now() - this.startedAt) / 1000);
        this.broadcastState();
      }, 1000);
    }
  }

  tryFlip(socketId, index) {
    if (!this.active) return;
    if (socketId !== this.currentTurn) return;
    if (this.pendingTimer) return;
    if (typeof index !== 'number' || index < 0 || index >= this.slots.length) return;
    if (this.matched.has(index)) return;
    if (this.selection.includes(index)) return;

    this.selection.push(index);
    this.broadcastState();

    if (this.selection.length < 2) return;

    const i0 = this.selection[0];
    const i1 = this.selection[1];
    const s0 = this.slots[i0];
    const s1 = this.slots[i1];
    const isMatch = s0 && s1 && s0.pairId === s1.pairId;

    if (isMatch) {
      this.matched.add(i0);
      this.matched.add(i1);
      this.scores[socketId] += 1;
      this.selection = [];
      this.broadcastState();

      if (this.matched.size >= this.slots.length) {
        this.endMatch();
      }
      return;
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.selection = [];
      this.currentTurn = socketId === this.p1.id ? this.p2.id : this.p1.id;
      this.broadcastState();
    }, MEMORY_MATCH_CONFIG.MISMATCH_MS);
  }

  endMatch() {
    const s1 = this.scores[this.p1.id];
    const s2 = this.scores[this.p2.id];
    let winnerId = null;
    if (s1 > s2) winnerId = this.p1.id;
    else if (s2 > s1) winnerId = this.p2.id;

    this.stop();
    this.emit('match-end', {
      winnerId,
      scores: [s1, s2],
      tie: winnerId === null,
    });
  }

  getStateForSocket(socketId) {
    const slots = this.slots.map((slot, idx) => {
      if (this.matched.has(idx)) {
        return { state: 'matched', face: slot.face };
      }
      if (this.selection.includes(idx)) {
        return { state: 'faceup', face: slot.face };
      }
      return { state: 'hidden' };
    });

    return {
      gridSize: this.gridSize,
      packId: this.packId,
      speedMode: this.speedMode,
      elapsedSec: this.speedMode && this.startedAt
        ? Math.floor((Date.now() - this.startedAt) / 1000)
        : 0,
      scores: { ...this.scores },
      currentTurn: this.currentTurn,
      slots,
      selectionLen: this.selection.length,
      pairsFound: this.matched.size / 2,
      totalPairs: this.slots.length / 2,
      youAreHost: socketId === this.p1.id,
    };
  }

  broadcastState() {
    if (!this.active) return;
    this.emit('memory-state', {
      p1: this.getStateForSocket(this.p1.id),
      p2: this.getStateForSocket(this.p2.id),
    });
  }

  /** Used when reconnecting mid-game */
  getReconnectPayload(socketId) {
    return {
      memory: this.getStateForSocket(socketId),
    };
  }
}
