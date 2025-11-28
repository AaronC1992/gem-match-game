// Game Configuration
const BOARD_SIZE = 8;
const GEM_TYPES = 6;
const INITIAL_MOVES = 30;

// Gem symbols for visual appeal
const GEM_SYMBOLS = ['💎', '🔷', '⭐', '💜', '💚', '🌸'];

// Game State
let board = [];
let score = 0;
let moves = INITIAL_MOVES;
let selectedGem = null;
let isProcessing = false;

// DOM Elements
const gameBoard = document.getElementById('game-board');
const scoreDisplay = document.getElementById('score');
const movesDisplay = document.getElementById('moves');
const newGameBtn = document.getElementById('new-game');

// Initialize Game
function initGame() {
    board = [];
    score = 0;
    moves = INITIAL_MOVES;
    selectedGem = null;
    isProcessing = false;
    
    updateDisplay();
    createBoard();
    renderBoard();
    
    // Ensure no initial matches
    while (checkMatches().length > 0) {
        createBoard();
    }
}

// Create Board Data
function createBoard() {
    board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = Math.floor(Math.random() * GEM_TYPES);
        }
    }
}

// Render Board to DOM
function renderBoard() {
    gameBoard.innerHTML = '';
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const gem = createGemElement(row, col);
            gameBoard.appendChild(gem);
        }
    }
}

// Create Gem Element
function createGemElement(row, col) {
    const gem = document.createElement('div');
    gem.className = 'gem';
    gem.dataset.row = row;
    gem.dataset.col = col;
    gem.dataset.type = board[row][col];
    gem.textContent = GEM_SYMBOLS[board[row][col]];
    
    // Touch and click events
    gem.addEventListener('click', () => handleGemClick(row, col));
    gem.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleGemClick(row, col);
    });
    
    return gem;
}

// Handle Gem Click/Touch
function handleGemClick(row, col) {
    if (isProcessing || moves <= 0) return;
    
    const clickedGem = { row, col };
    
    if (!selectedGem) {
        // First gem selected
        selectedGem = clickedGem;
        highlightGem(row, col, true);
    } else {
        // Second gem selected
        if (selectedGem.row === row && selectedGem.col === col) {
            // Deselect same gem
            highlightGem(row, col, false);
            selectedGem = null;
        } else if (areAdjacent(selectedGem, clickedGem)) {
            // Swap adjacent gems
            highlightGem(selectedGem.row, selectedGem.col, false);
            swapGems(selectedGem, clickedGem);
        } else {
            // Select different gem
            highlightGem(selectedGem.row, selectedGem.col, false);
            selectedGem = clickedGem;
            highlightGem(row, col, true);
        }
    }
}

// Highlight Gem
function highlightGem(row, col, highlight) {
    const gem = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (gem) {
        if (highlight) {
            gem.classList.add('selected');
        } else {
            gem.classList.remove('selected');
        }
    }
}

// Check if gems are adjacent
function areAdjacent(gem1, gem2) {
    const rowDiff = Math.abs(gem1.row - gem2.row);
    const colDiff = Math.abs(gem1.col - gem2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Swap Gems
async function swapGems(gem1, gem2) {
    isProcessing = true;
    
    // Swap in board array
    const temp = board[gem1.row][gem1.col];
    board[gem1.row][gem1.col] = board[gem2.row][gem2.col];
    board[gem2.row][gem2.col] = temp;
    
    renderBoard();
    
    await wait(200);
    
    const matches = checkMatches();
    
    if (matches.length > 0) {
        // Valid move
        moves--;
        updateDisplay();
        await processMatches();
    } else {
        // Invalid move - swap back
        const temp = board[gem1.row][gem1.col];
        board[gem1.row][gem1.col] = board[gem2.row][gem2.col];
        board[gem2.row][gem2.col] = temp;
        renderBoard();
    }
    
    selectedGem = null;
    isProcessing = false;
    
    if (moves <= 0) {
        setTimeout(() => {
            alert(`Game Over! Final Score: ${score}`);
        }, 500);
    }
}

// Check for Matches
function checkMatches() {
    const matches = [];
    
    // Check horizontal matches
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
            const type = board[row][col];
            if (type === board[row][col + 1] && type === board[row][col + 2]) {
                let matchLength = 3;
                while (col + matchLength < BOARD_SIZE && board[row][col + matchLength] === type) {
                    matchLength++;
                }
                
                for (let i = 0; i < matchLength; i++) {
                    matches.push({ row, col: col + i });
                }
                
                col += matchLength - 1;
            }
        }
    }
    
    // Check vertical matches
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE - 2; row++) {
            const type = board[row][col];
            if (type === board[row + 1][col] && type === board[row + 2][col]) {
                let matchLength = 3;
                while (row + matchLength < BOARD_SIZE && board[row + matchLength][col] === type) {
                    matchLength++;
                }
                
                for (let i = 0; i < matchLength; i++) {
                    matches.push({ row: row + i, col });
                }
                
                row += matchLength - 1;
            }
        }
    }
    
    // Remove duplicates
    return matches.filter((match, index, self) =>
        index === self.findIndex(m => m.row === match.row && m.col === match.col)
    );
}

// Process Matches
async function processMatches() {
    let matches = checkMatches();
    
    while (matches.length > 0) {
        // Highlight matches
        matches.forEach(match => {
            const gem = document.querySelector(`[data-row="${match.row}"][data-col="${match.col}"]`);
            if (gem) gem.classList.add('matching');
        });
        
        await wait(400);
        
        // Update score
        score += matches.length * 10;
        updateDisplay();
        
        // Remove matched gems
        matches.forEach(match => {
            board[match.row][match.col] = -1;
        });
        
        // Drop gems
        dropGems();
        
        // Fill empty spaces
        fillBoard();
        
        // Render with animation
        renderBoard();
        document.querySelectorAll('.gem').forEach(gem => {
            gem.classList.add('falling');
        });
        
        await wait(400);
        
        // Check for new matches
        matches = checkMatches();
    }
}

// Drop Gems
function dropGems() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        let emptyRow = BOARD_SIZE - 1;
        
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (board[row][col] !== -1) {
                if (row !== emptyRow) {
                    board[emptyRow][col] = board[row][col];
                    board[row][col] = -1;
                }
                emptyRow--;
            }
        }
    }
}

// Fill Board
function fillBoard() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === -1) {
                board[row][col] = Math.floor(Math.random() * GEM_TYPES);
            }
        }
    }
}

// Update Display
function updateDisplay() {
    scoreDisplay.textContent = score;
    movesDisplay.textContent = moves;
}

// Wait Helper
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Event Listeners
newGameBtn.addEventListener('click', initGame);

// Start Game
initGame();