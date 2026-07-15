// ============================================================
// LUDOMANIKS CASINO — Mini App Script
// ============================================================

// --- Инициализация Telegram WebApp ---
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.MainButton.hide();
}

// --- Состояние игры ---
const state = {
    balance: 1000,
    currentGame: null,
    bet: 0,
    gameData: null
};

// --- DOM-элементы ---
const $ = (id) => document.getElementById(id);
const balanceEl = $('balance');
const mainMenu = $('mainMenu');
const gameScreen = $('gameScreen');
const gameContent = $('gameContent');
const gameTitle = $('gameTitle');
const backBtn = $('backBtn');

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    updateBalance(1000);
    setupMenuButtons();
    setupBackButton();
});

// --- Обновление баланса ---
function updateBalance(amount) {
    state.balance = Math.max(0, amount);
    balanceEl.textContent = Math.round(amount).toLocaleString('ru-RU');
}

// --- Настройка кнопок меню ---
function setupMenuButtons() {
    document.querySelectorAll('.game-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const game = btn.dataset.game;
            openGame(game);
        });
    });
}

// --- Настройка кнопки "Назад" ---
function setupBackButton() {
    backBtn.addEventListener('click', showMainMenu);
}

// --- Показать главное меню ---
function showMainMenu() {
    mainMenu.style.display = 'flex';
    gameScreen.style.display = 'none';
    if (tg) {
        tg.sendData(JSON.stringify({ action: 'menu' }));
    }
}

// --- Открыть игру ---
function openGame(game) {
    mainMenu.style.display = 'none';
    gameScreen.style.display = 'flex';
    state.currentGame = game;
    
    const titles = {
        mines: '💣 Минное поле',
        roulette: '🎡 Рулетка',
        slots: '🎰 Слоты',
        dice: '🎲 Кости',
        coin: '🪙 Монетка'
    };
    gameTitle.textContent = titles[game] || 'Игра';
    
    renderGame(game);
}

// --- Рендеринг игр ---
function renderGame(game) {
    const games = {
        mines: renderMines,
        roulette: renderRoulette,
        slots: renderSlots,
        dice: renderDice,
        coin: renderCoin
    };
    
    if (games[game]) {
        games[game]();
    }
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СТАВОК
// ============================================================

function setupBetControls(betDisplayId, betCallback) {
    let bet = 100;
    const display = document.getElementById(betDisplayId);
    
    // Стандартные кнопки ставок
    document.querySelectorAll('[data-bet]').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseInt(btn.dataset.bet);
            if (value > 0) {
                bet = value;
                display.textContent = bet;
                if (betCallback) betCallback(bet);
            }
        });
    });
    
    // Кнопка "Своя ставка"
    document.querySelectorAll('.custom-bet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.querySelector('.custom-bet-input');
            if (input) {
                const value = parseInt(input.value);
                if (value > 0 && value <= 1000000) {
                    bet = value;
                    display.textContent = bet;
                    if (betCallback) betCallback(bet);
                    input.value = '';
                } else {
                    alert('Введите число от 1 до 1 000 000');
                }
            }
        });
    });
    
    // Enter на поле ввода
    document.querySelectorAll('.custom-bet-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = parseInt(input.value);
                if (value > 0 && value <= 1000000) {
                    bet = value;
                    display.textContent = bet;
                    if (betCallback) betCallback(bet);
                    input.value = '';
                }
            }
        });
    });
    
    return {
        getBet: () => bet,
        setBet: (value) => {
            if (value > 0) {
                bet = value;
                display.textContent = bet;
                if (betCallback) betCallback(bet);
            }
        }
    };
}

