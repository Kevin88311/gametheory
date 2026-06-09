/**
 * 鹰鸽博弈 (Chicken / Hawk-Dove)
 * 冲突博弈：两人驾车对冲，可选择转向(鸽)或直行(鹰)
 */
const Chicken = {
    id: 'chicken',
    name: '鹰鸽博弈',
    description: `两辆车对冲而来。每人可选<b>鹰派</b>（直行不避让）或<b>鸽派</b>（转向避让）。
    <br><br>双方鸽派各得0（平局）；双方鹰派两败俱伤各得-5；鹰派对鸽派，鹰派得3（赢家），鸽派得-1（丢脸）。
    <br><br>有两个纯策略纳什均衡：(鹰,鸽)和(鸽,鹰)。这体现了<b>冲突博弈</b>中"谁更强硬谁赢，但都强硬则双输"的困境。`,

    payoffMatrix: [[0, -1], [3, -5]],
    payoffMatrix2: [[0, 3], [-1, -5]],
    strategies: ['鸽派 🕊️', '鹰派 🦅'],

    init(container) {
        const engine = new GameEngine(this.payoffMatrix, this.payoffMatrix2, this.strategies, this.strategies);
        const nash = engine.findPureNash();
        const mixed = engine.findMixedNash();

        let yourScore = 0, theirScore = 0, round = 0;
        const history = [];

        container.innerHTML = `
            <div class="game-panel">
                <div class="game-info">
                    <h2>🚗 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div class="ai-select">
                        <label style="color:var(--text-secondary);font-size:0.9rem">电脑策略</label>
                        <select id="ch-ai">
                            <option value="mixed">混合策略（约1/3鹰派）</option>
                            <option value="always-hawk">总是鹰派</option>
                            <option value="always-dove">总是鸽派</option>
                            <option value="tit-for-tat">以牙还牙</option>
                            <option value="random">随机</option>
                        </select>
                    </div>
                    <div class="strategy-section">
                        <h3>选择你的策略</h3>
                        <div class="strategy-btns">
                            <button class="strategy-btn cooperate" data-choice="0">🕊️ 鸽派</button>
                            <button class="strategy-btn defect" data-choice="1">🦅 鹰派</button>
                        </div>
                    </div>
                    <div id="ch-result"></div>
                    <div id="ch-score"></div>
                    <div id="ch-history" style="margin-top:16px"></div>
                </div>
                <div class="matrix-section">
                    <h3>支付矩阵</h3>
                    <div id="ch-matrix"></div>
                    <div id="ch-mixed"></div>
                </div>
            </div>
        `;

        UI.renderMatrix(engine, nash, document.getElementById('ch-matrix'));
        UI.renderMixedNash(mixed, document.getElementById('ch-mixed'));
        this._updateScores(yourScore, theirScore, round, document.getElementById('ch-score'));

        let lastYourChoice = 0;
        const getAIChoice = () => {
            const mode = document.getElementById('ch-ai').value;
            switch (mode) {
                case 'mixed': return Math.random() < 0.33 ? 1 : 0;
                case 'always-hawk': return 1;
                case 'always-dove': return 0;
                case 'tit-for-tat': return lastYourChoice === 0 ? 1 : 0;
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
                }, document.getElementById('ch-result'));

                this._updateScores(yourScore, theirScore, round, document.getElementById('ch-score'));
                UI.renderHistory(history, document.getElementById('ch-history'));
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
