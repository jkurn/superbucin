export function render(overlay, deps) {
  overlay.innerHTML = `
    <div class="victory-overlay">
      <div class="victory-text">Opponent disconnected \ud83d\ude22</div>
      <button class="btn btn-pink" id="btn-lobby" style="margin-top:1.5rem;">Back to Lobby</button>
    </div>
  `;
  document.getElementById('btn-lobby').addEventListener('click', () => {
    deps.showScreen('lobby');
  });
}
