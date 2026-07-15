// ===== TELEGRAM WEB APP ИНИЦИАЛИЗАЦИЯ =====
const tg = window.Telegram?.WebApp;
if (!tg) {
    console.error('❌ Telegram WebApp не найден!');
} else {
    tg.ready();
    tg.expand();
    tg.MainButton.hide();
    tg.setHeaderColor('#050505');
    tg.setBackgroundColor('#050505');
}

// ===== ПАРАЛЛАКС-ЭФФЕКТ ПРИ ДВИЖЕНИИ МЫШИ =====
let mouseX = 0;
let mouseY = 0;

if (window.innerWidth > 768) {
    document.addEventListener('mousemove', (e) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        mouseX = (e.clientX - centerX) / centerX * 50;
        mouseY = (e.clientY - centerY) / centerY * 50;

        document.documentElement.style.setProperty('--mouse-x', mouseX);
        document.documentElement.style.setProperty('--mouse-y', mouseY);
    });
}

if (window.DeviceOrientationEvent && window.innerWidth <= 768) {
    window.addEventListener('deviceorientation', (e) => {
        mouseX = (e.gamma || 0) * 2;
        mouseY = (e.beta || 0) * 2;

        mouseX = Math.max(-50, Math.min(50, mouseX));
        mouseY = Math.max(-50, Math.min(50, mouseY));

        document.documentElement.style.setProperty('--mouse-x', mouseX);
        document.documentElement.style.setProperty('--mouse-y', mouseY);
    });
}

// ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====
const state = {
    balance: 0,
    userId: tg?.initDataUnsafe?.user?.id || 0,
    currentGame: null,
    bet: 10,
    isBalanceLoaded: false
};

// ===== УТИЛИТЫ =====
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== СИНХРОНИЗАЦИЯ С БОТОМ =====

function sendAction(action, data = {}) {
    if (!tg) {
        console.warn('⚠️ Telegram WebApp не инициализирован');
        return;
    }
    const payload = { action, ...data };
    console.log('📤 Отправка боту:', JSON.stringify(payload));
    tg.sendData(JSON.stringify(payload));
}

function updateBalance(newBalance) {
    state.balance = Math.max(0, newBalance);
    
    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
        balanceEl.textContent = state.balance.toLocaleString('ru-RU');
    }
    
    localStorage.setItem('balance', state.balance);
    
    document.querySelectorAll('.current-bet-display').forEach(el => {
        el.textContent = state.balance;
    });

    console.log('💰 Баланс обновлен:', state.balance);
}

function requestBalance() {
    console.log('📥 Запрос баланса...');
    sendAction('get_balance');
}

// Обработка входящих сообщений от бота
if (tg) {
    tg.onEvent('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📩 Получено от бота:', data);

            if (data.action === 'balance_updated' || data.action === 'update_balance') {
                if (data.balance !== undefined) {
                    state.isBalanceLoaded = true;
                    updateBalance(data.balance);
                    console.log('✅ Баланс синхронизирован:', data.balance);
                }
            }
        } catch (e) {
            console.error('❌ Ошибка обработки:', e);
        }
    });
}

// ===== ЭФФЕКТ РЯБИ ПРИ КЛИКЕ =====
function createRipple(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    button.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
}

// ===== ВИБРАЦИЯ ДЛЯ TELEGRAM =====
function hapticFeedback(type = 'light') {
    if (tg?.HapticFeedback) {
        switch(type) {
            case 'light': tg.HapticFeedback.impactOccurred('light'); break;
            case 'medium': tg.HapticFeedback.impactOccurred('medium'); break;
            case 'heavy': tg.HapticFeedback.impactOccurred('heavy'); break;
            case 'success': tg.HapticFeedback.notificationOccurred('success'); break;
            case 'error': tg.HapticFeedback.notificationOccurred('error'); break;
        }
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ =====
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Инициализация приложения...');
    
    const savedBalance = localStorage.getItem('balance');
    if (savedBalance) {
        state.balance = parseInt(savedBalance);
        updateBalance(state.balance);
    }

    initMainMenu();
    addSyncButton();
    
    requestBalance();

    setTimeout(() => {
        if (!state.isBalanceLoaded) {
            console.log('⏰ Таймаут, устанавливаем начальный баланс');
            const startBalance = parseInt(localStorage.getItem('balance')) || 1000;
            updateBalance(startBalance);
            state.isBalanceLoaded = true;
        }
    }, 3000);

    setTimeout(() => {
        document.querySelectorAll('button').forEach(btn => {
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.addEventListener('click', createRipple);
        });
    }, 100);
});

