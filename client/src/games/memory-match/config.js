/** Host lobby — keep ids in sync with server `PACKS` */
export const MEMORY_PACK_CHOICES = [
  { id: 'photo', label: '📸 Photo — selfie ↔ nickname' },
  { id: 'nickname', label: '🤏 Nickname — text ↔ emoji' },
  { id: 'inside-joke', label: '🍩 Inside joke — your phrases' },
  { id: 'emoji', label: '🦐 Emoji — meaning for you two' },
];

export let GAME_CONFIG = {
  mismatchMs: 900,
  packs: [],
  defaultPack: 'nickname',
  defaultGrid: 4,
  speedMode: false,
};

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = {
    ...GAME_CONFIG,
    ...serverConfig,
  };
}
