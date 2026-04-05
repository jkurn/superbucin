# UIManager.js Breakup Plan

> Generated from retro analysis (2026-04-06). UIManager.js is a 1,073-line God Object touched 18/34 commits (53%). This plan breaks it into screen modules.

## Target Structure

```
client/src/
  screens/
    LobbyScreen.js           ← 148 lines (game grid, options, create/join)
    AuthScreen.js             ← 170 lines (login, signup, forgot pw, reset pw)
    ProfileScreen.js          ← 217 lines (own profile, 4 tabs)
    PublicProfileScreen.js    ← 116 lines (read-only, fetches /api/profile)
    SideSelectScreen.js       ← 81 lines
    WaitingRoomScreen.js      ← 47 lines
    VictoryScreen.js          ← 63 lines
    DisconnectScreen.js       ← 38 lines
    JoiningRoomScreen.js      ← 13 lines
    GameScreen.js             ← 44 lines (delegates to game modules)
  shared/
    UIManager.js              ← ~100 lines (thin orchestrator, same public API)
    ui/
      toasts.js               ← showError, showAchievementToast
      UserBar.js              ← renderUserBar, bindUserBar
      constants.js            ← AVATARS array (single source of truth)
      timeAgo.js              ← date formatting helper
```

## Screen Module Interface

```javascript
// Every screen exports:
export function render(overlay, deps, options?) { ... }

// deps object:
{ network, sceneManager, userManager, router, showScreen }

// showScreen callback for navigation:
deps.showScreen('lobby')  // → UIManager.showLobby()
```

## Implementation Order (Lowest Risk First)

### Phase 1: Extract shared utilities (no behavior change)
1. `ui/toasts.js` — extract showError + showAchievementToast
2. `ui/constants.js` — extract AVATARS (deduplicate from UIManager + UserManager)
3. `ui/timeAgo.js` — extract date formatter

### Phase 2: Extract simple leaf screens
4. `JoiningRoomScreen.js` (13 lines, zero deps)
5. `DisconnectScreen.js` (38 lines)
6. `WaitingRoomScreen.js` (47 lines)

### Phase 3: Extract auth flow
7. `AuthScreen.js` (login + signup + forgot + reset password)

### Phase 4: Extract profile screens
8. `PublicProfileScreen.js` (async fetch, read-only)
9. `ProfileScreen.js` (4 tabs, settings save)

### Phase 5: Extract game-adjacent screens
10. `SideSelectScreen.js`
11. `VictoryScreen.js`
12. `GameScreen.js`

### Phase 6: Extract lobby (biggest, last)
13. `LobbyScreen.js` + `ui/UserBar.js`

### Phase 7: Final cleanup
14. UIManager.js → thin orchestrator (~100 lines)
15. Full manual QA

## Key Constraints

- **UIManager public API stays identical** — NetworkManager, Router, and game scenes keep calling `this.ui.showLobby()`, etc.
- **No server changes** — purely client-side refactor
- **No bundler changes** — Vite handles new imports automatically
- **No CSS changes** — screens write to overlay.innerHTML as before

## Dependencies to Watch

- `MEMORY_PACK_CHOICES` import moves from UIManager → LobbyScreen
- `AVATARS` deduplication from UIManager + UserManager → constants.js
- Game scenes access `this.ui.activeHUD` — UIManager keeps these proxy methods
- NetworkManager has 13 call sites into UIManager — all still work via facade
