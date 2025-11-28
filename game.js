// ========== GAME CONFIGURATION ==========
const BOARD_SIZE = 8;
const GEM_TYPES = 6;
const GEM_SYMBOLS = ['💎', '🔷', '⭐', '💜', '💚', '🌸'];

const GAME_MODES = {
    classic: { moves: 30, time: null, name: 'Classic' },
    timed: { moves: null, time: 60, name: 'Time Attack' },
    endless: { moves: 999, time: null, name: 'Endless' },
    zen: { moves: 999, time: null, name: 'Zen' }
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
    moves = modeConfig.moves || 30;
    timeLeft = modeConfig.time || 60;
    selectedGem = null;
    isProcessing = false;
    
    if (gameTimer) clearInterval(gameTimer);
    if (modeConfig.time) gameTimer = setInterval(updateTimer, 1000);
    
    // Build initial board ensuring: no existing matches + at least one possible move
    do {
        createBoard();
    } while (checkMatches().length > 0 || !hasAvailableMove());
    renderBoard();
    updateDisplay();

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
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = {
                type: Math.floor(Math.random() * GEM_TYPES),
                special: null
            };
        }
    }
}

function renderBoard() {
    gameBoard.innerHTML = '';
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
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
    gem.textContent = GEM_SYMBOLS[gemData.type];
    // Ensure gem is placed in the correct grid cell regardless of DOM order
    gem.style.gridRowStart = (row + 1).toString();
    gem.style.gridColumnStart = (col + 1).toString();
    
    if (gemData.special === 'striped') {
        gem.classList.add('special-striped');
        gem.textContent = '⚡' + GEM_SYMBOLS[gemData.type];
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
    if (isProcessing || (gameMode === 'classic' && moves <= 0)) return;
    
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
    const gem = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (gem) gem.classList.toggle('selected', highlight);
}

function animateSwap(gem1, gem2) {
    const el1 = document.querySelector(`[data-row="${gem1.row}"][data-col="${gem1.col}"]`);
    const el2 = document.querySelector(`[data-row="${gem2.row}"][data-col="${gem2.col}"]`);
    if (!el1 || !el2) return;
    
    const dx = (gem2.col - gem1.col) * 100;
    const dy = (gem2.row - gem1.row) * 100;
    
    el1.style.transition = 'transform 0.25s ease-out';
    el2.style.transition = 'transform 0.25s ease-out';
    el1.style.transform = `translate(${dx}%, ${dy}%)`;
    el2.style.transform = `translate(${-dx}%, ${-dy}%)`;
    
    setTimeout(() => {
        el1.style.transition = '';
        el2.style.transition = '';
        el1.style.transform = '';
        el2.style.transform = '';
    }, 250);
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
    
    const willMatch = checkMatches().length > 0;
    
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
    
    // Valid move - animate the swap
    animateSwap(gem1, gem2);
    
    // Do the actual swap
    board[gem1.row][gem1.col] = temp2;
    board[gem2.row][gem2.col] = temp1;
    
    await wait(250);
    
    // Update DOM
    updateGem(gem1.row, gem1.col);
    updateGem(gem2.row, gem2.col);
    
    if (gameMode === 'classic') moves--;
    updateDisplay();
    AudioManager.match();
    
    await processMatches();
    
    selectedGem = null;
    isProcessing = false;
    
    if (gameMode === 'classic' && moves <= 0) endGame();
    resetHintTimeout();
}

function updateGem(row, col) {
    const gem = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!gem) return;
    
    const gemData = board[row][col];
    gem.dataset.type = gemData.type;
    gem.textContent = GEM_SYMBOLS[gemData.type];
    gem.classList.remove('special-striped', 'special-wrapped', 'special-bomb');
    // Keep CSS grid position in sync
    gem.style.gridRowStart = (row + 1).toString();
    gem.style.gridColumnStart = (col + 1).toString();
    
    if (gemData.special === 'striped') {
        gem.classList.add('special-striped');
        gem.textContent = '⚡' + GEM_SYMBOLS[gemData.type];
    } else if (gemData.special === 'wrapped') {
        gem.classList.add('special-wrapped');
        gem.textContent = '🎁';
    } else if (gemData.special === 'bomb') {
        gem.classList.add('special-bomb');
        gem.textContent = '💣';
    }
}