// ===== НАВИГАЦИЯ =====

function initMainMenu() {
    const mainMenu = document.getElementById('main-menu');
    const gameScreen = document.getElementById('game-screen');

    document.getElementById('btn-mines')?.addEventListener('click', () => openGame('mines', 'Минное поле'));
    document.getElementById('btn-roulette')?.addEventListener('click', () => openGame('roulette', 'Рулетка'));
    document.getElementById('btn-slots')?.addEventListener('click', () => openGame('slots', 'Слоты'));
    document.getElementById('btn-dice')?.addEventListener('click', () => openGame('dice', 'Кости'));
    document.getElementById('btn-coin')?.addEventListener('click', () => openGame('coin', 'Монетка'));

    document.getElementById('btn-back')?.addEventListener('click', () => {
        mainMenu.style.display = 'block';
        gameScreen.style.display = 'none';
        state.currentGame = null;
        requestBalance();
    });
}

function openGame(gameName, gameTitle) {
    state.currentGame = gameName;
    hapticFeedback('light');

    const mainMenu = document.getElementById('main-menu');
    const gameScreen = document.getElementById('game-screen');
    const gameContent = document.getElementById('game-content');
    const gameScreenTitle = document.getElementById('game-screen-title');

    mainMenu.style.display = 'none';
    gameScreen.style.display = 'block';
    gameScreenTitle.textContent = gameTitle;

    switch(gameName) {
        case 'mines': renderMinesGame(gameContent); break;
        case 'roulette': renderRouletteGame(gameContent); break;
        case 'slots': renderSlotsGame(gameContent); break;
        case 'dice': renderDiceGame(gameContent); break;
        case 'coin': renderCoinGame(gameContent); break;
    }

    setTimeout(() => {
        gameContent.querySelectorAll('button').forEach(btn => {
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            if (!btn.hasAttribute('data-ripple')) {
                btn.addEventListener('click', createRipple);
                btn.setAttribute('data-ripple', 'true');
            }
        });
    }, 100);
}

// ===== КОМПОНЕНТ СТАВОК =====

function createBetSelector(onBetChange) {
    const betAmounts = [10, 25, 50, 100, 250, 500, 1000, 5000];

    let html = '<div class="bet-selector">';
    html += '<h3>Ваша ставка:</h3>';
    html += '<div class="bet-buttons">';

    betAmounts.forEach(amount => {
        html += `<button class="bet-btn ${state.bet === amount ? 'active' : ''}" data-bet="${amount}">${amount} ₽</button>`;
    });

    html += '</div>';
    html += '<div class="custom-bet">';
    html += '<input type="number" id="custom-bet-input" placeholder="Своя ставка" min="1" max="999999">';
    html += '<button id="custom-bet-confirm">✅</button>';
    html += '</div>';
    html += '<div class="current-bet">Ставка: <span class="current-bet-display">' + state.bet + ' ₽</span></div>';
    html += '</div>';

    return html;
}

function initBetSelector(container, onBetChange) {
    container.querySelectorAll('.bet-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const amount = parseInt(e.target.dataset.bet);
            if (amount <= state.balance) {
                state.bet = amount;
                container.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const display = container.querySelector('.current-bet-display');
                if (display) display.textContent = `${state.bet} ₽`;
                if (onBetChange) onBetChange(state.bet);
            } else {
                showMessage('Недостаточно средств!', 'error');
            }
        });
    });

    const customInput = container.querySelector('#custom-bet-input');
    const customConfirm = container.querySelector('#custom-bet-confirm');

    customConfirm?.addEventListener('click', () => {
        const amount = parseInt(customInput.value);
        if (amount > 0 && amount <= state.balance) {
            state.bet = amount;
            container.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('active'));
            const display = container.querySelector('.current-bet-display');
            if (display) display.textContent = `${state.bet} ₽`;
            customInput.value = '';
            if (onBetChange) onBetChange(state.bet);
        } else if (amount > state.balance) {
            showMessage('Недостаточно средств!', 'error');
        } else {
            showMessage('Введите корректную сумму!', 'error');
        }
    });
}

