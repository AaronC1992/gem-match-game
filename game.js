// ========== GLOBAL CONFIGURATION ==========
/**
 * Central configuration for Gem Cascade.
 * All tunable constants live here to avoid magic numbers throughout logic.
 * Adjusting values in this object rebalances the game without code changes.
 * @type {Object}
 */
const Config = {
    boardSize: 8,
    gemTypes: 6,
    gemSymbols: ['💎', '🔷', '⭐', '💜', '💚', '🌸'],
    scoring: {
        baseMatch: 10,              // points per matched gem
        comboBonusPerStep: 5        // bonus per cascade step beyond first
    },
    specials: {
        stripedLength: 4,           // exact length producing striped gem
        bombLength: 5               // length threshold producing bomb gem (>= bombLength)
    },
    timers: {
        timedModeSeconds: 60        // default seconds for timed mode
    },
    achievements: {
        score1000: 1000,
        score5000: 5000,
        gems100: 100
    },
    animations: {
        swapDuration: 250,          // ms for swap animation
        matchPulse: 600,            // ms for match pulse keyframe total
        fadeOut: 300,               // ms for fade-out removal
        dropBaseDuration: 300       // base ms for a drop (stagger adds row factor)
    }
};

// ========== ARCHITECTURE (CLASS SCAFFOLDS) ==========
// Transitional scaffolding layer: wraps existing procedural functions.
// Subsequent refactor steps will migrate logic INTO these classes instead
// of delegating outward. Current goal: establish interfaces without altering behavior.

class SettingsManager {
    constructor() {
        this.soundEnabled = true;
        this.colorBlindMode = false; // future visual alternative flag
        this.storageKey = 'gemCascadeSettings';
        this.load();
    }
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        // Keep global flag in sync until refactor fully removes it
        soundEnabled = this.soundEnabled;
    }
    setColorBlindMode(enabled) {
        this.colorBlindMode = !!enabled;
        // Renderer adaptation will come later
    }
    save() {
        localStorage.setItem(this.storageKey, JSON.stringify({ soundEnabled: this.soundEnabled, colorBlindMode: this.colorBlindMode }));
    }
    load() {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.soundEnabled === 'boolean') this.soundEnabled = parsed.soundEnabled;
            if (typeof parsed.colorBlindMode === 'boolean') this.colorBlindMode = parsed.colorBlindMode;
            soundEnabled = this.soundEnabled;
        } catch(e) {}
    }
}

class Board {
    constructor(config) {
        this.config = config;
    }
    create() {
        // Initialize global board (transitional; later localize to this.grid)
        board = [];
        for (let row = 0; row < this.config.boardSize; row++) {
            board[row] = [];
            for (let col = 0; col < this.config.boardSize; col++) {
                board[row][col] = {
                    type: Math.floor(Math.random() * this.config.gemTypes),
                    special: null
                };
            }
        }
    }
    render() { renderBoard(); }
    shuffle() { shuffleBoard(); }
    updateGem(row, col) { GameApp.renderer.updateGem(row, col); }
    hasAvailableMove() { return hasAvailableMove(); }
    findAvailableMove() { return findAvailableMove(); }
}

class MatchFinder {
    constructor(config) { this.config = config; }
    findMatches() {
        const matches = [];
        const matchGroups = [];
        // Horizontal
        for (let row = 0; row < this.config.boardSize; row++) {
            for (let col = 0; col < this.config.boardSize - 2; col++) {
                const type = board[row][col].type;
                if (type === board[row][col + 1].type && type === board[row][col + 2].type) {
                    let matchLength = 3;
                    const group = [];
                    while (col + matchLength < this.config.boardSize && board[row][col + matchLength].type === type) {
                        matchLength++;
                    }
                    for (let i = 0; i < matchLength; i++) {
                        const match = { row, col: col + i };
                        matches.push(match);
                        group.push(match);
                    }
                    matchGroups.push({ matches: group, length: matchLength, direction: 'horizontal' });
                    col += matchLength - 1;
                }
            }
        }
        // Vertical
        for (let col = 0; col < this.config.boardSize; col++) {
            for (let row = 0; row < this.config.boardSize - 2; row++) {
                const type = board[row][col].type;
                if (type === board[row + 1][col].type && type === board[row + 2][col].type) {
                    let matchLength = 3;
                    const group = [];
                    while (row + matchLength < this.config.boardSize && board[row + matchLength][col].type === type) {
                        matchLength++;
                    }
                    for (let i = 0; i < matchLength; i++) {
                        const match = { row: row + i, col };
                        matches.push(match);
                        group.push(match);
                    }
                    matchGroups.push({ matches: group, length: matchLength, direction: 'vertical' });
                    row += matchLength - 1;
                }
            }
        }
        const uniqueMatches = matches.filter((m, idx, self) => idx === self.findIndex(x => x.row === m.row && x.col === m.col));
        uniqueMatches.matchGroups = matchGroups;
        return uniqueMatches;
    }
    wouldCreateMatch(r1,c1,r2,c2) { return wouldCreateMatch(r1,c1,r2,c2); }
}