function checkMatches() {
    const matches = [];
    const matchGroups = [];
    
    // Check horizontal
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
            const type = board[row][col].type;
            if (type === board[row][col + 1].type && type === board[row][col + 2].type) {
                let matchLength = 3;
                const group = [];
                
                while (col + matchLength < BOARD_SIZE && board[row][col + matchLength].type === type) {
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
    
    // Check vertical
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE - 2; row++) {
            const type = board[row][col].type;
            if (type === board[row + 1][col].type && type === board[row + 2][col].type) {
                let matchLength = 3;
                const group = [];
                
                while (row + matchLength < BOARD_SIZE && board[row + matchLength][col].type === type) {
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
    
    // Remove duplicates
    const uniqueMatches = matches.filter((match, index, self) =>
        index === self.findIndex(m => m.row === match.row && m.col === match.col)
    );
    
    uniqueMatches.matchGroups = matchGroups;
    return uniqueMatches;
}

async function processMatches() {
    let matches = checkMatches();
    let comboCount = 0;
    
    while (matches.length > 0) {
        comboCount++;
        currentCombo = comboCount;
        maxCombo = Math.max(maxCombo, currentCombo);
        
        if (comboCount > 1) {
            showComboPopup(comboCount);
            AudioManager.combo(comboCount);
        }
        
        // Highlight and create particles
        matches.forEach(match => {
            const gem = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
            if (gem) {
                gem.classList.add('matching');
                const rect = gem.getBoundingClientRect();
                const color = window.getComputedStyle(gem).background;
                createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, color.split('(')[0], 6);
                // Stagger fade-out by row for nicer cascade
                const delay = (BOARD_SIZE - match.row) * 0.03; // seconds
                gem.style.setProperty('--delay', `${delay}s`);
            }
        });
        
        await wait(400);
        
        // Calculate score
        const baseScore = matches.length * 10;
        const comboBonus = comboCount > 1 ? (comboCount - 1) * 5 : 0;
        score += baseScore + comboBonus;
        totalGemsMatched += matches.length;
        
        // Check for special gem creation
        matches.matchGroups.forEach(group => {
            if (group.length === 4) {
                const middleMatch = group.matches[Math.floor(group.length / 2)];
                board[middleMatch.row][middleMatch.col] = {
                    type: board[middleMatch.row][middleMatch.col].type,
                    special: 'striped',
                    direction: group.direction
                };
                specialGemsCreated++;
                AudioManager.special();
            } else if (group.length >= 5) {
                const middleMatch = group.matches[Math.floor(group.length / 2)];
                board[middleMatch.row][middleMatch.col] = {
                    type: board[middleMatch.row][middleMatch.col].type,
                    special: 'bomb'
                };
                specialGemsCreated++;
                AudioManager.special();
            }
        });
        
        // Screen shake for big combos
        if (comboCount >= 3) {
            gameBoard.classList.add('shake');
            setTimeout(() => gameBoard.classList.remove('shake'), 400);
        }
        
        updateDisplay();
        checkAchievements();
        
        // Remove matched gems (except special)
        matches.forEach(match => {
            if (board[match.row][match.col].special !== 'striped' && 
                board[match.row][match.col].special !== 'bomb') {
                const gem = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
                if (gem) {
                    gem.classList.add('fade-out');
                }
                board[match.row][match.col] = { type: -1, special: null };
            }
        });
        
        await wait(300);
        
        // Remove faded gems from DOM
        document.querySelectorAll('.fade-out').forEach(gem => {
            // Clear any transform after animation ends
            setTimeout(() => gem.remove(), 40);
        });
        
        // Drop and fill with physics animation
        await animateGemDrop();
        
        matches = checkMatches();
    }
    
    currentCombo = 0;
    updateDisplay();
    
    if (gameMode === 'classic' && !hasAvailableMove()) shuffleBoard();
}

async function animateGemDrop() {
    // Re-compute board by applying gravity
    for (let col = 0; col < BOARD_SIZE; col++) {
        let writeRow = BOARD_SIZE - 1;
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (board[row][col].type !== -1) {
                const cell = board[row][col];
                board[writeRow][col] = cell;
                if (writeRow !== row) {
                    board[row][col] = { type: -1, special: null };
                }
                writeRow--;
            }
        }
        // Fill remaining with new gems
        for (let row = writeRow; row >= 0; row--) {
            board[row][col] = {
                type: Math.floor(Math.random() * GEM_TYPES),
                special: null
            };
        }
    }

    // Re-render board in correct grid positions
    renderBoard();

    // Add staggered drop animation to simulate cascade
    document.querySelectorAll('#game-board .gem').forEach(el => {
        const row = parseInt(el.dataset.row, 10);
        const delay = row * 0.025; // seconds
        const duration = 0.3 + row * 0.015; // seconds
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
        const gem1 = document.querySelector(`[data-row="${move.from.row}"][data-col="${move.from.col}"]`);
        const gem2 = document.querySelector(`[data-row="${move.to.row}"][data-col="${move.to.col}"]`);
        
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
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (col < BOARD_SIZE - 1) {
                if (wouldCreateMatch(row, col, row, col + 1)) {
                    return { from: { row, col }, to: { row, col: col + 1 } };
                }
            }
            if (row < BOARD_SIZE - 1) {
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
    
    const hasMatch = checkMatches().length > 0;
    
    // Restore
    board[row1][col1] = temp1;
    board[row2][col2] = temp2;
    
    return hasMatch;
}

function hasAvailableMove() {
    return findAvailableMove() !== null;
}

function shuffleBoard() {
    const types = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            types.push(board[row][col].type);
        }
    }
    
    for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
    }
    
    let index = 0;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = { type: types[index++], special: null };
        }
    }
    
    renderBoard();
}