// ===== УВЕДОМЛЕНИЯ =====

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `game-message ${type}`;
    messageEl.textContent = text;
    document.body.appendChild(messageEl);

    if (type === 'success') {
        hapticFeedback('success');
    } else if (type === 'error') {
        hapticFeedback('error');
    } else {
        hapticFeedback('light');
    }

    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 300);
    }, 2000);
}

// ============================================================
// ИГРА 1: МИННОЕ ПОЛЕ
// ============================================================

function renderMinesGame(container) {
    let minesData = {
        grid: Array(25).fill(false),
        mines: [],
        opened: 0,
        gameActive: false,
        multiplier: 1.0
    };

    let html = createBetSelector();
    html += '<div class="mines-container">';
    html += '<div class="mines-stats">';
    html += '<div>Открыто: <span id="mines-opened">0</span> / 22</div>';
    html += '<div>Множитель: <span id="mines-multiplier">1.00x</span></div>';
    html += '</div>';
    html += '<div class="mines-grid" id="mines-grid"></div>';
    html += '<button class="game-action-btn" id="mines-start">Начать игру</button>';
    html += '<button class="game-action-btn secondary" id="mines-cashout" style="display:none;">Забрать выигрыш</button>';
    html += '</div>';

    container.innerHTML = html;
    initBetSelector(container);

    const grid = container.querySelector('#mines-grid');
    const startBtn = container.querySelector('#mines-start');
    const cashoutBtn = container.querySelector('#mines-cashout');
    const openedEl = container.querySelector('#mines-opened');
    const multiplierEl = container.querySelector('#mines-multiplier');

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mines-cell';
        cell.dataset.index = i;
        cell.textContent = '❔';
        grid.appendChild(cell);
    }

    startBtn.addEventListener('click', () => {
        if (state.bet > state.balance) {
            showMessage('Недостаточно средств!', 'error');
            return;
        }

        updateBalance(state.balance - state.bet);
        sendAction('mines_start', { bet: state.bet });

        minesData.mines = [];
        while (minesData.mines.length < 3) {
            const pos = Math.floor(Math.random() * 25);
            if (!minesData.mines.includes(pos)) {
                minesData.mines.push(pos);
            }
        }

        minesData.grid = Array(25).fill(false);
        minesData.opened = 0;
        minesData.gameActive = true;
        minesData.multiplier = 1.0;

        grid.querySelectorAll('.mines-cell').forEach(cell => {
            cell.textContent = '❔';
            cell.className = 'mines-cell';
        });

        openedEl.textContent = '0';
        multiplierEl.textContent = '1.00x';
        startBtn.style.display = 'none';
        cashoutBtn.style.display = 'block';

        showMessage('Игра началась! Выбирайте клетки', 'success');
    });

    grid.addEventListener('click', (e) => {
        if (!minesData.gameActive) return;

        const cell = e.target.closest('.mines-cell');
        if (!cell || cell.classList.contains('opened')) return;

        const index = parseInt(cell.dataset.index);

        if (minesData.mines.includes(index)) {
            cell.textContent = '💣';
            cell.classList.add('mine');
            minesData.gameActive = false;

            minesData.mines.forEach(mineIndex => {
                grid.children[mineIndex].textContent = '💣';
                grid.children[mineIndex].classList.add('mine');
            });

            sendAction('mines_lose', { bet: state.bet, opened: minesData.opened });
            showMessage('Вы взорвались! Проигрыш!', 'error');
            startBtn.style.display = 'block';
            cashoutBtn.style.display = 'none';
        } else {
            cell.textContent = '✅';
            cell.classList.add('safe', 'opened');
            minesData.grid[index] = true;
            minesData.opened++;

            minesData.multiplier = 1.0 + (minesData.opened / 22) * 1.5;

            openedEl.textContent = minesData.opened;
            multiplierEl.textContent = minesData.multiplier.toFixed(2) + 'x';

            if (minesData.opened === 22) {
                minesData.gameActive = false;
                const winAmount = Math.floor(state.bet * minesData.multiplier);
                updateBalance(state.balance + winAmount);
                sendAction('mines_win', { bet: state.bet, win: winAmount, multiplier: minesData.multiplier });
                showMessage(`Победа! +${winAmount} ₽`, 'success');
                startBtn.style.display = 'block';
                cashoutBtn.style.display = 'none';
            }
        }
    });

    cashoutBtn.addEventListener('click', () => {
        if (!minesData.gameActive) return;

        const winAmount = Math.floor(state.bet * minesData.multiplier);
        updateBalance(state.balance + winAmount);
        minesData.gameActive = false;

        sendAction('mines_cashout', { bet: state.bet, win: winAmount, multiplier: minesData.multiplier });
        showMessage(`Вы забрали ${winAmount} ₽`, 'success');
        startBtn.style.display = 'block';
        cashoutBtn.style.display = 'none';
    });
}