class Cascader {
    constructor(game, config) {
        this.game = game; // access to matches, renderer, etc.
        this.config = config;
    }
    async processAll() {
        // Migrated logic from global processMatches (transitional; still uses globals).
        let matches = this.game.matches.findMatches();
        let comboCount = 0;
        while (matches.length > 0) {
            comboCount++;
            currentCombo = comboCount;
            maxCombo = Math.max(maxCombo, currentCombo);
            if (comboCount > 1) {
                showComboPopup(comboCount);
                AudioManager.combo(comboCount);
            }
            await this.game.animations.highlightMatches(matches);
            const baseScore = matches.length * this.config.scoring.baseMatch;
            const comboBonus = comboCount > 1 ? (comboCount - 1) * this.config.scoring.comboBonusPerStep : 0;
            score += baseScore + comboBonus;
            totalGemsMatched += matches.length;
            // special gem creation
            matches.matchGroups.forEach(group => {
                if (group.length === this.config.specials.stripedLength) {
                    const middleMatch = group.matches[Math.floor(group.length / 2)];
                    board[middleMatch.row][middleMatch.col] = {
                        type: board[middleMatch.row][middleMatch.col].type,
                        special: 'striped',
                        direction: group.direction
                    };
                    specialGemsCreated++;
                    AudioManager.special();
                    GameApp.eventBus.emit('specialCreated', { kind: 'striped' });
                } else if (group.length >= this.config.specials.bombLength) {
                    const middleMatch = group.matches[Math.floor(group.length / 2)];
                    board[middleMatch.row][middleMatch.col] = {
                        type: board[middleMatch.row][middleMatch.col].type,
                        special: 'bomb'
                    };
                    specialGemsCreated++;
                    AudioManager.special();
                    GameApp.eventBus.emit('specialCreated', { kind: 'bomb' });
                }
            });
            if (comboCount >= 3) {
                gameBoard.classList.add('shake');
                setTimeout(() => gameBoard.classList.remove('shake'), 400);
            }
            updateDisplay();
            checkAchievements();
            GameApp.eventBus.emit('scoreChanged', { score, combo: currentCombo });
            // mark removals & fade out
            await this.game.animations.fadeMatches(matches);
            await this.animateGravityAndRefill();
            await this.game.animations.gravityRefill();
            matches = this.game.matches.findMatches();
        }
        currentCombo = 0;
        updateDisplay();
        GameApp.eventBus.emit('cascadeComplete', { score });
        if (!hasAvailableMove()) shuffleBoard();
    }
    async animateGravityAndRefill() {
        // Migrated from animateGemDrop
        for (let col = 0; col < this.config.boardSize; col++) {
            let writeRow = this.config.boardSize - 1;
            for (let row = this.config.boardSize - 1; row >= 0; row--) {
                if (board[row][col].type !== -1) {
                    const cell = board[row][col];
                    board[writeRow][col] = cell;
                    if (writeRow !== row) {
                        board[row][col] = { type: -1, special: null };
                    }
                    writeRow--;
                }
            }
            for (let row = writeRow; row >= 0; row--) {
                board[row][col] = { type: Math.floor(Math.random() * this.config.gemTypes), special: null };
            }
        }
        // Rebuild element map after structural gravity changes
        this.game.renderer.rebuildAfterGravity(board);
        document.querySelectorAll('#game-board .gem').forEach(el => {
            const row = parseInt(el.dataset.row, 10);
            const delay = row * 0.025;
            const duration = 0.3 + row * 0.015;
            el.style.setProperty('--delay', `${delay}s`);
            el.style.setProperty('--duration', `${duration}s`);
            el.classList.add('dropping');
            setTimeout(() => {
                el.classList.remove('dropping');
                el.style.removeProperty('--delay');
                el.style.removeProperty('--duration');
            }, (duration + delay) * 1000 + 50);
        });
    }
}