// ============================================================
// 💣 МИННОЕ ПОЛЕ
// ============================================================
function renderMines() {
    const html = `
        <div class="game-info">
            <div class="bet-label">СТАВКА</div>
            <div class="bet-value" id="minesBet">100</div>
        </div>
        <div class="game-buttons">
            <button class="btn" data-bet="10">10</button>
            <button class="btn" data-bet="25">25</button>
            <button class="btn" data-bet="50">50</button>
            <button class="btn" data-bet="100">100</button>
            <button class="btn" data-bet="250">250</button>
            <button class="btn" data-bet="500">500</button>
            <button class="btn" data-bet="1000">1000</button>
            <button class="btn" data-bet="5000">5000</button>
        </div>
        <div class="game-buttons" style="gap: 6px;">
            <input type="number" class="custom-bet-input" placeholder="Своя ставка" min="1" max="1000000" style="
                background: rgba(20,20,40,0.5);
                border: 1px solid rgba(100,100,200,0.12);
                border-radius: 8px;
                padding: 10px 14px;
                color: #b8b8d0;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                width: 60%;
                max-width: 180px;
                text-align: center;
                outline: none;
            ">
            <button class="btn btn-primary custom-bet-btn" style="width: 35%; max-width: 120px;">✅</button>
        </div>
        <div class="game-result" id="minesResult">Выбери ставку</div>
        <div class="mines-grid" id="minesGrid"></div>
        <div class="game-buttons">
            <button class="btn btn-success" id="minesStart">🚀 СТАРТ</button>
            <button class="btn btn-primary" id="minesCashout">💵 ЗАБРАТЬ</button>
        </div>
    `;
    gameContent.innerHTML = html;
    
    let bet = 100;
    let gameActive = false;
    let minePositions = [];
    let revealed = [];
    let gameStarted = false;
    let currentMultiplier = 1.0;
    
    // Настройка ставок
    const betControls = setupBetControls('minesBet', (newBet) => {
        bet = newBet;
    });
    
    // Старт игры
    document.getElementById('minesStart').addEventListener('click', () => {
        if (gameActive) return;
        if (state.balance < bet) {
            document.getElementById('minesResult').textContent = '❌ Недостаточно средств!';
            document.getElementById('minesResult').className = 'game-result lose';
            return;
        }
        
        state.bet = bet;
        gameActive = true;
        gameStarted = true;
        minePositions = generateMines(3);
        revealed = [];
        currentMultiplier = 1.0;
        
        updateBalance(state.balance - bet);
        document.getElementById('minesResult').textContent = '💣 Открывай клетки!';
        document.getElementById('minesResult').className = 'game-result';
        renderMinesGrid();
        
        if (tg) {
            tg.sendData(JSON.stringify({ 
                action: 'mines_start', 
                bet: bet 
            }));
        }
    });
    
    // Забрать выигрыш
    document.getElementById('minesCashout').addEventListener('click', () => {
        if (!gameActive || !gameStarted || revealed.length === 0) {
            document.getElementById('minesResult').textContent = '❌ Сначала сделай ход!';
            document.getElementById('minesResult').className = 'game-result lose';
            return;
        }
        
        const win = Math.round(bet * currentMultiplier);
        updateBalance(state.balance + win);
        gameActive = false;
        
        document.getElementById('minesResult').textContent = `✅ Забрано! +${win.toLocaleString('ru-RU')} 💰`;
        document.getElementById('minesResult').className = 'game-result win';
        
        if (tg) {
            tg.sendData(JSON.stringify({ 
                action: 'mines_cashout', 
                win: win 
            }));
        }
    });
    
    function generateMines(count = 3) {
        const positions = [];
        while (positions.length < count) {
            const pos = Math.floor(Math.random() * 25);
            if (!positions.includes(pos)) positions.push(pos);
        }
        return positions;
    }
    
    function renderMinesGrid() {
        const grid = document.getElementById('minesGrid');
        grid.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.className = 'mines-cell';
            cell.dataset.index = i;
            cell.textContent = '❔';
            cell.addEventListener('click', () => handleMinesClick(i));
            grid.appendChild(cell);
        }
    }
    
    function handleMinesClick(index) {
        if (!gameActive || !gameStarted) return;
        if (revealed.includes(index)) return;
        
        revealed.push(index);
        const cell = document.querySelector(`.mines-cell[data-index="${index}"]`);
        
        if (minePositions.includes(index)) {
            cell.textContent = '💣';
            cell.className = 'mines-cell mine';
            gameActive = false;
            document.getElementById('minesResult').textContent = '💥 БУМ! Ты проиграл!';
            document.getElementById('minesResult').className = 'game-result lose';
            revealAllMines();
            
            if (tg) {
                tg.sendData(JSON.stringify({ action: 'mines_lose' }));
            }
        } else {
            cell.textContent = '✅';
            cell.className = 'mines-cell safe';
            
            const safeCount = 25 - minePositions.length;
            currentMultiplier = 1.0 + (revealed.length / safeCount) * 1.5;
            
            const potentialWin = Math.round(bet * currentMultiplier);
            document.getElementById('minesResult').textContent = `🎯 +${potentialWin.toLocaleString('ru-RU')} 💰 (x${currentMultiplier.toFixed(2)})`;
            document.getElementById('minesResult').className = 'game-result';
            
            if (revealed.length === safeCount) {
                gameActive = false;
                const win = Math.round(bet * currentMultiplier);
                updateBalance(state.balance + win);
                document.getElementById('minesResult').textContent = `🎉 ВЫИГРЫШ! +${win.toLocaleString('ru-RU')} 💰`;
                document.getElementById('minesResult').className = 'game-result win';
                
                if (tg) {
                    tg.sendData(JSON.stringify({ 
                        action: 'mines_win', 
                        win: win 
                    }));
                }
            }
        }
    }
    
    function revealAllMines() {
        document.querySelectorAll('.mines-cell').forEach(cell => {
            const idx = parseInt(cell.dataset.index);
            if (minePositions.includes(idx) && !revealed.includes(idx)) {
                cell.textContent = '💣';
                cell.className = 'mines-cell mine';
            }
        });
    }
}