// ============================================================
// ИГРА 2: РУЛЕТКА
// ============================================================

function renderRouletteGame(container) {
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

    let html = createBetSelector();
    html += '<div class="roulette-container">';
    html += '<div class="roulette-wheel" id="roulette-wheel">?</div>';
    html += '<div class="roulette-bets">';
    html += '<button class="roulette-bet red" data-bet="red">Красное (x2)</button>';
    html += '<button class="roulette-bet black" data-bet="black">Чёрное (x2)</button>';
    html += '<button class="roulette-bet green" data-bet="zero">Зеро (x14)</button>';
    html += '<button class="roulette-bet" data-bet="even">Чёт (x2)</button>';
    html += '<button class="roulette-bet" data-bet="odd">Нечет (x2)</button>';
    html += '<button class="roulette-bet" data-bet="1-18">1-18 (x2)</button>';
    html += '<button class="roulette-bet" data-bet="19-36">19-36 (x2)</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
    initBetSelector(container);

    const wheel = container.querySelector('#roulette-wheel');
    let isSpinning = false;

    container.querySelectorAll('.roulette-bet').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (isSpinning) return;

            if (state.bet > state.balance) {
                showMessage('Недостаточно средств!', 'error');
                return;
            }

            const betType = btn.dataset.bet;
            
            updateBalance(state.balance - state.bet);
            isSpinning = true;

            for (let i = 0; i < 8; i++) {
                wheel.textContent = Math.floor(Math.random() * 37);
                wheel.style.transform = `scale(${1 + Math.sin(i) * 0.2})`;
                await sleep(150);
            }

            const result = Math.floor(Math.random() * 37);
            wheel.textContent = result;
            wheel.style.transform = 'scale(1.3)';

            let color = 'green';
            if (result !== 0) {
                color = redNumbers.includes(result) ? 'red' : 'black';
            }

            wheel.className = `roulette-wheel ${color}`;

            await sleep(500);
            wheel.style.transform = 'scale(1)';

            let win = false;
            let multiplier = 0;

            if (betType === 'red' && color === 'red') { win = true; multiplier = 2; }
            else if (betType === 'black' && color === 'black') { win = true; multiplier = 2; }
            else if (betType === 'zero' && result === 0) { win = true; multiplier = 14; }
            else if (betType === 'even' && result !== 0 && result % 2 === 0) { win = true; multiplier = 2; }
            else if (betType === 'odd' && result % 2 === 1) { win = true; multiplier = 2; }
            else if (betType === '1-18' && result >= 1 && result <= 18) { win = true; multiplier = 2; }
            else if (betType === '19-36' && result >= 19 && result <= 36) { win = true; multiplier = 2; }

            if (win) {
                const winAmount = state.bet * multiplier;
                updateBalance(state.balance + winAmount);
                sendAction('roulette_win', { bet: state.bet, win: winAmount, result, betType });
                showMessage(`Победа! +${winAmount} ₽`, 'success');
            } else {
                sendAction('roulette_lose', { bet: state.bet, result, betType });
                showMessage('Проигрыш!', 'error');
            }

            isSpinning = false;
        });
    });
}