class Renderer {
    constructor(config) {
        this.config = config;
        this.elementMap = [];
    }
    buildInitial(boardData) {
        this.elementMap = [];
        gameBoard.innerHTML = '';
        for (let row = 0; row < this.config.boardSize; row++) {
            this.elementMap[row] = [];
            for (let col = 0; col < this.config.boardSize; col++) {
                const el = this._createGemElement(boardData[row][col], row, col);
                this.elementMap[row][col] = el;
                gameBoard.appendChild(el);
            }
        }
    }
    renderAll(boardData) {
        // Update existing elements without rebuilding DOM
        for (let row = 0; row < this.config.boardSize; row++) {
            for (let col = 0; col < this.config.boardSize; col++) {
                this.updateGem(row, col, boardData[row][col]);
            }
        }
    }
    updateGem(row, col, gemData = board[row][col]) {
        const gem = this.getGem(row, col);
        if (!gem) return;
        gem.dataset.type = gemData.type;
        gem.textContent = Config.gemSymbols[gemData.type];
        gem.classList.remove('special-striped', 'special-wrapped', 'special-bomb');
        if (gemData.special === 'striped') {
            gem.classList.add('special-striped');
            gem.textContent = '⚡' + Config.gemSymbols[gemData.type];
        } else if (gemData.special === 'wrapped') {
            gem.classList.add('special-wrapped');
            gem.textContent = '🎁';
        } else if (gemData.special === 'bomb') {
            gem.classList.add('special-bomb');
            gem.textContent = '💣';
        }
    }
    getGem(row, col) {
        return (this.elementMap[row] && this.elementMap[row][col]) ? this.elementMap[row][col] : null;
    }
    highlight(row, col, on) {
        const gem = this.getGem(row, col);
        if (gem) gem.classList.toggle('selected', !!on);
    }
    animateSwap(gem1, gem2) {
        const el1 = this.getGem(gem1.row, gem1.col);
        const el2 = this.getGem(gem2.row, gem2.col);
        if (!el1 || !el2) return;
        const dx = (gem2.col - gem1.col) * 100;
        const dy = (gem2.row - gem1.row) * 100;
        const ms = Config.animations.swapDuration;
        el1.style.transition = `transform ${ms}ms ease-out`;
        el2.style.transition = `transform ${ms}ms ease-out`;
        el1.style.transform = `translate(${dx}%, ${dy}%)`;
        el2.style.transform = `translate(${-dx}%, ${-dy}%)`;
        // Swap elementMap entries so positions stay consistent after animation
        this.elementMap[gem1.row][gem1.col] = el2;
        this.elementMap[gem2.row][gem2.col] = el1;
        setTimeout(() => {
            el1.style.transition = '';
            el2.style.transition = '';
            el1.style.transform = '';
            el2.style.transform = '';
            // Update grid placement so elements sit in their new cells
            el1.style.gridRowStart = (gem2.row + 1).toString();
            el1.style.gridColumnStart = (gem2.col + 1).toString();
            el1.dataset.row = gem2.row;
            el1.dataset.col = gem2.col;
            el2.style.gridRowStart = (gem1.row + 1).toString();
            el2.style.gridColumnStart = (gem1.col + 1).toString();
            el2.dataset.row = gem1.row;
            el2.dataset.col = gem1.col;
        }, ms);
    }
    rebuildAfterGravity(boardData) {
        // After large structural changes (gravity) it's simpler to rebuild
        this.buildInitial(boardData);
    }
    _createGemElement(gemData, row, col) {
        const gem = document.createElement('div');
        gem.className = 'gem';
        gem.dataset.row = row;
        gem.dataset.col = col;
        gem.dataset.type = gemData.type;
        gem.textContent = Config.gemSymbols[gemData.type];
        gem.style.gridRowStart = (row + 1).toString();
        gem.style.gridColumnStart = (col + 1).toString();
        if (gemData.special === 'striped') {
            gem.classList.add('special-striped');
            gem.textContent = '⚡' + Config.gemSymbols[gemData.type];
        } else if (gemData.special === 'wrapped') {
            gem.classList.add('special-wrapped');
            gem.textContent = '🎁';
        } else if (gemData.special === 'bomb') {
            gem.classList.add('special-bomb');
            gem.textContent = '💣';
        }
        gem.addEventListener('click', () => handleGemClick(row, col));
        gem.addEventListener('touchstart', (e) => { e.preventDefault(); handleGemClick(row, col); });
        return gem;
    }
}

// ========== ANIMATION MANAGER ==========
class AnimationManager {
    constructor(config, renderer) {
        this.config = config;
        this.renderer = renderer;
    }
    swap(gem1, gem2) {
        return new Promise(resolve => {
            this.renderer.animateSwap(gem1, gem2);
            setTimeout(resolve, this.config.animations.swapDuration);
        });
    }
    highlightMatches(matches) {
        return new Promise(resolve => {
            matches.forEach(match => {
                const gem = this.renderer.getGem(match.row, match.col);
                if (gem) {
                    gem.classList.add('matching');
                    const rect = gem.getBoundingClientRect();
                    const color = window.getComputedStyle(gem).background;
                    createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, color.split('(')[0], 6);
                    const delay = (this.config.boardSize - match.row) * 0.03;
                    gem.style.setProperty('--delay', `${delay}s`);
                }
            });
            setTimeout(resolve, 400);
        });
    }
    fadeMatches(matches) {
        return new Promise(resolve => {
            matches.forEach(match => {
                if (board[match.row][match.col].special !== 'striped' && board[match.row][match.col].special !== 'bomb') {
                    const gem = this.renderer.getGem(match.row, match.col);
                    if (gem) gem.classList.add('fade-out');
                    board[match.row][match.col] = { type: -1, special: null };
                }
            });
            setTimeout(() => {
                document.querySelectorAll('.fade-out').forEach(gem => setTimeout(() => gem.remove(), 40));
                resolve();
            }, this.config.animations.fadeOut);
        });
    }
    gravityRefill() {
        const maxRow = this.config.boardSize - 1;
        const maxDelay = maxRow * 0.025;
        const maxDuration = 0.3 + maxRow * 0.015;
        const totalMs = (maxDelay + maxDuration) * 1000 + 120;
        return new Promise(resolve => setTimeout(resolve, totalMs));
    }
}