// ============================================================
// 🎡 РУЛЕТКА
// ============================================================
function renderRoulette() {
    const html = `
        <div class="game-info">
            <div class="bet-label">СТАВКА</div>
            <div class="bet-value" id="rouletteBet">100</div>
        </div>
        <div class="game-buttons">
            <button class="btn" data-bet="10">10</button>
            <button class="btn" data-bet="25">25</button>
            <button class="btn" data-bet="50">50</button>
            <button class="btn" data-bet="100">100</button>
            <button class="btn" data-bet="250">250</button>
            <button class="btn" data-bet="500">500</button>
            <button class="btn" data-bet="1000">1000</button>
            <button class="btn" data-bet="5000">5000</button>
        </div>
        <div class="game-buttons" style="gap: 6px;">
            <input type="number" class="custom-bet-input" placeholder="Своя ставка" min="1" max="1000000" style="
                background: rgba(20,20,40,0.5);
                border: 1px solid rgba(100,100,200,0.12);
                border-radius: 8px;
                padding: 10px 14px;
                color: #b8b8d0;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                width: 60%;
                max-width: 180px;
                text-align: center;
                outline: none;
            ">
            <button class="btn btn-primary custom-bet-btn" style="width: 35%; max-width: 120px;">✅</button>
        </div>
        <div class="roulette-number" id="rouletteNumber">🎡</div>
        <div class="game-buttons">
            <button class="btn btn-danger" data-type="red">🔴 КРАСНОЕ</button>
            <button class="btn" data-type="black">⚫ ЧЁРНОЕ</button>
            <button class="btn btn-success" data-type="green">🟢 ЗЕРО</button>
        </div>
        <div class="game-buttons">
            <button class="btn" data-type="even">ЧЁТ</button>
            <button class="btn" data-type="odd">НЕЧЕТ</button>
            <button class="btn" data-type="low">1-18</button>
            <button class="btn" data-type="high">19-36</button>
        </div>
        <div class="game-result" id="rouletteResult">Выбери ставку</div>
    `;
    gameContent.innerHTML = html;
    
    let bet = 100;
    let spinning = false;
    
    // Настройка ставок
    const betControls = setupBetControls('rouletteBet', (newBet) => {
        bet = newBet;
    });
    
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (spinning) return;
            if (state.balance < bet) {
                document.getElementById('rouletteResult').textContent = '❌ Недостаточно средств!';
                document.getElementById('rouletteResult').className = 'game-result lose';
                return;
            }
            
            spinning = true;
            const type = btn.dataset.type;
            const numEl = document.getElementById('rouletteNumber');
            
            // Анимация прокрутки
            const colors = ['red', 'black', 'green'];
            for (let i = 0; i < 8; i++) {
                const preview = Math.floor(Math.random() * 37);
                const color = preview === 0 ? 'green' : (preview % 2 === 0 ? 'red' : 'black');
                numEl.textContent = preview;
                numEl.className = `roulette-number ${color}`;
                await sleep(100);
            }
            
            // Результат
            const number = Math.floor(Math.random() * 37);
            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
            let color = 'green';
            if (redNumbers.includes(number)) color = 'red';
            else if (number > 0) color = 'black';
            
            numEl.textContent = number;
            numEl.className = `roulette-number ${color}`;
            
            updateBalance(state.balance - bet);
            
            let win = false;
            let multiplier = 0;
            
            if (type === 'red' && color === 'red') { win = true; multiplier = 2; }
            else if (type === 'black' && color === 'black') { win = true; multiplier = 2; }
            else if (type === 'green' && number === 0) { win = true; multiplier = 14; }
            else if (type === 'even' && number > 0 && number % 2 === 0) { win = true; multiplier = 2; }
            else if (type === 'odd' && number > 0 && number % 2 === 1) { win = true; multiplier = 2; }
            else if (type === 'low' && number >= 1 && number <= 18) { win = true; multiplier = 2; }
            else if (type === 'high' && number >= 19 && number <= 36) { win = true; multiplier = 2; }
            
            const resultEl = document.getElementById('rouletteResult');
            if (win) {
                const winAmount = bet * multiplier;
                updateBalance(state.balance + winAmount);
                resultEl.textContent = `🎉 ВЫИГРЫШ! +${winAmount.toLocaleString('ru-RU')} 💰`;
                resultEl.className = 'game-result win';
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'roulette_win', win: winAmount }));
                }
            } else {
                resultEl.textContent = `😢 Проигрыш: ${bet.toLocaleString('ru-RU')} 💰`;
                resultEl.className = 'game-result lose';
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'roulette_lose' }));
                }
            }
            
            spinning = false;
        });
    });
}