// ============================================================
// ИГРА 3: СЛОТЫ
// ============================================================

function renderSlotsGame(container) {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '🔔', '⭐', '7️⃣', '🎰'];
    const payouts = {
        '🎰': 50, '7️⃣': 30, '💎': 20, '🔔': 15, '⭐': 10,
        '🍇': 8, '🍊': 5, '🍋': 3, '🍒': 2
    };

    let html = createBetSelector();
    html += '<div class="slots-container">';
    html += '<div class="slots-reels">';
    html += '<div class="slots-reel" id="reel-1">🍒</div>';
    html += '<div class="slots-reel" id="reel-2">🍋</div>';
    html += '<div class="slots-reel" id="reel-3">🍊</div>';
    html += '</div>';
    html += '<button class="game-action-btn" id="slots-spin">Крутить (Ставка: ' + state.bet + ' ₽)</button>';
    html += '</div>';

    container.innerHTML = html;
    initBetSelector(container, (bet) => {
        container.querySelector('#slots-spin').textContent = `Крутить (Ставка: ${bet} ₽)`;
    });

    const reels = [
        container.querySelector('#reel-1'),
        container.querySelector('#reel-2'),
        container.querySelector('#reel-3')
    ];
    const spinBtn = container.querySelector('#slots-spin');
    let isSpinning = false;

    spinBtn.addEventListener('click', async () => {
        if (isSpinning) return;

        if (state.bet > state.balance) {
            showMessage('Недостаточно средств!', 'error');
            return;
        }

        updateBalance(state.balance - state.bet);
        isSpinning = true;
        spinBtn.disabled = true;

        for (let i = 0; i < 5; i++) {
            reels.forEach(reel => {
                reel.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                reel.style.transform = 'scale(1.2)';
            });
            await sleep(150);
            reels.forEach(reel => reel.style.transform = 'scale(1)');
            await sleep(50);
        }

        const results = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];

        reels.forEach((reel, i) => {
            reel.textContent = results[i];
            reel.style.transform = 'scale(1.3)';
        });

        await sleep(500);
        reels.forEach(reel => reel.style.transform = 'scale(1)');

        let multiplier = 0;

        if (results[0] === results[1] && results[1] === results[2]) {
            multiplier = payouts[results[0]] || 2;
        } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
            multiplier = 2;
        }

        if (multiplier > 0) {
            const winAmount = state.bet * multiplier;
            updateBalance(state.balance + winAmount);
            sendAction('slots_win', { bet: state.bet, win: winAmount, results, multiplier });
            showMessage(`Победа! +${winAmount} ₽ (x${multiplier})`, 'success');
        } else {
            sendAction('slots_lose', { bet: state.bet, results });
            showMessage('Проигрыш!', 'error');
        }

        isSpinning = false;
        spinBtn.disabled = false;
    });
}

// ============================================================
// ИГРА 4: КОСТИ
// ============================================================