// ========== EVENT BUS ==========
class EventBus {
    constructor() { this.handlers = {}; }
    on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); }
    emit(event, payload) { (this.handlers[event] || []).forEach(fn => { try { fn(payload); } catch(e) { console.error(e); } }); }
}

// ========== LEVEL SYSTEM ==========
class LevelSystem {
    constructor(game) {
        this.game = game;
        this.levels = [
            { id:1, targetScore: 500, moves: 25 },
            { id:2, targetScore: 1200, moves: 28 },
            { id:3, targetScore: 2500, moves: 30 },
            { id:4, targetScore: 4000, moves: 32 },
            { id:5, targetScore: 6000, moves: 34 }
        ];
        this.storageKey = 'gemCascadeLevelProgress';
        this.currentLevelIndex = 0;
        this.load();
    }
    current() { return this.levels[this.currentLevelIndex]; }
    advanceIfComplete(score) {
        const lvl = this.current();
        if (score >= lvl.targetScore) {
            this.currentLevelIndex = Math.min(this.currentLevelIndex + 1, this.levels.length - 1);
            this.save();
            GameApp.eventBus.emit('levelComplete', { level: lvl.id });
        }
    }
    save() { localStorage.setItem(this.storageKey, JSON.stringify({ levelIndex: this.currentLevelIndex })); }
    load() { try { const raw = localStorage.getItem(this.storageKey); if (!raw) return; const p = JSON.parse(raw); if (typeof p.levelIndex === 'number') this.currentLevelIndex = p.levelIndex; } catch(e) {} }
}

class AchievementManager {
    constructor(config) { this.config = config; }
    checkAll() { return checkAchievements(); }
    unlock(key) { return unlockAchievement(key); }
}

class InputController {
    constructor(game) { this.game = game; }
    // Future: keyboard navigation & accessibility
    initMouse() { /* existing listeners remain globally; will migrate later */ }
}

class Game {
    constructor(config) {
        this.config = config;
        this.settings = new SettingsManager();
        this.board = new Board(config);
        this.matches = new MatchFinder(config);
        this.cascader = new Cascader(this, config);
        this.renderer = new Renderer(config);
        this.animations = new AnimationManager(config, this.renderer);
        this.achievements = new AchievementManager(config);
        this.input = new InputController(this);
        this.eventBus = new EventBus();
        this.levelSystem = new LevelSystem(this);
        this.paused = false;
    }
    init(mode) { initGame(mode); }
    end() { endGame(); }
    pause() {
        if (this.paused) return;
        this.paused = true;
        if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
        document.getElementById('pause-modal')?.classList.add('active');
    }
    resume() {
        if (!this.paused) return;
        this.paused = false;
        document.getElementById('pause-modal')?.classList.remove('active');
        const modeConfig = GAME_MODES[gameMode];
        if (modeConfig.time) gameTimer = setInterval(updateTimer, 1000);
    }
}

// Global singleton instance (transitional). Later we will remove globals.
const GameApp = new Game(Config);
window.GameApp = GameApp; // exposed for debugging & future console experimentation

const GAME_MODES = {
    classic: { moves: 30, time: null, name: 'Classic' },
    timed: { moves: null, time: Config.timers.timedModeSeconds, name: 'Time Attack' },
    endless: { moves: 999, time: null, name: 'Endless' },
    zen: { moves: 999, time: null, name: 'Zen' },
    level: { moves: null, time: null, name: 'Levels' }
};

// ========== GAME STATE ==========
let board = [];
let score = 0;
let moves = 30;
let currentCombo = 0;
let maxCombo = 0;
let totalGemsMatched = 0;
let specialGemsCreated = 0;
let selectedGem = null;
let isProcessing = false;
let gameMode = 'classic';
let gameTimer = null;
let timeLeft = 60;
let hintTimeout = null;
let soundEnabled = true;

// ========== DOM ELEMENTS ==========
const gameBoard = document.getElementById('game-board');
const scoreDisplay = document.getElementById('score');
const movesDisplay = document.getElementById('moves');
const comboDisplay = document.getElementById('combo');
const newGameBtn = document.getElementById('new-game');
const hintBtn = document.getElementById('hint-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const startModal = document.getElementById('start-modal');
const gameoverModal = document.getElementById('gameover-modal');
const achievementPopup = document.getElementById('achievement-popup');
const pauseBtn = document.getElementById('pause-btn');
const settingsBtn = document.getElementById('settings-btn');
const achievementsBtn = document.getElementById('achievements-btn');
const resumeBtn = document.getElementById('resume-btn');
const settingsModal = document.getElementById('settings-modal');
const achievementsModal = document.getElementById('achievements-modal');
const toggleSoundChk = document.getElementById('toggle-sound');
const toggleColorBlindChk = document.getElementById('toggle-colorblind');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const closeAchievementsBtn = document.getElementById('close-achievements');
const pauseModal = document.getElementById('pause-modal');

// ========== AUDIO SYSTEM ==========
const AudioManager = {
    context: null,
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    },
    
    playTone(frequency, duration, type = 'sine') {
        if (!soundEnabled || !this.context) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },
    
    match() { this.playTone(523.25, 0.1, 'sine'); },
    combo(level) { this.playTone(523.25 * (1 + level * 0.2), 0.15, 'triangle'); },
    special() { this.playTone(783.99, 0.2, 'square'); setTimeout(() => this.playTone(1046.50, 0.2, 'square'), 100); },
    invalid() { this.playTone(200, 0.1, 'sawtooth'); },
    success() { [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => { setTimeout(() => this.playTone(freq, 0.15, 'sine'), i * 80); }); }
};

