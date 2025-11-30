# 💎 Gem Cascade - Production Match-3 Game

A fully-featured, responsive match-3 puzzle game built with vanilla JavaScript, HTML5, and CSS3. Designed with clean architecture, accessibility features, and extensibility in mind.

## 🎮 [Play the Game Here](https://aaronc1992.github.io/gem-match-game/)

---

## 🎮 Features

### Game Modes
- **Classic**: 30 moves to achieve the highest score
- **Time Attack**: 60 seconds of fast-paced matching
- **Endless**: Unlimited moves for relaxed play
- **Zen**: Relaxed mode with unlimited moves
- **Levels**: Progressive level-based challenges with target scores

### Core Gameplay
- **Match-3 Mechanics**: Match 3 or more gems horizontally or vertically
- **Special Gems**:
  - **Striped Gem** (⚡): Created by matching exactly 4 gems
  - **Bomb Gem** (💣): Created by matching 5+ gems
- **Cascading Combos**: Chain reactions increase your score exponentially
- **Hint System**: Auto-hint after 5 seconds of inactivity
- **Shuffle**: Reorganize the board when stuck

### UI & UX
- **Responsive Design**: Adapts seamlessly to desktop, tablet, and mobile screens
- **Pause/Resume**: Pause gameplay with dedicated button or ESC key
- **Settings Modal**: Toggle sound and color-blind mode with persistent storage
- **Achievements System**: Unlock 7+ achievements as you progress
- **High Score Tracking**: Scores persist per game mode via localStorage
- **Animated Particles**: Visual feedback for matches and special gem creation
- **Audio Feedback**: Web Audio API-based sound effects for matches, combos, specials

### Accessibility
- **Color-Blind Mode**: Applies distinct patterns to gems for improved differentiation
- **Keyboard Controls**: Mute toggle (M key), pause/resume (ESC key)
- **Touch Optimized**: Full mobile gesture support with touch event handling

---

## 🏗️ Architecture

### Design Philosophy
The codebase follows a **modular, class-based architecture** to promote maintainability, testability, and extensibility. All game constants are centralized in a `Config` object to avoid magic numbers.

### Core Classes

#### **Config**
Central configuration object storing all tunable game constants:
- Board size, gem types, and symbols
- Scoring rules (base points, combo bonuses)
- Special gem thresholds
- Animation durations
- Achievement targets

#### **Game**
Master orchestrator composing all subsystems:
- `settings`: SettingsManager
- `board`: Board
- `matches`: MatchFinder
- `cascader`: Cascader
- `renderer`: Renderer
- `animations`: AnimationManager
- `achievements`: AchievementManager
- `input`: InputController
- `eventBus`: EventBus
- `levelSystem`: LevelSystem

**Key Methods**:
- `init(mode)`: Initialize game with specified mode
- `pause()`: Pause gameplay and display modal
- `resume()`: Resume gameplay
- `end()`: Trigger game over sequence

#### **Board**
Manages board state and initialization:
- `create()`: Generate a new board with random gems
- `shuffle()`: Randomize gem positions (used when no moves available)
- `hasAvailableMove()`: Check for valid swaps
- `findAvailableMove()`: Locate next valid move for hints

#### **MatchFinder**
Detects matches and calculates match groups:
- `findMatches()`: Returns array of matched gem positions with metadata
- Categorizes matches by direction (horizontal/vertical) and length

#### **Cascader**
Handles cascading logic, gravity, and refills:
- `processAll()`: Main cascade loop (match → remove → gravity → refill → repeat)
- `animateGravityAndRefill()`: Apply gravity physics and spawn new gems
- Triggers special gem creation based on match length
- Emits events (`scoreChanged`, `specialCreated`, `cascadeComplete`)

#### **Renderer**
Optimized DOM rendering with element caching:
- `buildInitial(boardData)`: Create initial DOM representation with `elementMap`
- `renderAll(boardData)`: Update all gem elements
- `updateGem(row, col)`: Update single gem (O(1) lookup)
- `getGem(row, col)`: Retrieve cached element
- `highlight(row, col, on)`: Toggle selection highlight
- `rebuildAfterGravity(boardData)`: Rebuild after structural changes

