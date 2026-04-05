// Doodle Guess — draw & guess with relationship-themed prompts

/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { DoodleGuessScene } from './DoodleGuessScene.js';
import { DOODLE_CONFIG, applyServerConfig } from './config.js';

function drawSegment(ctx, segment, w, h) {
  if (!segment?.points?.length) return;
  const { points, color, width } = segment;
  ctx.strokeStyle = color || '#1a1a2e';
  ctx.lineWidth = (width || 3) * Math.min(w, h) / 400;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const [fx, fy] = points[0];
  ctx.moveTo(fx * w, fy * h);
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    ctx.lineTo(x * w, y * h);
  }
  ctx.stroke();
}

/** Labels for the lobby pack picker — keep ids in sync with server `DOODLE_PACKS_BY_ID` */
export const DOODLE_PROMPT_PACKS = [
  { id: 'couples', name: 'Love & us', emoji: '💕' },
  { id: 'animals', name: 'Animals', emoji: '🐾' },
  { id: 'food', name: 'Food & drinks', emoji: '🍕' },
  { id: 'actions', name: 'Actions & verbs', emoji: '🏃' },
  { id: 'places', name: 'Places', emoji: '🌍' },
  { id: 'movies_vibes', name: 'Movies & vibes', emoji: '🎬' },
  { id: 'objects', name: 'Random objects', emoji: '🎲' },
  { id: 'custom', name: 'Custom only', emoji: '✨' },
];

