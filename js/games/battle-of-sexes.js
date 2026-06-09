/**
 * 性别战 (Battle of the Sexes)
 * 协调博弈：两人想去不同活动，但更想在一起
 */
const BattleOfSexes = {
    id: 'battle-of-sexes',
    name: '性别战',
    description: `一对伴侣要决定晚上活动。一方偏好<b>看球赛</b>⚽，另一方偏好<b>看歌剧</b>🎭，但两人都更想<b>在一起</b>。
    <br><br>都去球赛：(3,2)；都去歌剧：(2,3)；各去各的：(0,0)。<br>
    有两个纯策略纳什均衡和一个混合策略均衡。这体现了<b>协调博弈中的分配冲突</b>——谁先让步？`,

    payoffMatrix: [[3, 0], [0, 2]],
    payoffMatrix2: [[2, 0], [0, 3]],
    strategies: ['球赛 ⚽', '歌剧 🎭'],

    init(container) {
        const engine = new GameEngine(this.payoffMatrix, this.payoffMatrix2, this.strategies, this.strategies);
        const nash = engine.findPureNash();
        const mixed = engine.findMixedNash();

        let yourScore = 0, theirScore = 0, round = 0;
        const history = [];

        container.innerHTML = `
            <div class="game-panel">
                <div class="game-info">
                    <h2>💑 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div class="ai-select">
                        <label style="color:var(--text-secondary);font-size:0.9rem">电脑策略</label>
                        <select id="bs-ai">
                            <option value="mixed">混合策略（按纳什均衡概率）</option>
                            <option value="stubborn">固执己见</option>
                            <option value="compromise">总是让步</option>
                            <option value="random">随机</option>
                        </select>
                    </div>
                    <div class="strategy-section">
                        <h3>你偏好哪个？</h3>
                        <div class="strategy-btns">
                            <button class="strategy-btn cooperate" data-choice="0">⚽ 球赛</button>
                            <button class="strategy-btn defect" data-choice="1">🎭 歌剧</button>
                        </div>
                    </div>
                    <div id="bs-result"></div>
                    <div id="bs-score"></div>
                    <div id="bs-history" style="margin-top:16px"></div>
                </div>
                <div class="matrix-section">
                    <h3>支付矩阵 (你偏好球赛, 对手偏好歌剧)</h3>
                    <div id="bs-matrix"></div>
                    <div id="bs-mixed"></div>
                </div>
            </div>
        `;

        UI.renderMatrix(engine, nash, document.getElementById('bs-matrix'));
        UI.renderMixedNash(mixed, document.getElementById('bs-mixed'));
        this._updateScores(yourScore, theirScore, round, document.getElementById('bs-score'));

        const getAIChoice = () => {
            const mode = document.getElementById('bs-ai').value;
            switch (mode) {
                case 'mixed': return Math.random() < 0.4 ? 0 : 1; // 约40%选球赛
                case 'stubborn': return 1; // 总选歌剧
                case 'compromise': return 0; // 总选球赛
                case 'random': return Math.random() < 0.5 ? 0 : 1;
            }
        };

        document.querySelectorAll('#game-container .strategy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const yourChoice = parseInt(btn.dataset.choice);
                const aiChoice = getAIChoice();
                const payoff = engine.calculatePayoff(yourChoice, aiChoice);

                round++;
                yourScore += payoff.player1;
                theirScore += payoff.player2;
                history.push({
                    round, yourStrategy: this.strategies[yourChoice],
                    theirStrategy: this.strategies[aiChoice],
                    yourPayoff: payoff.player1, theirPayoff: payoff.player2
                });

                UI.showResult({
                    yourStrategy: this.strategies[yourChoice],
                    theirStrategy: this.strategies[aiChoice],
                    yourPayoff: payoff.player1,
                    theirPayoff: payoff.player2,
                    isNash: nash.some(eq => eq.row === yourChoice && eq.col === aiChoice),
                    isPareto: engine.isParetoOptimal(yourChoice, aiChoice)
                }, document.getElementById('bs-result'));

                this._updateScores(yourScore, theirScore, round, document.getElementById('bs-score'));
                UI.renderHistory(history, document.getElementById('bs-history'));
            });
        });
    },

    _updateScores(your, their, round, container) {
        container.innerHTML = `
            <div class="scoreboard">
                <div class="score-item">
                    <div class="score-label">你的总分</div>
                    <div class="score-value" style="color:var(--accent)">${your}</div>
                </div>
                <div class="score-item">
                    <div class="score-label">对手总分</div>
                    <div class="score-value" style="color:var(--danger)">${their}</div>
                </div>
                <div class="score-item">
                    <div class="score-label">轮次</div>
                    <div class="score-value" style="color:var(--text-secondary)">${round}</div>
                </div>
            </div>
        `;
    },

    cleanup() {}
};
