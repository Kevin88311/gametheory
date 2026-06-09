/**
 * 囚徒困境 (Prisoner's Dilemma)
 * 经典博弈：两个囚徒分别选择合作(保持沉默)或背叛(坦白)
 */
const PrisonerDilemma = {
    id: 'prisoner-dilemma',
    name: '囚徒困境',
    description: `两名犯罪嫌疑人被分开审讯。每人可选择<b>合作</b>（保持沉默）或<b>背叛</b>（坦白供述）。
    <br><br>如果双方合作，各判1年；双方背叛，各判3年；一方背叛一方合作，背叛者释放、合作者判5年。
    <br><br>个人的理性选择是背叛，但集体最优是合作——这就是<b>个体理性与集体理性的冲突</b>。`,

    // 支付矩阵: [行][列] = (玩家1收益, 玩家2收益)
    // 行: 合作, 背叛 | 列: 合作, 背叛
    payoffMatrix: [[-1, -5], [0, -3]],
    payoffMatrix2: [[-1, 0], [-5, -3]],
    strategies: ['合作 🤝', '背叛 🗡️'],

    init(container) {
        const engine = new GameEngine(this.payoffMatrix, this.payoffMatrix2, this.strategies, this.strategies);
        const nash = engine.findPureNash();
        const pareto = engine.findParetoOptimal();

        let yourScore = 0, theirScore = 0, round = 0;
        const history = [];
        let aiStrategy = 'tit-for-tat'; // 默认以牙还牙
        let lastYourChoice = 1; // 默认背叛索引(初始用)

        container.innerHTML = `
            <div class="game-panel">
                <div class="game-info">
                    <h2>🔗 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div class="ai-select">
                        <label style="color:var(--text-secondary);font-size:0.9rem">电脑策略</label>
                        <select id="ai-strategy">
                            <option value="tit-for-tat">以牙还牙 (Tit-for-Tat)</option>
                            <option value="always-defect">总是背叛</option>
                            <option value="always-cooperate">总是合作</option>
                            <option value="random">随机</option>
                        </select>
                    </div>
                    <div class="strategy-section">
                        <h3>选择你的策略</h3>
                        <div class="strategy-btns">
                            <button class="strategy-btn cooperate" data-choice="0">🤝 合作</button>
                            <button class="strategy-btn defect" data-choice="1">🗡️ 背叛</button>
                        </div>
                    </div>
                    <div id="pd-result"></div>
                    <div id="pd-score"></div>
                    <div id="pd-history" style="margin-top:16px"></div>
                </div>
                <div class="matrix-section">
                    <h3>支付矩阵</h3>
                    <div id="pd-matrix"></div>
                    <div id="pd-mixed"></div>
                    <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px">(你, 对手) 刑期年份</p>
                </div>
            </div>
        `;

        UI.renderMatrix(engine, nash, document.getElementById('pd-matrix'));
        UI.renderMixedNash(engine.findMixedNash(), document.getElementById('pd-mixed'));
        this._updateScores(yourScore, theirScore, round, document.getElementById('pd-score'));

        // AI 策略获取
        const getAIChoice = () => {
            const s = document.getElementById('ai-strategy').value;
            switch (s) {
                case 'tit-for-tat': return lastYourChoice;
                case 'always-defect': return 1;
                case 'always-cooperate': return 0;
                case 'random': return Math.random() < 0.5 ? 0 : 1;
            }
        };

        document.querySelectorAll('.strategy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const yourChoice = parseInt(btn.dataset.choice);
                const aiChoice = getAIChoice();
                const payoff = engine.calculatePayoff(yourChoice, aiChoice);

                round++;
                yourScore += payoff.player1;
                theirScore += payoff.player2;
                lastYourChoice = yourChoice;
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
                }, document.getElementById('pd-result'));

                this._updateScores(yourScore, theirScore, round, document.getElementById('pd-score'));
                UI.renderHistory(history, document.getElementById('pd-history'));
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