/** @type {GameDefinition} */
export const doodleGuessGame = {
  type: 'doodle-guess',
  lobby: {
    name: 'Doodle Guess',
    icon: '✏️💕',
    badge: '2 Players · Packs',
  },
  promptPacks: DOODLE_PROMPT_PACKS,
  sideSelect: {
    title: 'DOODLE GUESS',
    pickTitle: 'Pick your role!',
    options: [
      { side: 'drawer', emoji: '✏️', label: 'Drawer' },
      { side: 'guesser', emoji: '💭', label: 'Guesser' },
    ],
  },
  Scene: DoodleGuessScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, data, network) {
    applyServerConfig(data.gameConfig);
    const myId = network.playerId;
    let youAreDrawer = false;
    let phase = 'drawing';
    let timerId = null;
    let blockKeyHandler = null;

    const root = document.createElement('div');
    root.className = 'doodle-root';
    root.innerHTML = `
      <div class="doodle-topbar">
        <div class="doodle-scores" id="doodle-scores">0 — 0</div>
        <div class="doodle-round" id="doodle-round">Round 1 / ${DOODLE_CONFIG.TOTAL_ROUNDS}</div>
        <div class="doodle-timer" id="doodle-timer">30</div>
      </div>
      <div class="doodle-pack-chip" id="doodle-pack-chip"></div>
      <div class="doodle-role" id="doodle-role"></div>
      <div class="doodle-prompt-box" id="doodle-prompt-box" style="display:none;">
        <span class="doodle-prompt-label">Draw this:</span>
        <span class="doodle-prompt-text" id="doodle-prompt-text"></span>
      </div>
      <div class="doodle-canvas-wrap" id="doodle-canvas-wrap">
        <canvas class="doodle-canvas" id="doodle-canvas" width="800" height="520"></canvas>
      </div>
      <div class="doodle-hint" id="doodle-hint">Waiting for state…</div>
      <div class="doodle-drawer-tools" id="doodle-drawer-tools" style="display:none;">
        <div class="doodle-colors" id="doodle-colors"></div>
        <button type="button" class="btn btn-blue btn-small doodle-clear-btn" id="doodle-clear-btn">Clear canvas</button>
      </div>
      <div class="doodle-guess-row" id="doodle-guess-row" style="display:none;">
        <input type="text" class="doodle-guess-input" id="doodle-guess-input" placeholder="Type your guess…" maxlength="120" autocomplete="off" />
        <button type="button" class="btn btn-pink btn-small" id="doodle-guess-btn">Guess</button>
      </div>
      <div class="doodle-result" id="doodle-result" style="display:none;"></div>
    `;
    overlay.appendChild(root);

    const packChip = root.querySelector('#doodle-pack-chip');
    const packs = data.gameConfig?.packs || [];
    const pid = data.doodlePackId || data.gameConfig?.defaultPackId || 'couples';
    const meta = packs.find((p) => p.id === pid);
    if (packChip) {
      packChip.textContent = meta ? `${meta.emoji} ${meta.name}` : '';
    }

    const canvas = root.querySelector('#doodle-canvas');
    const ctx = canvas.getContext('2d');
    const scoresEl = root.querySelector('#doodle-scores');
    const roundEl = root.querySelector('#doodle-round');
    const timerEl = root.querySelector('#doodle-timer');
    const roleEl = root.querySelector('#doodle-role');
    const promptBox = root.querySelector('#doodle-prompt-box');
    const promptText = root.querySelector('#doodle-prompt-text');
    const hintEl = root.querySelector('#doodle-hint');
    const drawerTools = root.querySelector('#doodle-drawer-tools');
    const guessRow = root.querySelector('#doodle-guess-row');
    const guessInput = root.querySelector('#doodle-guess-input');
    const guessBtn = root.querySelector('#doodle-guess-btn');
    const resultEl = root.querySelector('#doodle-result');
    const colorRow = root.querySelector('#doodle-colors');
    const clearBtn = root.querySelector('#doodle-clear-btn');

    const colors = ['#1a1a2e', '#e63946', '#2a9d8f', '#e9c46a', '#264653', '#8338ec'];
    let currentColor = colors[0];
    let currentWidth = 4;

    colors.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'doodle-color-swatch';
      b.style.background = c;
      b.dataset.color = c;
      b.addEventListener('click', () => {
        currentColor = c;
        colorRow.querySelectorAll('.doodle-color-swatch').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
      colorRow.appendChild(b);
    });
    colorRow.querySelector('.doodle-color-swatch')?.classList.add('active');

    function canvasSize() {
      const wrap = root.querySelector('#doodle-canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(200, Math.floor(rect.width));
      const h = Math.max(180, Math.floor(rect.width * 0.55));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    function fillPaper() {
      const { w, h } = canvasSize();
      ctx.fillStyle = '#fff8f5';
      ctx.fillRect(0, 0, w, h);
      return { w, h };
    }

    let localSegments = [];

    fillPaper();

    let drawing = false;
    let currentPoints = [];
    let remoteSegments = [];

    function normPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
    }

    function sendStroke(seg) {
      if (!youAreDrawer || phase !== 'drawing') return;
      network.socket.emit('doodle-stroke', {
        points: seg.points,
        color: seg.color,
        width: seg.width,
      });
    }

    function redrawDrawerCanvas() {
      const { w, h } = canvasSize();
      ctx.fillStyle = '#fff8f5';
      ctx.fillRect(0, 0, w, h);
      localSegments.forEach((seg) => drawSegment(ctx, seg, w, h));
      if (currentPoints.length > 0) {
        drawSegment(ctx, { points: currentPoints, color: currentColor, width: currentWidth }, w, h);
      }
    }

    function redrawGuesserCanvas() {
      const { w, h } = canvasSize();
      ctx.fillStyle = '#fff8f5';
      ctx.fillRect(0, 0, w, h);
      remoteSegments.forEach((seg) => drawSegment(ctx, seg, w, h));
    }

    function onPointerDown(e) {
      if (!youAreDrawer || phase !== 'drawing') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      currentPoints = [normPoint(e)];
      redrawDrawerCanvas();
    }

    function onPointerMove(e) {
      if (!drawing || !youAreDrawer || phase !== 'drawing') return;
      e.preventDefault();
      currentPoints.push(normPoint(e));
      redrawDrawerCanvas();
    }

    function onPointerUp(e) {
      if (!drawing || !youAreDrawer) return;
      e.preventDefault();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) { /* ignore */ }
      drawing = false;
      if (currentPoints.length === 0) return;
      const seg = { points: [...currentPoints], color: currentColor, width: currentWidth };
      currentPoints = [];
      if (seg.points.length < 2) {
        redrawDrawerCanvas();
        return;
      }
      localSegments.push(seg);
      sendStroke(seg);
      redrawDrawerCanvas();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    clearBtn.addEventListener('click', () => {
      if (!youAreDrawer || phase !== 'drawing') return;
      localSegments = [];
      currentPoints = [];
      redrawDrawerCanvas();
      network.socket.emit('doodle-clear');
    });

    function submitGuess() {
      const t = guessInput.value.trim();
      if (!t || phase !== 'drawing') return;
      network.socket.emit('doodle-guess', { text: t });
      guessInput.value = '';
    }
    guessBtn.addEventListener('click', submitGuess);
    guessInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitGuess();
    });

    function scoreLine(scores) {
      const ids = Object.keys(scores);
      if (ids.length < 2) return '0 — 0';
      const mine = scores[myId] ?? 0;
      const theirs = ids.filter((id) => id !== myId).map((id) => scores[id] ?? 0)[0] ?? 0;
      return `${mine} — ${theirs}`;
    }

    function updateTimer(endsAt) {
      if (timerId) clearInterval(timerId);
      timerId = null;
      const tick = () => {
        const ms = Math.max(0, endsAt - Date.now());
        timerEl.textContent = (ms / 1000).toFixed(1);
      };
      tick();
      timerId = setInterval(tick, 100);
    }

    function stopTimer() {
      if (timerId) clearInterval(timerId);
      timerId = null;
    }

    function setBlockKeys(on) {
      if (blockKeyHandler) {
        window.removeEventListener('keydown', blockKeyHandler, true);
        blockKeyHandler = null;
      }
      if (!on) return;
      blockKeyHandler = (e) => {
        if (!youAreDrawer || phase !== 'drawing') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (['Escape', 'Tab', 'Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return;
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
        }
        if (e.key.length === 1 || e.key === 'Enter') {
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', blockKeyHandler, true);
    }

    function applyState(st) {
      phase = st.phase || 'drawing';
      youAreDrawer = Boolean(st.youAreDrawer);
      scoresEl.textContent = scoreLine(st.scores || {});
      roundEl.textContent = `Round ${st.round} / ${st.totalRounds}`;

      if (phase === 'drawing' && st.endsAt) {
        updateTimer(st.endsAt);
      } else {
        stopTimer();
        if (st.endsAt && phase === 'round_result') {
          timerEl.textContent = '0.0';
        }
      }

      if (phase === 'drawing') {
        resultEl.style.display = 'none';
        resultEl.textContent = '';
        if (youAreDrawer) {
          roleEl.textContent = '✏️ You are drawing';
          hintEl.textContent = 'No letters, numbers, or symbols — pictures only!';
          promptBox.style.display = 'flex';
          promptText.textContent = st.prompt || '…';
          drawerTools.style.display = 'flex';
          guessRow.style.display = 'none';
          canvas.style.pointerEvents = 'auto';
          canvas.style.opacity = '1';
          setBlockKeys(true);
        } else {
          roleEl.textContent = '🔮 You are guessing';
          hintEl.textContent = 'Guess what sayang is drawing!';
          promptBox.style.display = 'none';
          drawerTools.style.display = 'none';
          guessRow.style.display = 'flex';
          canvas.style.pointerEvents = 'none';
          canvas.style.opacity = '1';
          setBlockKeys(false);
        }
        if (st.lastResult) {
          /* ignore stale */
        }
      }

      if (phase === 'round_result' && st.lastResult) {
        setBlockKeys(false);
        canvas.style.pointerEvents = 'none';
        drawerTools.style.display = 'none';
        guessRow.style.display = 'none';
        const lr = st.lastResult;
        if (lr.correct) {
          resultEl.style.display = 'block';
          resultEl.className = 'doodle-result doodle-result-ok';
          resultEl.textContent = `Nailed it! +${lr.points} pts — "${lr.answer}"`;
        } else {
          resultEl.style.display = 'block';
          resultEl.className = 'doodle-result doodle-result-miss';
          resultEl.textContent = lr.timedOut
            ? `Time's up! It was: "${lr.answer}"`
            : `Round over — "${lr.answer}"`;
        }
      }

      if (phase === 'game_over') {
        setBlockKeys(false);
      }
    }

    function onDoodleState(st) {
      if (st.phase === 'drawing') {
        if (st.youAreDrawer) {
          localSegments = [];
          currentPoints = [];
          redrawDrawerCanvas();
        } else {
          remoteSegments = [];
          redrawGuesserCanvas();
        }
      }
      applyState(st);
    }

    function onDoodleDraw(payload) {
      if (youAreDrawer) return;
      if (payload?.points?.length >= 2) {
        remoteSegments.push(payload);
        redrawGuesserCanvas();
      }
    }

    function onDoodleClear() {
      if (youAreDrawer) return;
      remoteSegments = [];
      redrawGuesserCanvas();
    }

    function onDoodleSync(data) {
      if (!data?.strokes?.length) return;
      remoteSegments = data.strokes.filter((s) => s?.points?.length >= 2);
      redrawGuesserCanvas();
    }

    function onGuessWrong() {
      guessInput.classList.add('doodle-shake');
      setTimeout(() => guessInput.classList.remove('doodle-shake'), 400);
    }

    const sock = network.socket;
    sock.on('doodle-state', onDoodleState);
    sock.on('doodle-draw', onDoodleDraw);
    sock.on('doodle-clear', onDoodleClear);
    sock.on('doodle-sync', onDoodleSync);
    sock.on('doodle-guess-wrong', onGuessWrong);

    const ro = new ResizeObserver(() => {
      if (youAreDrawer) redrawDrawerCanvas();
      else redrawGuesserCanvas();
    });
    ro.observe(root.querySelector('#doodle-canvas-wrap'));

    return {
      destroy() {
        ro.disconnect();
        stopTimer();
        setBlockKeys(false);
        sock.off('doodle-state', onDoodleState);
        sock.off('doodle-draw', onDoodleDraw);
        sock.off('doodle-clear', onDoodleClear);
        sock.off('doodle-sync', onDoodleSync);
        sock.off('doodle-guess-wrong', onGuessWrong);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        root.remove();
      },
    };
  },
};