#### **AnimationManager**
Centralized promise-based animations:
- `swap(gem1, gem2)`: Animate gem swap
- `highlightMatches(matches)`: Pulse matched gems and trigger particles
- `fadeMatches(matches)`: Fade-out and remove matched gems
- `gravityRefill()`: Timing promise for gravity animation

#### **EventBus**
Decoupled event system for subsystem communication:
- `on(event, callback)`: Register event listener
- `emit(event, payload)`: Trigger event with data

**Events**:
- `gameStarted`: { mode, moves, timeLeft }
- `scoreChanged`: { score, combo }
- `specialCreated`: { kind }
- `achievementUnlocked`: { key, name }
- `cascadeComplete`: { score }
- `levelComplete`: { level }
- `gameEnded`: { mode, score, maxCombo, totalGemsMatched }

#### **SettingsManager**
Persistent settings via localStorage:
- `toggleSound()`: Toggle audio on/off
- `setColorBlindMode(enabled)`: Enable/disable color-blind patterns
- `save()`: Persist to localStorage
- `load()`: Restore from localStorage

#### **LevelSystem**
Progressive level framework:
- `current()`: Get current level config (targetScore, moves)
- `advanceIfComplete(score)`: Check score threshold and advance
- `save()/load()`: Persist level progress

#### **AchievementManager**
Wrapper for achievement logic:
- `checkAll()`: Evaluate all achievement conditions
- `unlock(key)`: Trigger achievement unlock

#### **InputController**
Input handling and future keyboard navigation scaffold:
- Currently wraps existing mouse/touch listeners
- Prepared for keyboard cursor movement (arrow keys + Enter/Space)

---

## 📂 File Structure

```
├── index.html       # Main HTML with modals (start, game over, pause, settings, achievements)
├── game.js          # Core game logic (Config, classes, game loop, event handlers)
└── README.md        # This file
```

---

## 🎨 Responsive Design

### Dynamic Board Sizing
The board size is calculated at runtime using the `resizeLayout()` function:
- Measures available viewport space after accounting for header, controls, and padding
- Sets CSS custom property `--board-size` dynamically
- Adapts on window resize, orientation change, and initial load

### Mobile Optimizations
- Touch event handlers with `touchstart` listeners
- Prevents zoom via `ctrl+wheel`, gesture pinch, and double-tap
- Safe area insets for notched devices
- Clamp-based font and spacing scales

---

## 🔧 Extension Points

### Adding New Game Modes
1. Add mode config to `GAME_MODES` object:
```javascript
GAME_MODES.newMode = { moves: 40, time: null, name: 'New Mode' };
```
2. Update `initGame(mode)` to handle custom initialization logic
3. Add corresponding button in `index.html` with `data-mode="newMode"`

### Creating New Special Gems
1. Define threshold in `Config.specials`
2. Add detection logic in `Cascader.processAll()` within `matches.matchGroups.forEach()`
3. Update `Renderer._createGemElement()` and `Renderer.updateGem()` to render new special type
4. Add CSS styles for visual representation

### Extending the EventBus
Emit custom events anywhere:
```javascript
GameApp.eventBus.emit('customEvent', { data: 'payload' });
```
Listen to events:
```javascript
GameApp.eventBus.on('customEvent', (payload) => {
    console.log('Custom event triggered:', payload);
});
```

### Adding New Achievements
1. Add entry to `achievements` object:
```javascript
achievements.newAchievement = { unlocked: false, name: 'Name', desc: 'Description' };
```
2. Add unlock condition in `checkAchievements()`
3. Achievement popup and modal will auto-update

### Keyboard Navigation
The `InputController` class is scaffolded for keyboard controls. To implement:
1. Track cursor position (row, col)
2. Listen to arrow keys to move cursor
3. Highlight cursor position via `Renderer.highlight()`
4. Trigger swap on Enter/Space

---

## 🎯 Accessibility

### Color-Blind Mode
When enabled (`Settings > Color-Blind Mode`), applies distinct background patterns to each gem type:
- Type 0: Diagonal stripes
- Type 1: Vertical lines
- Type 2: Radial gradient overlay
- Type 3: Diagonal grid
- Type 4: Conic gradient sectors
- Type 5: Horizontal lines

Patterns are layered on top of existing gradients to preserve aesthetic while improving contrast.

### Keyboard Shortcuts
- **M**: Toggle mute
- **ESC**: Pause/Resume game