// ========== UI UPDATES ==========
function updateDisplay() {
    scoreDisplay.textContent = score;
    movesDisplay.textContent = gameMode === 'timed' ? timeLeft + 's' : moves;
    comboDisplay.textContent = currentCombo > 0 ? currentCombo + 'x' : '0x';
}

function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    
    const highScoreKey = `highScore_${gameMode}`;
    const currentHigh = parseInt(localStorage.getItem(highScoreKey)) || 0;
    if (score > currentHigh) localStorage.setItem(highScoreKey, score);
    
    document.getElementById('gameover-title').textContent = 
        score > currentHigh ? '🎉 NEW HIGH SCORE! 🎉' : 'Game Over!';
    document.getElementById('final-score').textContent = `Final Score: ${score}`;
    document.getElementById('best-combo-stat').textContent = maxCombo + 'x';
    document.getElementById('gems-matched-stat').textContent = totalGemsMatched;
    document.getElementById('high-score-stat').textContent = Math.max(score, currentHigh);
    document.getElementById('special-gems-stat').textContent = specialGemsCreated;
    
    gameoverModal.classList.add('active');
    
    if (score > currentHigh) AudioManager.success();
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

// ========== INITIALIZE ==========
AudioManager.init();

// Prevent zoom via ctrl+wheel and iOS gesture
document.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); } }, { passive: false });
document.addEventListener('gesturestart', (e) => { e.preventDefault(); });
document.querySelector('#game-board')?.addEventListener('dblclick', (e) => { e.preventDefault(); });

// Optional: expose a simple mute toggle via keyboard (m)
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') {
        soundEnabled = !soundEnabled;
    }
});
