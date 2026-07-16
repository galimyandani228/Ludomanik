// ============================================================
// LUDOMANIKS CASINO — Mini App Script (Flask API версия)
// ============================================================

// ===== КОНФИГ =====
// ⚠️ ВАЖНО: эта страница открывается через HTTPS (GitHub Pages), а бот
// в .env указан как WEBAPP_URL=https://.../Ludomanik/. Если API_URL здесь
// будет вести на http:// (без "s") или на приватный IP вида 172.16.x.x /
// 192.168.x.x / 10.x.x.x — телефон пользователя физически не сможет до
// него достучаться (он не в вашей локальной сети), а сам браузер ещё и
// заблокирует HTTP-запрос со страницы, открытой по HTTPS (mixed content).
// Именно поэтому баланс "не синхронизировался": все запросы к API падали
// молча, и веб-приложение работало с локальной подделкой баланса.
//
// Что нужно сделать:
// 1) Разместить Flask-сервер (main.py) там, где он доступен по адресу
//    с HTTPS и из интернета — например через Cloudflare Tunnel, ngrok,
//    VPS с доменом и сертификатом, PythonAnywhere и т.п. Просто "белый IP"
//    недостаточно — Telegram WebView на телефоне тоже требует HTTPS.
// 2) Подставить сюда именно этот публичный HTTPS-адрес.
const API_URL = 'https://ВАШ-ПУБЛИЧНЫЙ-АДРЕС-БЭКЕНДА';

// Явно предупреждаем в консоли и на экране, если конфиг оставлен
// нерабочим (LAN-адрес, http:// со страницы https:// и т.п.) — чтобы
// проблема была видна сразу, а не терялась в "баланс не синхронизируется".
function checkApiUrlConfig() {
    const isPageHttps = window.location.protocol === 'https:';
    let apiHost = '';
    try { apiHost = new URL(API_URL).hostname; } catch (e) { /* невалидный URL — тоже ошибка */ }
    const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.|127\.)/.test(apiHost);
    const isPlaceholder = API_URL.includes('ВАШ-ПУБЛИЧНЫЙ-АДРЕС-БЭКЕНДА');
    const isMixedContent = isPageHttps && API_URL.startsWith('http://');

    if (isPlaceholder || isPrivateIp || isMixedContent) {
        const reason = isPlaceholder
            ? 'API_URL не настроен (стоит заглушка)'
            : isPrivateIp
                ? 'API_URL указывает на приватный IP — недоступен вне вашей локальной сети'
                : 'страница открыта по HTTPS, а API_URL по HTTP (mixed content блокируется браузером)';
        console.error(`⚠️ Настройка API_URL некорректна: ${reason}. Баланс не будет синхронизироваться с ботом.`);
        return reason;
    }
    return null;
}

// ===== TELEGRAM WEB APP =====
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.MainButton.hide();
    tg.setHeaderColor('#050505');
    tg.setBackgroundColor('#050505');
}

// ===== СОСТОЯНИЕ =====
const state = {
    balance: 0,
    userId: tg?.initDataUnsafe?.user?.id || 0,
    currentGame: null,
    bet: 10,
    isBalanceLoaded: false
};

// ===== УТИЛИТЫ =====
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== HTTP ЗАПРОСЫ К БОТУ =====

