# UI Regression Checklist

Use this quick pass after CSS refactors or UI layout changes.

## Lobby
- App loads and lobby renders without visual flash or missing styles.
- Game cards appear in a 2-column grid and remain tappable.
- Lobby scroll works on small viewport (no clipped game cards).
- Create room / join room controls are aligned and readable.

## Room
- Room code input and room code display styles are intact.
- Waiting state text animates and share-link feedback appears correctly.
- Side select cards show selected/suggested states.

## Game Screens
- In-game HUD overlays are visible and not blocked by `#ui-overlay`.
- Countdown, reconnect, and victory overlays render above gameplay.
- At least one run each for: Memory Match, Doodle Guess, Speed Match, Vending, Bonk Brawl, Cute Aggression.

## Profile
- User bar avatar/name/points render correctly.
- Profile screen tabs switch cleanly (stats, achievements, history, rivals, settings).
- Achievement toast and error toast render in expected positions.

## Mobile Safe Area / Responsiveness
- iPhone-sized viewport check (`390x844` equivalent): no bottom controls are clipped.
- `safe-area-inset-bottom` padding is preserved on bottom action bars.
- `max-width: 360px` rules still keep controls readable and tappable.
- Landscape mode still keeps overlays and controls usable.
