/**
 * 主入口 — 导航路由与应用初始化
 */

const games = {
    'prisoner-dilemma': PrisonerDilemma,
    'stag-hunt': StagHunt,
    'chicken': Chicken,
    'battle-of-sexes': BattleOfSexes,
    'ultimatum': UltimatumGame,
    'public-goods': PublicGoodsGame,
    'centipede': CentipedeGame,
    'evolution': EvolutionGame,
    'beauty-contest': BeautyContest,
    'traveler-dilemma': TravelerDilemma,
    'signaling': SignalingGame
};

let currentGame = null;

function switchGame(gameId) {
    const game = games[gameId];
    if (!game) return;

    const container = document.getElementById('game-container');

    // 清理当前游戏
    if (currentGame && currentGame.cleanup) {
        currentGame.cleanup();
    }

    // 渲染新游戏
    game.init(container);
    currentGame = game;

    // 更新导航高亮
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.game === gameId);
    });

    // 更新 URL hash
    window.location.hash = gameId;
}

// 导航点击事件
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchGame(btn.dataset.game);
    });
});

// 初始化：从 URL hash 或默认加载第一个游戏
function init() {
    const hash = window.location.hash.replace('#', '');
    const gameId = games[hash] ? hash : 'prisoner-dilemma';
    switchGame(gameId);
}

// 监听 hash 变化（浏览器前进后退）
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (games[hash] && (!currentGame || currentGame.id !== hash)) {
        switchGame(hash);
    }
});

// 启动
document.addEventListener('DOMContentLoaded', init);
