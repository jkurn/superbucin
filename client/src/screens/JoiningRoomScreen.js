export function render(overlay, _deps, code) {
  overlay.innerHTML = `
    <div class="lobby-ui">
      <div class="lobby-title">SUPERBUCIN</div>
      <div class="lobby-subtitle">sayang's game collection</div>
      <div class="room-section">
        <div class="waiting-text">Joining room ${code}...</div>
      </div>
    </div>
  `;
}