// ============================================================
// 🎰 СЛОТЫ
// ============================================================
function renderSlots() {
    const html = `
        <div class="game-info">
            <div class="bet-label">СТАВКА</div>
            <div class="bet-value" id="slotsBet">100</div>
        </div>
        <div class="game-buttons">
            <button class="btn" data-bet="10">10</button>
            <button class="btn" data-bet="25">25</button>
            <button class="btn" data-bet="50">50</button>
            <button class="btn" data-bet="100">100</button>
            <button class="btn" data-bet="250">250</button>
            <button class="btn" data-bet="500">500</button>
            <button class="btn" data-bet="1000">1000</button>
            <button class="btn" data-bet="5000">5000</button>
        </div>
        <div class="game-buttons" style="gap: 6px;">
            <input type="number" class="custom-bet-input" placeholder="Своя ставка" min="1" max="1000000" style="
                background: rgba(20,20,40,0.5);
                border: 1px solid rgba(100,100,200,0.12);
                border-radius: 8px;
                padding: 10px 14px;
                color: #b8b8d0;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                width: 60%;
                max-width: 180px;
                text-align: center;
                outline: none;
            ">
            <button class="btn btn-primary custom-bet-btn" style="width: 35%; max-width: 120px;">✅</button>
        </div>
        <div class="slots-display" id="slotsDisplay">🍒 🍋 🍊</div>
        <button class="btn btn-primary" id="slotsSpin">🎰 КРУТИТЬ</button>
        <div class="game-result" id="slotsResult">Нажми крутить</div>
    `;
    gameContent.innerHTML = html;
    
    let bet = 100;
    let spinning = false;
    
    // Настройка ставок
    const betControls = setupBetControls('slotsBet', (newBet) => {
        bet = newBet;
    });
    
    document.getElementById('slotsSpin').addEventListener('click', async () => {
        if (spinning) return;
        if (state.balance < bet) {
            document.getElementById('slotsResult').textContent = '❌ Недостаточно средств!';
            document.getElementById('slotsResult').className = 'game-result lose';
            return;
        }
        
        spinning = true;
        const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '🔔', '⭐', '7️⃣', '🎰'];
        const display = document.getElementById('slotsDisplay');
        
        // Анимация
        for (let i = 0; i < 5; i++) {
            const r1 = symbols[Math.floor(Math.random() * symbols.length)];
            const r2 = symbols[Math.floor(Math.random() * symbols.length)];
            const r3 = symbols[Math.floor(Math.random() * symbols.length)];
            display.textContent = `${r1} ${r2} ${r3}`;
            await sleep(150);
        }
        
        // Результат
        const results = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];
        display.textContent = results.join(' ');
        
        updateBalance(state.balance - bet);
        
        let win = false;
        let winAmount = 0;
        
        if (results[0] === results[1] && results[1] === results[2]) {
            win = true;
            const multipliers = { '🎰': 50, '7️⃣': 30, '💎': 20, '🔔': 15, '⭐': 10, '🍇': 8, '🍊': 5, '🍋': 3, '🍒': 2 };
            winAmount = bet * (multipliers[results[0]] || 2);
        } else if (results[0] === results[1] || results[0] === results[2] || results[1] === results[2]) {
            win = true;
            winAmount = bet * 2;
        }
        
        const resultEl = document.getElementById('slotsResult');
        if (win) {
            updateBalance(state.balance + winAmount);
            resultEl.textContent = `🎉 ВЫИГРЫШ! +${winAmount.toLocaleString('ru-RU')} 💰`;
            resultEl.className = 'game-result win';
            if (tg) {
                tg.sendData(JSON.stringify({ action: 'slots_win', win: winAmount }));
            }
        } else {
            resultEl.textContent = `😢 Проигрыш: ${bet.toLocaleString('ru-RU')} 💰`;
            resultEl.className = 'game-result lose';
            if (tg) {
                tg.sendData(JSON.stringify({ action: 'slots_lose' }));
            }
        }
        
        spinning = false;
    });
}