function renderDiceGame(container) {
    let html = createBetSelector();
    html += '<div class="dice-container">';
    html += '<div class="dice-display" id="dice-result">🎲 ?</div>';
    html += '<div class="dice-bets">';
    html += '<button class="dice-bet" data-bet="1-3">1-3 (x1.9)</button>';
    html += '<button class="dice-bet" data-bet="4-6">4-6 (x1.9)</button>';

    for (let i = 1; i <= 6; i++) {
        html += `<button class="dice-bet small" data-bet="${i}">${i} (x5)</button>`;
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
    initBetSelector(container);

    const display = container.querySelector('#dice-result');
    let isRolling = false;

    container.querySelectorAll('.dice-bet').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (isRolling) return;

            if (state.bet > state.balance) {
                showMessage('Недостаточно средств!', 'error');
                return;
            }

            const betType = btn.dataset.bet;
            
            updateBalance(state.balance - state.bet);
            isRolling = true;

            for (let i = 0; i < 6; i++) {
                display.textContent = `🎲 ${Math.floor(Math.random() * 6) + 1}`;
                display.style.transform = `rotate(${i * 60}deg) scale(1.2)`;
                await sleep(150);
            }

            const result = Math.floor(Math.random() * 6) + 1;
            display.textContent = `🎲 ${result}`;
            display.style.transform = 'rotate(0deg) scale(1.5)';

            await sleep(500);
            display.style.transform = 'rotate(0deg) scale(1)';

            let win = false;
            let multiplier = 0;

            if (betType === '1-3' && result >= 1 && result <= 3) {
                win = true;
                multiplier = 1.9;
            } else if (betType === '4-6' && result >= 4 && result <= 6) {
                win = true;
                multiplier = 1.9;
            } else if (betType === result.toString()) {
                win = true;
                multiplier = 5;
            }

            if (win) {
                const winAmount = Math.floor(state.bet * multiplier);
                updateBalance(state.balance + winAmount);
                sendAction('dice_win', { bet: state.bet, win: winAmount, result, betType });
                showMessage(`Победа! +${winAmount} ₽`, 'success');
            } else {
                sendAction('dice_lose', { bet: state.bet, result, betType });
                showMessage('Проигрыш!', 'error');
            }

            isRolling = false;
        });
    });
}

// ============================================================
// ИГРА 5: МОНЕТКА
// ============================================================

function renderCoinGame(container) {
    let html = createBetSelector();
    html += '<div class="coin-container">';
    html += '<div class="coin-display" id="coin-result">🪙</div>';
    html += '<div class="coin-bets">';
    html += '<button class="coin-bet" data-bet="heads">🦅 Орёл (x2)</button>';
    html += '<button class="coin-bet" data-bet="tails">🪙 Решка (x2)</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
    initBetSelector(container);

    const display = container.querySelector('#coin-result');
    let isFlipping = false;

    container.querySelectorAll('.coin-bet').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (isFlipping) return;

            if (state.bet > state.balance) {
                showMessage('Недостаточно средств!', 'error');
                return;
            }

            const betType = btn.dataset.bet;
            
            updateBalance(state.balance - state.bet);
            isFlipping = true;

            const frames = ['🪙', '🌕', '🪙', '🌗', '🪙', '🌑', '🪙'];
            for (let i = 0; i < frames.length; i++) {
                display.textContent = frames[i];
                const scale = 1 + Math.sin((i / frames.length) * Math.PI) * 0.5;
                display.style.transform = `scale(${scale}) rotateY(${i * 180}deg)`;
                await sleep(200);
            }

            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            display.textContent = result === 'heads' ? '🦅' : '🪙';
            display.style.transform = 'scale(1.5) rotateY(0deg)';

            await sleep(500);
            display.style.transform = 'scale(1) rotateY(0deg)';

            if (betType === result) {
                const winAmount = state.bet * 2;
                updateBalance(state.balance + winAmount);
                sendAction('coin_win', { bet: state.bet, win: winAmount, result });
                showMessage(`Победа! +${winAmount} ₽`, 'success');
            } else {
                sendAction('coin_lose', { bet: state.bet, result });
                showMessage('Проигрыш!', 'error');
            }

            isFlipping = false;
        });
    });
}

// ============================================================
// ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ
// ============================================================

function forceSyncBalance() {
    console.log('🔄 Принудительная синхронизация...');
    localStorage.removeItem('balance');
    requestBalance();
    setTimeout(() => {
        showMessage(`💰 Баланс синхронизирован: ${state.balance} ₽`, 'success');
    }, 2000);
}

function addSyncButton() {
    const header = document.querySelector('.header');
    if (header) {
        const syncBtn = document.createElement('button');
        syncBtn.textContent = '🔄';
        syncBtn.style.cssText = `
            background: rgba(212,175,55,0.2);
            border: 1px solid #D4AF37;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            font-size: 18px;
            cursor: pointer;
            color: #D4AF37;
            transition: all 0.3s;
        `;
        syncBtn.onclick = forceSyncBalance;
        header.appendChild(syncBtn);
    }
}

console.log('🎰 LUDOMANIKS CASINO загружен!');
console.log('👤 User ID:', state.userId);
console.log('💰 Баланс:', state.balance);