### Future Improvements
- ARIA labels for screen readers
- High contrast mode
- Configurable animation speeds

---

## 🚀 Performance

### Optimizations Implemented
- **Element Map Caching**: O(1) gem lookups via `Renderer.elementMap` instead of repeated `querySelector` calls
- **Promise-Based Animations**: Centralized timing in `AnimationManager` reduces scattered `setTimeout` calls
- **Selective DOM Updates**: `updateGem()` modifies individual gems instead of full board re-renders
- **CSS Transforms**: Hardware-accelerated animations (`transform`, `opacity`) avoid layout reflows
- **Event Delegation**: Gem click handlers attached during creation (not via bubbling)

### Performance Audit Recommendations
1. **Profile** `rebuildAfterGravity()` calls—consider selective updates instead of full rebuild
2. **Measure** FPS on low-end mobile devices during cascades
3. **Optimize** particle creation to use object pooling if count increases
4. **Monitor** localStorage read/write frequency to avoid blocking main thread

---

## 📊 Event Flow Diagram

```
User Swap
    ↓
swapGems()
    ↓
AnimationManager.swap()
    ↓
Cascader.processAll()
    ├─ MatchFinder.findMatches()
    ├─ AnimationManager.highlightMatches()
    ├─ Score Update → eventBus.emit('scoreChanged')
    ├─ Special Gem Creation → eventBus.emit('specialCreated')
    ├─ AnimationManager.fadeMatches()
    ├─ Cascader.animateGravityAndRefill()
    ├─ Renderer.rebuildAfterGravity()
    ├─ Repeat cascade loop
    └─ eventBus.emit('cascadeComplete')
    ↓
Check End Conditions
    ├─ Level Mode: LevelSystem.advanceIfComplete()
    └─ Other Modes: endGame() → eventBus.emit('gameEnded')
```

---

## 🧪 Testing Recommendations

### Manual Testing Checklist
- [ ] All 5 game modes start correctly
- [ ] Pause/Resume functionality
- [ ] Settings persist after page reload
- [ ] Color-blind mode applies patterns correctly
- [ ] Achievements unlock and display in modal
- [ ] High scores save per mode
- [ ] Hint system triggers after 5s inactivity
- [ ] Shuffle button reorganizes board
- [ ] Level mode advances on target score
- [ ] Mobile touch events work on all devices

### Automated Testing (Future)
- Unit tests for `MatchFinder.findMatches()`
- Unit tests for `Board.hasAvailableMove()`
- Integration tests for cascade scoring accuracy
- Visual regression tests for gem rendering
- Performance benchmarks for cascade processing

---

## 🛠️ Development Workflow

### Running Locally
1. Clone/download repository
2. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
3. No build process required—pure vanilla JS

### Making Changes
1. Edit `game.js` or `index.html` directly
2. Refresh browser to see changes
3. Use browser DevTools console to access `window.GameApp` for debugging

### Debugging
- `window.GameApp` exposes the global Game instance
- `GameApp.eventBus.on('eventName', console.log)` to log events
- Use DevTools Performance tab to profile animations

---

## 🌟 Credits

**Developer**: Solo project showcasing production-quality vanilla JavaScript architecture  
**Technologies**: HTML5, CSS3 (Grid, Custom Properties), Vanilla JavaScript (ES6+), Web Audio API, localStorage

---

## 📜 License

This project is open-source and available for educational and portfolio purposes. Feel free to fork, modify, and extend!

---

## 🔮 Future Roadmap

### Planned Features
- [ ] More special gem types (color bomb, wrapped gem combos)
- [ ] Power-up store with in-game currency
- [ ] Global leaderboard (requires backend)
- [ ] Daily challenges with unique board layouts
- [ ] Theme customization (gem skins, backgrounds)
- [ ] Multi-language support
- [ ] Progressive Web App (PWA) support with offline mode
- [ ] Advanced tutorial/onboarding flow

### Technical Improvements
- [ ] Migrate to TypeScript for type safety
- [ ] Implement service worker for offline play
- [ ] Add unit/integration test suite (Jest)
- [ ] Optimize for 60 FPS on low-end devices
- [ ] Implement state machine for game flow
- [ ] WebGL renderer for advanced particle effects

---

**Enjoy playing Gem Cascade! 💎**