// ========== PARTICLE EFFECTS ==========
function createParticles(x, y, color, count = 8) {
    // Normalize gradient/background string to a solid fallback for particles
    const resolvedColor = (/rgb|hsl|#/.test(color)) ? color : '#ffd700';
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.background = resolvedColor;
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        document.body.appendChild(particle);

        const angle = (Math.PI * 2 * i) / count;
        const velocity = 2 + Math.random() * 3;
        animateParticle(particle, Math.cos(angle) * velocity, Math.sin(angle) * velocity);
    }
}

function animateParticle(particle, vx, vy) {
    let x = parseFloat(particle.style.left);
    let y = parseFloat(particle.style.top);
    let opacity = 1;
    
    function update() {
        x += vx;
        y += vy;
        opacity -= 0.02;
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.opacity = opacity;
        
        if (opacity > 0) requestAnimationFrame(update);
        else particle.remove();
    }
    update();
}

// ========== ACHIEVEMENT SYSTEM ==========
const achievements = {
    firstMatch: { unlocked: false, name: 'First Match', desc: 'Match your first gems!' },
    combo5: { unlocked: false, name: 'Combo Master', desc: 'Get a 5x combo!' },
    combo10: { unlocked: false, name: 'Combo Legend', desc: 'Get a 10x combo!' },
    score1000: { unlocked: false, name: 'High Scorer', desc: 'Reach 1000 points!' },
    score5000: { unlocked: false, name: 'Score Master', desc: 'Reach 5000 points!' },
    specialGem: { unlocked: false, name: 'Special Discovery', desc: 'Create a special gem!' },
    gems100: { unlocked: false, name: 'Gem Collector', desc: 'Match 100 gems!' }
};

function checkAchievements() {
    if (!achievements.firstMatch.unlocked && totalGemsMatched > 0) unlockAchievement('firstMatch');
    if (!achievements.combo5.unlocked && maxCombo >= 5) unlockAchievement('combo5');
    if (!achievements.combo10.unlocked && maxCombo >= 10) unlockAchievement('combo10');
    if (!achievements.score1000.unlocked && score >= 1000) unlockAchievement('score1000');
    if (!achievements.score5000.unlocked && score >= 5000) unlockAchievement('score5000');
    if (!achievements.specialGem.unlocked && specialGemsCreated > 0) unlockAchievement('specialGem');
    if (!achievements.gems100.unlocked && totalGemsMatched >= 100) unlockAchievement('gems100');
}

function unlockAchievement(key) {
    achievements[key].unlocked = true;
    document.getElementById('achievement-text').textContent = achievements[key].desc;
    achievementPopup.classList.add('show');
    AudioManager.success();
    setTimeout(() => achievementPopup.classList.remove('show'), 3000);
    GameApp.eventBus.emit('achievementUnlocked', { key, name: achievements[key].name });
}

// ========== INITIALIZE GAME ==========
function initGame(mode = 'classic') {
    gameMode = mode;
    const modeConfig = GAME_MODES[mode];
    
    board = [];
    score = 0;
    currentCombo = 0;
    maxCombo = 0;
    totalGemsMatched = 0;
    specialGemsCreated = 0;
    if (mode === 'level') {
        const lvl = GameApp.levelSystem.current();
        moves = lvl.moves;
        timeLeft = 0; // level mode uses moves only for now
    } else {
        moves = modeConfig.moves || 30;
        timeLeft = modeConfig.time || 60;
    }
    selectedGem = null;
    isProcessing = false;
    
    if (gameTimer) clearInterval(gameTimer);
    if (modeConfig.time) gameTimer = setInterval(updateTimer, 1000);
    
    // Build initial board ensuring: no existing matches + at least one possible move
    do {
        GameApp.board.create();
    } while (GameApp.matches.findMatches().length > 0 || !hasAvailableMove());
    GameApp.renderer.buildInitial(board);
    updateDisplay();
    GameApp.eventBus.emit('gameStarted', { mode, moves, timeLeft });

    // Reset any danger coloring on timed/moves displays
    movesDisplay.parentElement.style.color = '';
    
    startModal.classList.remove('active');
    resetHintTimeout();
}

