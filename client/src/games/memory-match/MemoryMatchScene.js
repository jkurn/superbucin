import { EventBus } from '../../shared/EventBus.js';

export class MemoryMatchScene {
  constructor(sceneManager, network, ui, gameData) {
    this.sceneManager = sceneManager;
    this.network = network;
    this.ui = ui;
    this.gameData = gameData;
    this.rootEl = null;
    this.boardWrap = null;
    this._onMemoryState = (s) => this._applyState(s);
  }

  init() {
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = 'hidden';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'memory-match-layer';
    const overlay = document.getElementById('ui-overlay');
    overlay.appendChild(this.rootEl);

    this.boardWrap = document.createElement('div');
    this.boardWrap.className = 'memory-board-wrap';
    this.rootEl.appendChild(this.boardWrap);

    EventBus.on('memory:state', this._onMemoryState);
    if (this.gameData.memory) {
      this._applyState(this.gameData.memory);
    }
  }

  _renderFace(face) {
    const wrap = document.createElement('div');
    wrap.className = 'memory-face';
    if (!face) return wrap;
    if (face.type === 'image') {
      const img = document.createElement('img');
      img.className = 'memory-face-img';
      img.src = face.value;
      img.alt = face.alt || '';
      img.draggable = false;
      wrap.appendChild(img);
    } else if (face.type === 'emoji') {
      const span = document.createElement('span');
      span.className = 'memory-face-emoji';
      span.textContent = face.value;
      wrap.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'memory-face-text';
      span.textContent = face.value;
      wrap.appendChild(span);
    }
    return wrap;
  }

  _buildBoard(gridSize, slotCount) {
    this.boardWrap.dataset.grid = String(gridSize);
    this.boardWrap.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'memory-board';
    board.style.gridTemplateColumns = `repeat(${gridSize}, minmax(0, 1fr))`;

    for (let i = 0; i < slotCount; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memory-card';
      btn.dataset.idx = String(i);
      btn.innerHTML = `
        <div class="memory-card-inner">
          <div class="memory-card-face memory-card-back">💕</div>
          <div class="memory-card-face memory-card-front"></div>
        </div>
      `;
      btn.addEventListener('click', () => this._onCardClick(i));
      board.appendChild(btn);
    }
    this.boardWrap.appendChild(board);
    this.boardEl = board;
  }

  _onCardClick(index) {
    const state = this.lastState;
    if (!state) return;
    if (state.currentTurn !== this.network.playerId) return;
    const slot = state.slots[index];
    if (!slot || slot.state !== 'hidden') return;
    this.network.memoryFlip(index);
  }

  _applyState(state) {
    this.lastState = state;
    const n = state.gridSize || 4;
    const total = n * n;
    if (!this.boardEl || this.boardWrap.dataset.grid !== String(n)) {
      this._buildBoard(n, total);
    }

    const pid = this.network.playerId;
    const myScore = state.scores[pid] ?? 0;
    const oppId = Object.keys(state.scores).find((k) => k !== pid);
    const oppScore = oppId ? state.scores[oppId] ?? 0 : 0;

    const elMy = document.getElementById('mem-my-pairs');
    const elOpp = document.getElementById('mem-opp-pairs');
    const elTurn = document.getElementById('mem-turn');
    const elTimer = document.getElementById('mem-timer');
    const elProg = document.getElementById('mem-progress');
    if (elMy) elMy.textContent = String(myScore);
    if (elOpp) elOpp.textContent = String(oppScore);
    if (elTurn) {
      const mine = state.currentTurn === pid;
      elTurn.textContent = mine ? 'Your turn ✨' : "Sayang's turn 💕";
      elTurn.classList.toggle('mem-turn-mine', mine);
    }
    if (elTimer) {
      if (state.speedMode) {
        elTimer.style.display = '';
        elTimer.textContent = `⏱ ${state.elapsedSec ?? 0}s`;
      } else {
        elTimer.style.display = 'none';
      }
    }
    if (elProg) {
      elProg.textContent = `${state.pairsFound ?? 0} / ${state.totalPairs ?? total / 2} pairs`;
    }

    state.slots.forEach((slot, i) => {
      const btn = this.boardEl.querySelector(`[data-idx="${i}"]`);
      if (!btn) return;
      const inner = btn.querySelector('.memory-card-inner');
      const front = btn.querySelector('.memory-card-front');

      if (slot.state === 'hidden') {
        inner.classList.remove('is-revealed', 'is-matched');
        front.replaceChildren();
        btn.disabled = state.currentTurn !== pid;
        return;
      }

      inner.classList.add('is-revealed');
      front.replaceChildren(this._renderFace(slot.face));
      if (slot.state === 'matched') {
        inner.classList.add('is-matched');
      } else {
        inner.classList.remove('is-matched');
      }
      btn.disabled = true;
    });
  }

  destroy() {
    EventBus.off('memory:state', this._onMemoryState);
    this.rootEl?.remove();
    this.rootEl = null;
    this.boardEl = null;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) canvas.style.visibility = '';
  }
}
