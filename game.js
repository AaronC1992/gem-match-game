// ========== GAME CONFIGURATION ==========
const BOARD_SIZE = 8;
const GEM_TYPES = 6;
const GEM_SYMBOLS = ['💎', '🔷', '⭐', '💜', '💚', '🌸'];

// Game Modes Configuration
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
    
    match() {
        this.playTone(523.25, 0.1, 'sine'); // C note
    },
    
    combo(level) {
        const baseFreq = 523.25;
        this.playTone(baseFreq * (1 + level * 0.2), 0.15, 'triangle');
    },
    
    special() {
        this.playTone(783.99, 0.2, 'square'); // G note
        setTimeout(() => this.playTone(1046.50, 0.2, 'square'), 100); // C note
    },
    
    invalid() {
        this.playTone(200, 0.1, 'sawtooth');
    },
    
    success() {
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.15, 'sine'), i * 80);
        });
    }
};

// ========== PARTICLE EFFECTS ==========
function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.background = color;
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        
        document.body.appendChild(particle);
        
        const angle = (Math.PI * 2 * i) / count;
        const velocity = 2 + Math.random() * 3;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        animateParticle(particle, vx, vy);
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
        
        if (opacity > 0) {
            requestAnimationFrame(update);
        } else {
            particle.remove();
        }
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
    if (!achievements.firstMatch.unlocked && totalGemsMatched > 0) {
        unlockAchievement('firstMatch');
    }
    if (!achievements.combo5.unlocked && maxCombo >= 5) {
        unlockAchievement('combo5');
    }
    if (!achievements.combo10.unlocked && maxCombo >= 10) {
        unlockAchievement('combo10');
    }
    if (!achievements.score1000.unlocked && score >= 1000) {
        unlockAchievement('score1000');
    }
    if (!achievements.score5000.unlocked && score >= 5000) {
        unlockAchievement('score5000');
    }
    if (!achievements.specialGem.unlocked && specialGemsCreated > 0) {
        unlockAchievement('specialGem');
    }
    if (!achievements.gems100.unlocked && totalGemsMatched >= 100) {
        unlockAchievement('gems100');
    }
}

function unlockAchievement(key) {
    achievements[key].unlocked = true;
    const achievement = achievements[key];
    
    document.getElementById('achievement-text').textContent = achievement.desc;
    achievementPopup.classList.add('show');
    
    AudioManager.success();
    
    setTimeout(() => {
        achievementPopup.classList.remove('show');
    }, 3000);
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
    
    if (modeConfig.time) {
        gameTimer = setInterval(updateTimer, 1000);
    }
    
    updateDisplay();
    createBoard();
    renderBoard(true); // Full render for initial board
    
    // Ensure no initial matches
    while (checkMatches().length > 0) {
        createBoard();
    }
    
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

function renderBoard(fullRender = false) {
    if (fullRender) {
        // Only do full render on initial load or shuffle
        gameBoard.innerHTML = '';
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const gem = createGemElement(row, col);
                gameBoard.appendChild(gem);
            }
        }
    } else {
        // Smart update: only update changed gems
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const existingGem = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const gemData = board[row][col];
                
                if (existingGem) {
                    const currentType = parseInt(existingGem.dataset.type);
                    const hasSpecialClass = existingGem.classList.contains('special-striped') || 
                                          existingGem.classList.contains('special-wrapped') || 
                                          existingGem.classList.contains('special-bomb');
                    
                    // Only update if gem type changed or special status changed
                    if (currentType !== gemData.type || 
                        (hasSpecialClass && !gemData.special) || 
                        (!hasSpecialClass && gemData.special)) {
                        
                        existingGem.dataset.type = gemData.type;
                        existingGem.textContent = GEM_SYMBOLS[gemData.type];
                        
                        // Update special gem styling
                        existingGem.classList.remove('special-striped', 'special-wrapped', 'special-bomb');
                        
                        if (gemData.special === 'striped') {
                            existingGem.classList.add('special-striped');
                            existingGem.textContent = '⚡' + GEM_SYMBOLS[gemData.type];
                        } else if (gemData.special === 'wrapped') {
                            existingGem.classList.add('special-wrapped');
                            existingGem.textContent = '🎁';
                        } else if (gemData.special === 'bomb') {
                            existingGem.classList.add('special-bomb');
                            existingGem.textContent = '💣';
                        }
                    }
                }
            }
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
    gem.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleGemClick(row, col);
    });
    
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
    if (gem) {
        gem.classList.toggle('selected', highlight);
    }
}