async function requestBalance() {
    const configError = checkApiUrlConfig();
    if (configError) {
        showApiError(configError);
        return null;
    }
    try {
        console.log('📥 Запрос баланса для user_id:', state.userId);
        const res = await fetch(`${API_URL}/api/balance?user_id=${state.userId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('📩 Ответ от бота:', data);

        if (data.balance !== undefined) {
            updateBalance(data.balance);
            state.isBalanceLoaded = true;
            hideApiError();
        }
        return data;
    } catch (e) {
        console.error('❌ Ошибка получения баланса:', e);
        // ВАЖНО: раньше здесь при ошибке подставлялся баланс 1000 — это и
        // было причиной рассинхронизации: реальный баланс в БД бота
        // оставался прежним, а на экране показывалась выдуманная цифра,
        // не связанная с ним. Вместо этого показываем ошибку и не трогаем
        // баланс, пока не получим настоящий ответ от сервера.
        showApiError('Не удалось подключиться к серверу баланса');
        return null;
    }
}

async function sendGameResult(action, amount) {
    try {
        const res = await fetch(`${API_URL}/api/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: state.userId, 
                action: action, 
                amount: amount 
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('📩 Ответ после игры:', data);

        if (data.balance !== undefined) {
            updateBalance(data.balance);
            hideApiError();
        }
        return data;
    } catch (e) {
        console.error('❌ Ошибка отправки:', e);
        showApiError('Результат игры не сохранён на сервере');
        return null;
    }
}

// ===== СЕТЕВАЯ ОШИБКА (видимый баннер вместо тихой подмены баланса) =====
let apiErrorEl = null;
function showApiError(text) {
    if (!apiErrorEl) {
        apiErrorEl = document.createElement('div');
        apiErrorEl.id = 'api-error-banner';
        apiErrorEl.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
            background: #b00020; color: #fff; text-align: center;
            padding: 8px 12px; font-size: 13px;
        `;
        document.body.prepend(apiErrorEl);
    }
    apiErrorEl.textContent = `⚠️ ${text}. Баланс может быть неактуален.`;
    apiErrorEl.style.display = 'block';
}
function hideApiError() {
    if (apiErrorEl) apiErrorEl.style.display = 'none';
}

// ===== ОДИН АТОМАРНЫЙ ЗАПРОС НА РАУНД =====
// Раньше каждая игра делала ДВА независимых запроса за раунд: сначала
// action:'lose' на всю ставку, затем (если победа) action:'win' на
// выигрыш — без ожидания первого запроса. Если ответы приходили не по
// порядку (обычная ситуация в мобильной сети), на экране оставался
// баланс от "устаревшего" ответа, хотя в базе бота уже было верное
// значение. settleRound отправляет один запрос с итоговой разницей
// (выигрыш минус ставка) и ждёт его — гонки быть не может.
async function settleRound(delta) {
    return sendGameResult('win', delta);
}

// ===== ОБНОВЛЕНИЕ БАЛАНСА =====
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

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Инициализация приложения...');
    console.log('👤 User ID:', state.userId);
    
    // Сначала показываем заглушку
    updateBalance(0);
    
    // Запрашиваем баланс
    requestBalance();

    // Инициализация меню
    initMainMenu();
    addSyncButton();

    // Если баланс не пришел через 3 секунды — ставим 1000
    setTimeout(() => {
        if (!state.isBalanceLoaded) {
            console.log('⏰ Таймаут, устанавливаем начальный баланс');
            updateBalance(1000);
            state.isBalanceLoaded = true;
        }
    }, 3000);
});

// ============================================================
// НАВИГАЦИЯ
// ============================================================

function initMainMenu() {
    document.getElementById('btn-mines')?.addEventListener('click', () => openGame('mines', '💣 Минное поле'));
    document.getElementById('btn-roulette')?.addEventListener('click', () => openGame('roulette', '🎡 Рулетка'));
    document.getElementById('btn-slots')?.addEventListener('click', () => openGame('slots', '🎰 Слоты'));
    document.getElementById('btn-dice')?.addEventListener('click', () => openGame('dice', '🎲 Кости'));
    document.getElementById('btn-coin')?.addEventListener('click', () => openGame('coin', '🪙 Монетка'));

    document.getElementById('btn-back')?.addEventListener('click', () => {
        document.getElementById('main-menu').style.display = 'block';
        document.getElementById('game-screen').style.display = 'none';
        state.currentGame = null;
        requestBalance();
    });
}

function openGame(gameName, gameTitle) {
    state.currentGame = gameName;
    hapticFeedback('light');

    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('game-screen-title').textContent = gameTitle;

    const gameContent = document.getElementById('game-content');
    switch(gameName) {
        case 'mines': renderMinesGame(gameContent); break;
        case 'roulette': renderRouletteGame(gameContent); break;
        case 'slots': renderSlotsGame(gameContent); break;
        case 'dice': renderDiceGame(gameContent); break;
        case 'coin': renderCoinGame(gameContent); break;
    }
}

// ===== КОМПОНЕНТ СТАВОК =====

function createBetSelector() {
    const betAmounts = [10, 25, 50, 100, 250, 500, 1000, 5000];

    let html = '<div class="bet-selector">';
    html += '<h3>Ваша ставка:</h3>';
    html += '<div class="bet-buttons">';

    betAmounts.forEach(amount => {
        html += `<button class="bet-btn ${state.bet === amount ? 'active' : ''}" data-bet="${amount}">${amount} ₽</button>`;
    });

    html += '</div>';
    html += '<div class="custom-bet">';
    html += `<input type="number" id="custom-bet-input" placeholder="Своя ставка" min="1" max="${state.balance}">`;
    html += '<button id="custom-bet-confirm">✅</button>';
    html += '</div>';
    html += `<div class="current-bet">Ставка: <span class="current-bet-display">${state.bet} ₽</span></div>`;
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

    if (type === 'success') hapticFeedback('success');
    else if (type === 'error') hapticFeedback('error');
    else hapticFeedback('light');

    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 300);
    }, 2000);
}

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

// ===== КНОПКА СИНХРОНИЗАЦИИ =====

function forceSyncBalance() {
    console.log('🔄 Принудительная синхронизация...');
    localStorage.removeItem('balance');
    requestBalance();
    setTimeout(() => {
        showMessage(`💰 Баланс синхронизирован: ${state.balance} ₽`, 'success');
    }, 1500);
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
            margin-left: 10px;
        `;
        syncBtn.onclick = forceSyncBalance;
        header.appendChild(syncBtn);
    }
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
    html += '<button class="game-action-btn" id="mines-start">🚀 Начать игру</button>';
    html += '<button class="game-action-btn secondary" id="mines-cashout" style="display:none;">💵 Забрать выигрыш</button>';
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

    startBtn.addEventListener('click', async () => {
        if (state.bet > state.balance) {
            showMessage('Недостаточно средств!', 'error');
            return;
        }

        updateBalance(state.balance - state.bet);
        await settleRound(-state.bet);

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

            showMessage('💥 Вы взорвались! Проигрыш!', 'error');
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
                settleRound(winAmount);
                showMessage(`🎉 Победа! +${winAmount} ₽`, 'success');
                startBtn.style.display = 'block';
                cashoutBtn.style.display = 'none';
            }
        }
    });

    cashoutBtn.addEventListener('click', () => {
        if (!minesData.gameActive) return;

        const winAmount = Math.floor(state.bet * minesData.multiplier);
        updateBalance(state.balance + winAmount);
        settleRound(winAmount);
        minesData.gameActive = false;

        showMessage(`✅ Вы забрали ${winAmount} ₽`, 'success');
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
    html += '<div class="roulette-wheel" id="roulette-wheel">🎡</div>';
    html += '<div class="roulette-bets">';
    html += '<button class="roulette-bet red" data-bet="red">🔴 Красное (x2)</button>';
    html += '<button class="roulette-bet black" data-bet="black">⚫ Чёрное (x2)</button>';
    html += '<button class="roulette-bet green" data-bet="zero">🟢 Зеро (x14)</button>';
    html += '<button class="roulette-bet" data-bet="even">Чёт (x2)</button>';
    html += '<button class="roulette-bet" data-bet="odd">Нечет (x2)</button>';
    html += '<button class="roulette-bet" data-bet="low">1-18 (x2)</button>';
    html += '<button class="roulette-bet" data-bet="high">19-36 (x2)</button>';
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
            const roundBet = state.bet;

            updateBalance(state.balance - roundBet);
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
            else if (betType === 'low' && result >= 1 && result <= 18) { win = true; multiplier = 2; }
            else if (betType === 'high' && result >= 19 && result <= 36) { win = true; multiplier = 2; }

            if (win) {
                const winAmount = roundBet * multiplier;
                updateBalance(state.balance + winAmount);
                await settleRound(winAmount - roundBet);
                showMessage(`🎉 Победа! +${winAmount} ₽`, 'success');
            } else {
                await settleRound(-roundBet);
                showMessage('😢 Проигрыш!', 'error');
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
    html += '<button class="game-action-btn" id="slots-spin">🎰 Крутить (Ставка: ' + state.bet + ' ₽)</button>';
    html += '</div>';

    container.innerHTML = html;
    initBetSelector(container, (bet) => {
        container.querySelector('#slots-spin').textContent = `🎰 Крутить (Ставка: ${bet} ₽)`;
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

        const roundBet = state.bet;
        updateBalance(state.balance - roundBet);
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
            const winAmount = roundBet * multiplier;
            updateBalance(state.balance + winAmount);
            await settleRound(winAmount - roundBet);
            showMessage(`🎉 Победа! +${winAmount} ₽ (x${multiplier})`, 'success');
        } else {
            await settleRound(-roundBet);
            showMessage('😢 Проигрыш!', 'error');
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
    html += '<button class="dice-bet" data-bet="under">⬇️ 1-3 (x1.9)</button>';
    html += '<button class="dice-bet" data-bet="over">⬆️ 4-6 (x1.9)</button>';

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
            const roundBet = state.bet;

            updateBalance(state.balance - roundBet);
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

            if (betType === 'under' && result >= 1 && result <= 3) {
                win = true;
                multiplier = 1.9;
            } else if (betType === 'over' && result >= 4 && result <= 6) {
                win = true;
                multiplier = 1.9;
            } else if (parseInt(betType) === result) {
                win = true;
                multiplier = 5;
            }

            if (win) {
                const winAmount = Math.floor(roundBet * multiplier);
                updateBalance(state.balance + winAmount);
                await settleRound(winAmount - roundBet);
                showMessage(`🎉 Победа! +${winAmount} ₽`, 'success');
            } else {
                await settleRound(-roundBet);
                showMessage('😢 Проигрыш!', 'error');
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
            const roundBet = state.bet;

            updateBalance(state.balance - roundBet);
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
                const winAmount = roundBet * 2;
                updateBalance(state.balance + winAmount);
                await settleRound(winAmount - roundBet);
                showMessage(`🎉 Победа! +${winAmount} ₽`, 'success');
            } else {
                await settleRound(-roundBet);
                showMessage('😢 Проигрыш!', 'error');
            }

            isFlipping = false;
        });
    });
}

console.log('🎰 LUDOMANIKS CASINO загружен!');
console.log('👤 User ID:', state.userId);