function updateTimer() {
    timeLeft--;
    movesDisplay.textContent = timeLeft + 's';
    if (timeLeft <= 0) {
        endGame();
    } else if (timeLeft <= 10) {
        movesDisplay.parentElement.style.color = '#ff6b6b';
    } else {
        // Clear warning color when recovering (e.g., different mode restart)
        movesDisplay.parentElement.style.color = '';
    }
}

// ========== BOARD MANAGEMENT ==========
function createBoard() {
    board = [];
    for (let row = 0; row < Config.boardSize; row++) {
        board[row] = [];
        for (let col = 0; col < Config.boardSize; col++) {
            board[row][col] = {
                type: Math.floor(Math.random() * Config.gemTypes),
                special: null
            };
        }
    }
}

function renderBoard() {
    gameBoard.innerHTML = '';
    for (let row = 0; row < Config.boardSize; row++) {
        for (let col = 0; col < Config.boardSize; col++) {
            const gem = createGemElement(row, col);
            gameBoard.appendChild(gem);
        }
    }
}

function createGemElement(row, col) {
    const gemData = board[row][col];
    const gem = document.createElement('div');
    gem.className = 'gem';
    gem.dataset.row = row;
    gem.dataset.col = col;
    gem.dataset.type = gemData.type;
    gem.textContent = Config.gemSymbols[gemData.type];
    // Ensure gem is placed in the correct grid cell regardless of DOM order
    gem.style.gridRowStart = (row + 1).toString();
    gem.style.gridColumnStart = (col + 1).toString();
    
    if (gemData.special === 'striped') {
        gem.classList.add('special-striped');
        gem.textContent = '⚡' + Config.gemSymbols[gemData.type];
    } else if (gemData.special === 'wrapped') {
        gem.classList.add('special-wrapped');
        gem.textContent = '🎁';
    } else if (gemData.special === 'bomb') {
        gem.classList.add('special-bomb');
        gem.textContent = '💣';
    }
    
    gem.addEventListener('click', () => handleGemClick(row, col));
    gem.addEventListener('touchstart', (e) => { e.preventDefault(); handleGemClick(row, col); });
    
    return gem;
}

// ========== GAME LOGIC ==========
function handleGemClick(row, col) {
    if (isProcessing || ((gameMode === 'classic' || gameMode === 'level') && moves <= 0)) return;
    
    resetHintTimeout();
    const clickedGem = { row, col };
    
    if (!selectedGem) {
        selectedGem = clickedGem;
        highlightGem(row, col, true);
    } else {
        if (selectedGem.row === row && selectedGem.col === col) {
            highlightGem(row, col, false);
            selectedGem = null;
        } else if (areAdjacent(selectedGem, clickedGem)) {
            highlightGem(selectedGem.row, selectedGem.col, false);
            swapGems(selectedGem, clickedGem);
        } else {
            highlightGem(selectedGem.row, selectedGem.col, false);
            selectedGem = clickedGem;
            highlightGem(row, col, true);
        }
    }
}

function highlightGem(row, col, highlight) {
    GameApp.renderer.highlight(row, col, highlight);
}

function animateSwap(gem1, gem2) {
    GameApp.renderer.animateSwap(gem1, gem2);
}

