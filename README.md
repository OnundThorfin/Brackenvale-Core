# Brackenvale Core v0.2.3

A lightweight Foundry VTT module for the Brackenvale campaign.

## Target versions

- Foundry Virtual Tabletop 14, Build 365
- Dungeons & Dragons Fifth Edition 5.3.3

## Features

- Persistent, always-visible Brackenvale overlay on every scene
- Click the overlay to open the full dashboard
- Complete nine-month Brackenvale calendar
- 44 days per month and the 22-name weekday cycle
- Automatic seasons and holidays
- Birthdays and old campaign-session events omitted
- Daily 2d6 seasonal weather generation
- Weather effects: Impeded Travel, Poor Visibility, Wet Conditions, and Exposure
- Persistent party Travel Point tracker
- Current location and campaign notes
- GM quick controls on the overlay for advancing one day, generating weather, and spending one Travel Point
- Full GM controls with player-readable display

## Updating from v0.1.0

1. Stop Foundry.
2. Replace the existing `brackenvale-core` module folder with the folder from this package.
3. Restart Foundry and reload the world.

Your calendar, weather history, Travel Points, location, and campaign notes are stored as world settings and should remain intact.

## Fresh installation

1. Unzip the package.
2. Place the entire `brackenvale-core` folder in your Foundry user-data module directory:
   - Windows: `%localappdata%/FoundryVTT/Data/modules/`
   - macOS: `~/Library/Application Support/FoundryVTT/Data/modules/`
3. Restart Foundry.
4. Open your Brackenvale world.
5. Go to **Game Settings → Manage Modules**.
6. Enable **Brackenvale Core** and reload the world.

## Using the overlay

The compact overlay appears near the upper-right corner of the game canvas for GMs and players.

- Click anywhere on it to open the full Brackenvale Core dashboard.
- GMs also see three small quick-action buttons:
  - Advance one day
  - Generate weather
  - Spend one Travel Point

## Other ways to open the dashboard

- Open the **Game Settings** sidebar and click **Open Brackenvale Core**.
- Type `/brackenvale` in chat.
- Create a Script Macro containing:

```javascript
game.brackenvaleCore.open();
```

## Important testing note

Back up your world before installing or updating any module. After updating, test the overlay, date advancement, weather generation, Travel Points, and data persistence before a live session.


## v0.2.3
- Stabilizes dashboard refreshes after Save Changes.
- Makes the persistent overlay draggable.
- Adds minimize/expand and reset-position controls.
- Saves overlay position and minimized state separately for each user.


## 0.2.3
- Restored Foundry's native dashboard X/close control.
- Added an overlay button to refund one Travel Point.
- Replaced the weather quick-action die with a rain-cloud icon.
