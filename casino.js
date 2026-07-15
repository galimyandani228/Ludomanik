// ============================================================
// LUDOMANIKS CASINO — Mini App Script (Telegram WebApp версия)
// ============================================================

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

// ===== ОТПРАВКА В БОТ =====
function sendAction(action, data = {}) {
    if (tg) {
        tg.sendData(JSON.stringify({ action, ...data }));
        console.log('📤 Отправлено:', action, data);
    }
}

function requestBalance() {
    console.log('📥 Запрос баланса...');
    sendAction('get_balance');
}

function sendGameResult(action, amount) {
    sendAction(action, { amount });
}

// ===== ОБРАБОТКА ОТВЕТОВ ОТ БОТА =====
if (tg) {
    tg.onEvent('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📩 Получено от бота:', data);
            
            if (data.action === 'balance_updated') {
                updateBalance(data.balance);
                state.isBalanceLoaded = true;
            }
        } catch (e) {
            console.error('❌ Ошибка:', e);
        }
    });
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
    
    updateBalance(0);
    requestBalance();

    initMainMenu();
    addSyncButton();

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
// ИГРЫ (рендеринг — такой же как был, НЕ МЕНЯЙ)
// ============================================================

// ... остальной код игр (renderMinesGame, renderRouletteGame, renderSlotsGame, renderDiceGame, renderCoinGame) остаётся ТАКИМ ЖЕ, как в твоём файле, только удали все вызовы sendGameResult и замени на:
// sendGameResult('win', winAmount) -> sendAction('mines_win', { win: winAmount })
// sendGameResult('lose', state.bet) -> sendAction('mines_lose', { bet: state.bet })