function areAdjacent(gem1, gem2) {
    const rowDiff = Math.abs(gem1.row - gem2.row);
    const colDiff = Math.abs(gem1.col - gem2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

async function swapGems(gem1, gem2) {
    isProcessing = true;
    
    // Store original values
    const temp1 = board[gem1.row][gem1.col];
    const temp2 = board[gem2.row][gem2.col];
    
    // Temporarily swap to check for matches
    board[gem1.row][gem1.col] = temp2;
    board[gem2.row][gem2.col] = temp1;
    
    const willMatch = GameApp.matches.findMatches().length > 0;
    
    // Restore original state
    board[gem1.row][gem1.col] = temp1;
    board[gem2.row][gem2.col] = temp2;
    
    if (!willMatch) {
        // Invalid move - don't animate, just reject
        AudioManager.invalid();
        isProcessing = false;
        selectedGem = null;
        return;
    }
    
    // Valid move - animate first (elements still show old content), then swap data & update DOM
    await GameApp.animations.swap(gem1, gem2);
    board[gem1.row][gem1.col] = temp2;
    board[gem2.row][gem2.col] = temp1;
    
    // Update DOM to reflect swapped data
    GameApp.renderer.updateGem(gem1.row, gem1.col);
    GameApp.renderer.updateGem(gem2.row, gem2.col);
    
    if (gameMode === 'classic' || gameMode === 'level') moves--;
    updateDisplay();
    AudioManager.match();
    
    await GameApp.cascader.processAll();
    
    selectedGem = null;
    isProcessing = false;
    
    if ((gameMode === 'classic' || gameMode === 'level') && moves <= 0) {
        if (gameMode === 'level') {
            const currentTarget = GameApp.levelSystem.current().targetScore;
            const targetMet = score >= currentTarget;
            if (targetMet) {
                GameApp.levelSystem.advanceIfComplete(score);
            }
            // Pass the pre-advance target so endGame shows the correct result
            endGame(currentTarget);
        } else {
            endGame();
        }
    }
    resetHintTimeout();
}

// (Removed standalone updateGem; now handled by Renderer.updateGem)

// (Removed checkMatches; logic now resides in MatchFinder.findMatches())

// (Removed global processMatches; logic now in Cascader.processAll())

// (Removed global animateGemDrop; logic now in Cascader.animateGravityAndRefill())

function showComboPopup(combo) {
    const popup = document.createElement('div');
    popup.className = 'combo-display';
    popup.textContent = `${combo}x COMBO!`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

// ========== HINT SYSTEM ==========
function resetHintTimeout() {
    if (hintTimeout) clearTimeout(hintTimeout);
    document.querySelectorAll('.hint-glow').forEach(el => el.classList.remove('hint-glow'));
    hintTimeout = setTimeout(showHint, 5000);
}

function showHint() {
    if (isProcessing) return; // Avoid board mutation mid-cascade
    const move = findAvailableMove();
    if (move) {
        const gem1 = GameApp.renderer.getGem(move.from.row, move.from.col);
        const gem2 = GameApp.renderer.getGem(move.to.row, move.to.col);
        if (gem1 && gem2) {
            gem1.classList.add('hint-glow');
            gem2.classList.add('hint-glow');
            setTimeout(() => {
                gem1.classList.remove('hint-glow');
                gem2.classList.remove('hint-glow');
            }, 2000);
        }
    }
}

function findAvailableMove() {
    for (let row = 0; row < Config.boardSize; row++) {
        for (let col = 0; col < Config.boardSize; col++) {
            if (col < Config.boardSize - 1) {
                if (wouldCreateMatch(row, col, row, col + 1)) {
                    return { from: { row, col }, to: { row, col: col + 1 } };
                }
            }
            if (row < Config.boardSize - 1) {
                if (wouldCreateMatch(row, col, row + 1, col)) {
                    return { from: { row, col }, to: { row: row + 1, col } };
                }
            }
        }
    }
    return null;
}

function wouldCreateMatch(row1, col1, row2, col2) {
    // Store original values
    const temp1 = board[row1][col1];
    const temp2 = board[row2][col2];
    
    // Swap
    board[row1][col1] = temp2;
    board[row2][col2] = temp1;
    
    const hasMatch = GameApp.matches.findMatches().length > 0;
    
    // Restore
    board[row1][col1] = temp1;
    board[row2][col2] = temp2;
    
    return hasMatch;
}

function hasAvailableMove() {
    return findAvailableMove() !== null;
}

function shuffleBoard() {
    let attempts = 0;
    const maxAttempts = 50;
    do {
        const types = [];
        for (let row = 0; row < Config.boardSize; row++) {
            for (let col = 0; col < Config.boardSize; col++) {
                types.push(board[row][col].type);
            }
        }

        for (let i = types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [types[i], types[j]] = [types[j], types[i]];
        }

        let index = 0;
        for (let row = 0; row < Config.boardSize; row++) {
            for (let col = 0; col < Config.boardSize; col++) {
                board[row][col] = { type: types[index++], special: null };
            }
        }
        attempts++;
    } while (attempts < maxAttempts && (GameApp.matches.findMatches().length > 0 || !hasAvailableMove()));

    GameApp.renderer.renderAll(board);
}

// ========== UI UPDATES ==========
function updateDisplay() {
    scoreDisplay.textContent = score;
    movesDisplay.textContent = gameMode === 'timed' ? timeLeft + 's' : moves;
    comboDisplay.textContent = currentCombo > 0 ? currentCombo + 'x' : '0x';
    if (gameMode === 'level') {
        const target = GameApp.levelSystem.current().targetScore;
        scoreDisplay.parentElement.querySelector('span.score-value').textContent = score;
        // Optionally show target in title attribute for now
        scoreDisplay.parentElement.title = `Target: ${target}`;
    }
}

function endGame(levelTarget) {
    if (gameTimer) clearInterval(gameTimer);
    
    const highScoreKey = `highScore_${gameMode}`;
    const currentHigh = parseInt(localStorage.getItem(highScoreKey)) || 0;
    if (score > currentHigh) localStorage.setItem(highScoreKey, score);
    
    let title;
    if (gameMode === 'level') {
        const target = levelTarget != null ? levelTarget : GameApp.levelSystem.current().targetScore;
        title = score >= target ? '✅ Level Complete!' : 'Level Failed';
    } else {
        title = score > currentHigh ? '🎉 NEW HIGH SCORE! 🎉' : 'Game Over!';
    }
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('final-score').textContent = `Final Score: ${score}`;
    document.getElementById('best-combo-stat').textContent = maxCombo + 'x';
    document.getElementById('gems-matched-stat').textContent = totalGemsMatched;
    document.getElementById('high-score-stat').textContent = Math.max(score, currentHigh);
    document.getElementById('special-gems-stat').textContent = specialGemsCreated;
    
    gameoverModal.classList.add('active');
    
    if (score > currentHigh) AudioManager.success();
    GameApp.eventBus.emit('gameEnded', { mode: gameMode, score, maxCombo, totalGemsMatched });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== EVENT LISTENERS ==========
newGameBtn.addEventListener('click', () => {
    startModal.classList.add('active');
    gameoverModal.classList.remove('active');
});

hintBtn.addEventListener('click', showHint);
shuffleBtn.addEventListener('click', () => { if (!isProcessing) shuffleBoard(); });

document.getElementById('play-again').addEventListener('click', () => {
    gameoverModal.classList.remove('active');
    initGame(gameMode);
});

document.getElementById('change-mode').addEventListener('click', () => {
    gameoverModal.classList.remove('active');
    startModal.classList.add('active');
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        initGame(mode);
    });
});

// Pause / Resume
pauseBtn.addEventListener('click', () => { GameApp.pause(); });
resumeBtn.addEventListener('click', () => { GameApp.resume(); });

// Settings
settingsBtn.addEventListener('click', () => {
    // Populate checkboxes from current settings
    toggleSoundChk.checked = GameApp.settings.soundEnabled;
    toggleColorBlindChk.checked = GameApp.settings.colorBlindMode;
    settingsModal.classList.add('active');
});
saveSettingsBtn.addEventListener('click', () => {
    GameApp.settings.soundEnabled = toggleSoundChk.checked;
    soundEnabled = GameApp.settings.soundEnabled; // sync global
    GameApp.settings.setColorBlindMode(toggleColorBlindChk.checked);
    GameApp.settings.save();
    applyColorBlindMode(GameApp.settings.colorBlindMode);
    settingsModal.classList.remove('active');
});
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

// Achievements modal
achievementsBtn.addEventListener('click', () => {
    renderAchievementsModal();
    achievementsModal.classList.add('active');
});
closeAchievementsBtn.addEventListener('click', () => achievementsModal.classList.remove('active'));

// ESC to pause/resume
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (GameApp.paused) GameApp.resume(); else GameApp.pause();
    }
});