function areAdjacent(gem1, gem2) {
    const rowDiff = Math.abs(gem1.row - gem2.row);
    const colDiff = Math.abs(gem1.col - gem2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

async function swapGems(gem1, gem2) {
    isProcessing = true;
    
    const temp = board[gem1.row][gem1.col];
    board[gem1.row][gem1.col] = board[gem2.row][gem2.col];
    board[gem2.row][gem2.col] = temp;
    
    renderBoard(); // Smart update
    await wait(200);
    
    const matches = checkMatches();
    
    if (matches.length > 0) {
        if (gameMode === 'classic') moves--;
        updateDisplay();
        AudioManager.match();
        await processMatches();
    } else {
        // Invalid move - swap back
        const temp = board[gem1.row][gem1.col];
        board[gem1.row][gem1.col] = board[gem2.row][gem2.col];
        board[gem2.row][gem2.col] = temp;
        renderBoard(); // Smart update
        AudioManager.invalid();
    }
    
    selectedGem = null;
    isProcessing = false;
    
    if (gameMode === 'classic' && moves <= 0) {
        endGame();
    }
    
    resetHintTimeout();
}

function checkMatches() {
    const matches = [];
    const matchGroups = [];
    
    // Check horizontal matches
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
    
    // Check vertical matches
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
    
    // Remove duplicates and store match groups
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
        
        // Show combo popup
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
            }
        });
        
        await wait(400);
        
        // Calculate score with combo multiplier
        const baseScore = matches.length * 10;
        const comboBonus = comboCount > 1 ? (comboCount - 1) * 5 : 0;
        score += baseScore + comboBonus;
        totalGemsMatched += matches.length;
        
        // Check for special gem creation
        matches.matchGroups.forEach(group => {
            if (group.length === 4) {
                // Create striped gem
                const middleMatch = group.matches[Math.floor(group.length / 2)];
                board[middleMatch.row][middleMatch.col] = {
                    type: board[middleMatch.row][middleMatch.col].type,
                    special: 'striped',
                    direction: group.direction
                };
                specialGemsCreated++;
                AudioManager.special();
            } else if (group.length >= 5) {
                // Create color bomb
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
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 500);
        }
        
        updateDisplay();
        checkAchievements();
        
        // Remove matched gems (except those that became special)
        matches.forEach(match => {
            if (board[match.row][match.col].special !== 'striped' && 
                board[match.row][match.col].special !== 'bomb') {
                board[match.row][match.col] = { type: -1, special: null };
            }
        });
        
        dropGems();
        fillBoard();
        renderBoard(); // Smart update - only changes affected gems
        
        // Add falling animation only to new/moved gems
        document.querySelectorAll('.gem').forEach(gem => {
            const row = parseInt(gem.dataset.row);
            const wasEmpty = board[row][parseInt(gem.dataset.col)].type !== -1;
            
            if (!gem.classList.contains('special-striped') && 
                !gem.classList.contains('special-bomb') && 
                !gem.classList.contains('falling')) {
                gem.classList.add('falling');
                setTimeout(() => gem.classList.remove('falling'), 400);
            }
        });
        
        await wait(400);
        
        matches = checkMatches();
    }
    
    currentCombo = 0;
    updateDisplay();
    
    // Check if no more moves available
    if (gameMode === 'classic' && !hasAvailableMove()) {
        shuffleBoard();
    }
}

function dropGems() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        let emptyRow = BOARD_SIZE - 1;
        
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (board[row][col].type !== -1) {
                if (row !== emptyRow) {
                    board[emptyRow][col] = board[row][col];
                    board[row][col] = { type: -1, special: null };
                }
                emptyRow--;
            }
        }
    }
}

function fillBoard() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col].type === -1) {
                board[row][col] = {
                    type: Math.floor(Math.random() * GEM_TYPES),
                    special: null
                };
            }
        }
    }
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
            // Try swapping with right neighbor
            if (col < BOARD_SIZE - 1) {
                if (wouldCreateMatch(row, col, row, col + 1)) {
                    return { from: { row, col }, to: { row, col: col + 1 } };
                }
            }
            // Try swapping with bottom neighbor
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
    // Temporarily swap
    const temp = board[row1][col1];
    board[row1][col1] = board[row2][col2];
    board[row2][col2] = temp;
    
    const hasMatch = checkMatches().length > 0;
    
    // Swap back
    board[row2][col2] = board[row1][col1];
    board[row1][col1] = temp;
    
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
    
    // Fisher-Yates shuffle
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
    
    renderBoard(true); // Full render for shuffle
}

// ========== UI UPDATES ==========
function updateDisplay() {
    scoreDisplay.textContent = score;
    
    if (gameMode === 'timed') {
        movesDisplay.textContent = timeLeft + 's';
    } else {
        movesDisplay.textContent = moves;
    }
    
    comboDisplay.textContent = currentCombo > 0 ? currentCombo + 'x' : '0x';
}

function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    
    // Update high score
    const highScoreKey = `highScore_${gameMode}`;
    const currentHigh = parseInt(localStorage.getItem(highScoreKey)) || 0;
    if (score > currentHigh) {
        localStorage.setItem(highScoreKey, score);
    }
    
    document.getElementById('gameover-title').textContent = 
        score > currentHigh ? '🎉 NEW HIGH SCORE! 🎉' : 'Game Over!';
    document.getElementById('final-score').textContent = `Final Score: ${score}`;
    document.getElementById('best-combo-stat').textContent = maxCombo + 'x';
    document.getElementById('gems-matched-stat').textContent = totalGemsMatched;
    document.getElementById('high-score-stat').textContent = Math.max(score, currentHigh);
    document.getElementById('special-gems-stat').textContent = specialGemsCreated;
    
    gameoverModal.classList.add('active');
    
    if (score > currentHigh) {
        AudioManager.success();
    }
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

shuffleBtn.addEventListener('click', () => {
    if (!isProcessing) {
        shuffleBoard();
    }
});

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
