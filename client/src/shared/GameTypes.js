/**
 * Shared JSDoc type definitions for the game registration interface.
 *
 * These types standardise the shape every game module must export so that
 * inconsistencies (e.g. `id` vs `side` in side-option objects) are caught
 * by IDE tooling instead of at runtime.
 *
 * Import this file for the types only — it has no runtime exports.
 *
 * @module GameTypes
 */

// ---------------------------------------------------------------------------
// Side / role selection
// ---------------------------------------------------------------------------

/**
 * A selectable side or role a player can pick before the game starts.
 *
 * Canonical key is `side`.  Some older games still use `id` in lobby.sides —
 * new games MUST use `side` everywhere.
 *
 * @typedef {Object} GameSideOption
 * @property {string} side  - Machine-readable identifier (e.g. "pig", "black", "drawer")
 * @property {string} label - Human-readable name shown in the UI
 * @property {string} emoji - Emoji displayed alongside the label
 */

// ---------------------------------------------------------------------------
// Lobby card
// ---------------------------------------------------------------------------

/**
 * Metadata shown on the lobby card for a game.
 *
 * `sides` is optional — games without side selection (e.g. Speed Match)
 * omit it entirely.
 *
 * @typedef {Object} GameLobbyConfig
 * @property {string}              name  - Display name (e.g. "Pig vs Chick")
 * @property {string}              icon  - Emoji or icon string for the card
 * @property {string}              badge - Short descriptor (e.g. "2 Players")
 * @property {GameSideOption[]}    [sides] - Selectable sides shown on the lobby card
 */

// ---------------------------------------------------------------------------
// Side-select screen
// ---------------------------------------------------------------------------

/**
 * Configuration for the side-selection overlay shown after joining a room.
 *
 * Games that don't require side selection omit the `sideSelect` property
 * from their GameDefinition entirely.
 *
 * @typedef {Object} GameSideSelectConfig
 * @property {string}            title     - Header text (e.g. "PIG vs CHICK")
 * @property {string}            pickTitle - Prompt text (e.g. "Pick your side!")
 * @property {GameSideOption[]}  options   - Available sides/roles
 */

// ---------------------------------------------------------------------------
// Victory messages
// ---------------------------------------------------------------------------

/**
 * Random victory / defeat messages shown at end-of-game.
 *
 * @typedef {Object} GameVictoryMessages
 * @property {string[]}  win  - Messages shown to the winner
 * @property {string[]}  lose - Messages shown to the loser
 * @property {string[]}  [draw] - Messages shown on a draw (optional)
 */

// ---------------------------------------------------------------------------
// HUD updater
// ---------------------------------------------------------------------------

/**
 * Object returned by `createHUD` — holds methods the engine calls each tick
 * to keep the overlay in sync with game state.
 *
 * Only `destroy` is mandatory; every other method is game-specific.
 *
 * @typedef {Object} GameHUDUpdater
 * @property {Function} [destroy] - Tear down DOM, timers, and event listeners
 */

// ---------------------------------------------------------------------------
// Full game definition
// ---------------------------------------------------------------------------

/**
 * The complete module shape every game must export and register via
 * `GameRegistry.register(type, module)`.
 *
 * @typedef {Object} GameDefinition
 * @property {string}                type            - Unique game identifier (e.g. "othello")
 * @property {GameLobbyConfig}       lobby           - Lobby card metadata
 * @property {GameSideSelectConfig}  [sideSelect]    - Side-selection config (optional)
 * @property {GameVictoryMessages}   [victoryMessages] - End-of-game messages (optional)
 * @property {Function}              Scene           - The scene class (constructor / ES class)
 * @property {Function}              applyConfig     - Applies server-sent config to local constants
 * @property {function(HTMLElement, Object, Object): GameHUDUpdater} createHUD
 *   Build the game-specific HUD inside `overlay` and return an updater.
 *   Parameters: (overlay, data, network)
 */

export {};