function applyColorBlindMode(enabled) {
    document.body.classList.toggle('color-blind', !!enabled);
}

function renderAchievementsModal() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(achievements).forEach(key => {
        const a = achievements[key];
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.borderRadius = '10px';
        div.style.background = a.unlocked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
        div.style.border = a.unlocked ? '2px solid #ffd700' : '2px solid rgba(255,255,255,0.3)';
        div.innerHTML = `<strong>${a.name}</strong><br><small>${a.desc}</small>`;
        list.appendChild(div);
    });
}

// ========== INITIALIZE ==========
AudioManager.init();
applyColorBlindMode(GameApp.settings.colorBlindMode);
soundEnabled = GameApp.settings.soundEnabled;

// Prevent zoom via ctrl+wheel and iOS gesture
document.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); } }, { passive: false });
document.addEventListener('gesturestart', (e) => { e.preventDefault(); });
document.querySelector('#game-board')?.addEventListener('dblclick', (e) => { e.preventDefault(); });

// Optional: expose a simple mute toggle via keyboard (m)
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') {
        GameApp.settings.toggleSound();
    }
});

// ========== RESPONSIVE BOARD RESIZE ==========
function resizeLayout() {
    const root = document.documentElement;
    const container = document.querySelector('.game-container');
    const boardEl = document.getElementById('game-board');
    if (!container || !boardEl) return;

    // Measure chrome heights
    const header = container.querySelector('h1');
    const scoreBoard = container.querySelector('.score-board');
    const controls = container.querySelector('.controls');

    const headerH = header ? header.offsetHeight : 0;
    const scoreH = scoreBoard ? scoreBoard.offsetHeight : 0;
    const controlsH = controls ? controls.offsetHeight : 0;
    const verticalPadding = parseFloat(getComputedStyle(container).paddingTop) + parseFloat(getComputedStyle(container).paddingBottom);
    const gapEstimate = parseFloat(getComputedStyle(container).gap) || 16;

    const availableHeight = window.innerHeight - (headerH + scoreH + controlsH + verticalPadding + gapEstimate * 2) - 10; // extra breathing space
    const availableWidth = container.clientWidth - (parseFloat(getComputedStyle(container).paddingLeft) + parseFloat(getComputedStyle(container).paddingRight));

    let target = Math.min(availableHeight, availableWidth);
    // Safeguards for extremely small screens
    if (target < 220) target = Math.min(availableWidth, 220);
    if (target > 760) target = Math.min(target, 760);

    root.style.setProperty('--board-size', target + 'px');
}

window.addEventListener('resize', () => { resizeLayout(); });
window.addEventListener('orientationchange', () => { setTimeout(resizeLayout, 120); });
window.addEventListener('load', () => { resizeLayout(); });

// Call after initial board render in case load event missed timing
setTimeout(resizeLayout, 200);