// ============================================================
// 🎲 КОСТИ
// ============================================================
function renderDice() {
    const html = `
        <div class="game-info">
            <div class="bet-label">СТАВКА</div>
            <div class="bet-value" id="diceBet">100</div>
        </div>
        <div class="game-buttons">
            <button class="btn" data-bet="10">10</button>
            <button class="btn" data-bet="25">25</button>
            <button class="btn" data-bet="50">50</button>
            <button class="btn" data-bet="100">100</button>
            <button class="btn" data-bet="250">250</button>
            <button class="btn" data-bet="500">500</button>
            <button class="btn" data-bet="1000">1000</button>
            <button class="btn" data-bet="5000">5000</button>
        </div>
        <div class="game-buttons" style="gap: 6px;">
            <input type="number" class="custom-bet-input" placeholder="Своя ставка" min="1" max="1000000" style="
                background: rgba(20,20,40,0.5);
                border: 1px solid rgba(100,100,200,0.12);
                border-radius: 8px;
                padding: 10px 14px;
                color: #b8b8d0;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                width: 60%;
                max-width: 180px;
                text-align: center;
                outline: none;
            ">
            <button class="btn btn-primary custom-bet-btn" style="width: 35%; max-width: 120px;">✅</button>
        </div>
        <div class="dice-display" id="diceDisplay">🎲</div>
        <div class="game-buttons">
            <button class="btn" data-choice="under">⬇️ 1-3</button>
            <button class="btn" data-choice="over">⬆️ 4-6</button>
        </div>
        <div class="game-buttons">
            <button class="btn" data-choice="1">1</button>
            <button class="btn" data-choice="2">2</button>
            <button class="btn" data-choice="3">3</button>
            <button class="btn" data-choice="4">4</button>
            <button class="btn" data-choice="5">5</button>
            <button class="btn" data-choice="6">6</button>
        </div>
        <div class="game-result" id="diceResult">Выбери исход</div>
    `;
    gameContent.innerHTML = html;
    
    let bet = 100;
    let rolling = false;
    
    // Настройка ставок
    const betControls = setupBetControls('diceBet', (newBet) => {
        bet = newBet;
    });
    
    document.querySelectorAll('[data-choice]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (rolling) return;
            if (state.balance < bet) {
                document.getElementById('diceResult').textContent = '❌ Недостаточно средств!';
                document.getElementById('diceResult').className = 'game-result lose';
                return;
            }
            
            rolling = true;
            const choice = btn.dataset.choice;
            const display = document.getElementById('diceDisplay');
            
            // Анимация
            for (let i = 0; i < 6; i++) {
                display.textContent = `🎲 ${Math.floor(Math.random() * 6) + 1}`;
                await sleep(120);
            }
            
            // Результат
            const roll = Math.floor(Math.random() * 6) + 1;
            display.textContent = `🎲 ${roll}`;
            
            updateBalance(state.balance - bet);
            
            let win = false;
            let multiplier = 0;
            
            if (choice === 'under' && roll <= 3) { win = true; multiplier = 1.9; }
            else if (choice === 'over' && roll >= 4) { win = true; multiplier = 1.9; }
            else if (parseInt(choice) === roll) { win = true; multiplier = 5; }
            
            const resultEl = document.getElementById('diceResult');
            if (win) {
                const winAmount = Math.round(bet * multiplier);
                updateBalance(state.balance + winAmount);
                resultEl.textContent = `🎉 ВЫИГРЫШ! +${winAmount.toLocaleString('ru-RU')} 💰`;
                resultEl.className = 'game-result win';
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'dice_win', win: winAmount }));
                }
            } else {
                resultEl.textContent = `😢 Проигрыш: ${bet.toLocaleString('ru-RU')} 💰`;
                resultEl.className = 'game-result lose';
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'dice_lose' }));
                }
            }
            
            rolling = false;
        });
    });
}

// ============================================================
// 🪙 МОНЕТКА
// ============================================================
function renderCoin() {
    const html = `
        <div class="game-info">
            <div class="bet-label">СТАВКА</div>
            <div class="bet-value" id="coinBet">100</div>
        </div>
        <div class="game-buttons">
            <button class="btn" data-bet="10">10</button>
            <button class="btn" data-bet="25">25</button>
            <button class="btn" data-bet="50">50</button>
            <button class="btn" data-bet="100">100</button>
            <button class="btn" data-bet="250">250</button>
            <button class="btn" data-bet="500">500</button>
            <button class="btn" data-bet="1000">1000</button>
            <button class="btn" data-bet="5000">5000</button>
        </div>
        <div class="game-buttons" style="gap: 6px;">
            <input type="number" class="custom-bet-input" placeholder="Своя ставка" min="1" max="1000000" style="
                background: rgba(20,20,40,0.5);
                border: 1px solid rgba(100,100,200,0.12);
                border-radius: 8px;
                padding: 10px 14px;
                color: #b8b8d0;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                width: 60%;
                max-width: 180px;
                text-align: center;
                outline: none;
            ">
            <button class="btn btn-primary custom-bet-btn" style="width: 35%; max-width: 120px;">✅</button>
        </div>
        <div class="coin-display" id="coinDisplay">🪙</div>
        <div class="game-buttons">
            <button class="btn" data-choice="heads">🦅 ОРЁЛ</button>
            <button class="btn" data-choice="tails">🪙 РЕШКА</button>
        </div>
        <div class="game-result" id="coinResult">Выбери сторону</div>
    `;
    gameContent.innerHTML = html;
    
    let bet = 100;
    let flipping = false;
    
    // Настройка ставок
    const betControls = setupBetControls('coinBet', (newBet) => {
        bet = newBet;
    });
    
    document.querySelectorAll('[data-choice]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (flipping) return;
            if (state.balance < bet) {
                document.getElementById('coinResult').textContent = '❌ Недостаточно средств!';
                document.getElementById('coinResult').className = 'game-result lose';
                return;
            }
            
            flipping = true;
            const choice = btn.dataset.choice;
            const display = document.getElementById('coinDisplay');
            
            // Анимация
            const frames = ['🪙', '🌕', '🪙', '🌗', '🪙', '🌑', '🪙'];
            for (const frame of frames) {
                display.textContent = frame;
                display.style.transform = 'scale(1.2)';
                await sleep(150);
                display.style.transform = 'scale(1)';
                await sleep(50);
            }
            
            // Результат
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            display.textContent = result === 'heads' ? '🦅' : '🪙';
            
            updateBalance(state.balance - bet);
            
            const win = (choice === result);
            const resultEl = document.getElementById('coinResult');
            
            if (win) {
                const winAmount = bet * 2;
                updateBalance(state.balance + winAmount);
                resultEl.textContent = `🎉 ВЫИГРЫШ! +${winAmount.toLocaleString('ru-RU')} 💰`;
                resultEl.className = 'game-result win';
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'coin_win', win: winAmount }));
                }
            } else {
                resultEl.textContent = `😢 Проигрыш: ${bet.toLocaleString('ru-RU')} 💰`;
                resultEl.className = 'game-result lose';
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'coin_lose' }));
                }
            }
            
            flipping = false;
        });
    });
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Обработка данных от бота
if (tg) {
    tg.onEvent('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.action === 'update_balance') {
                updateBalance(data.balance);
            }
        } catch (e) {
            // Игнорируем ошибки парсинга
        }
    });
}

console.log('🎰 LUDOMANIKS CASINO загружен!');
