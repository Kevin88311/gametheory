/**
 * 猎鹿博弈 (Stag Hunt)
 * 协调博弈：两人可选择合作猎鹿(高回报但需协作)或独自猎兔(低回报但安全)
 */
const StagHunt = {
    id: 'stag-hunt',
    name: '猎鹿博弈',
    description: `两人去狩猎。可以<b>猎鹿</b>（需要两人协作才能成功）或<b>猎兔</b>（可独立完成）。
    <br><br>协作猎鹿每人获4；各自猎兔每人获2；一人猎鹿一人猎兔，猎鹿者失败得0、猎兔者得2。
    <br><br>有两个纳什均衡：(猎鹿,猎鹿)和(猎兔,猎兔)。(猎鹿,猎鹿)收益更高但存在风险——如果对方不协作就会一无所获。
    这体现了<b>风险主导</b>与<b>收益主导</b>的权衡。`,

    payoffMatrix: [[4, 0], [2, 2]],
    payoffMatrix2: [[4, 2], [0, 2]],
    strategies: ['猎鹿 🦌', '猎兔 🐰'],

    init(container) {
        const engine = new GameEngine(this.payoffMatrix, this.payoffMatrix2, this.strategies, this.strategies);
        const nash = engine.findPureNash();
        const mixed = engine.findMixedNash();

        let yourScore = 0, theirScore = 0, round = 0;
        const history = [];
        let lastYourChoice = 0;
        const aiModes = ['tit-for-tat', 'cautious', 'random', 'always-stag', 'always-hare'];
        let aiMode = 'tit-for-tat';
        let aiHistory = [];

        container.innerHTML = `
            <div class="game-panel">
                <div class="game-info">
                    <h2>🦌 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div class="ai-select">
                        <label style="color:var(--text-secondary);font-size:0.9rem">电脑策略</label>
                        <select id="sh-ai">
                            <option value="tit-for-tat">以牙还牙</option>
                            <option value="cautious">谨慎（先猎兔试探）</option>
                            <option value="random">随机</option>
                            <option value="always-stag">总是猎鹿</option>
                            <option value="always-hare">总是猎兔</option>
                        </select>
                    </div>
                    <div class="strategy-section">
                        <h3>选择你的策略</h3>
                        <div class="strategy-btns">
                            <button class="strategy-btn cooperate" data-choice="0">🦌 猎鹿</button>
                            <button class="strategy-btn defect" data-choice="1">🐰 猎兔</button>
                        </div>
                    </div>
                    <div id="sh-result"></div>
                    <div id="sh-score"></div>
                    <div id="sh-history" style="margin-top:16px"></div>
                </div>
                <div class="matrix-section">
                    <h3>支付矩阵</h3>
                    <div id="sh-matrix"></div>
                    <div id="sh-mixed"></div>
                    <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px">🟡 两个纳什均衡: (猎鹿,猎鹿) 收益主导, (猎兔,猎兔) 风险主导</p>
                </div>
            </div>
        `;

        UI.renderMatrix(engine, nash, document.getElementById('sh-matrix'));
        UI.renderMixedNash(mixed, document.getElementById('sh-mixed'));
        this._updateScores(yourScore, theirScore, round, document.getElementById('sh-score'));

        const getAIChoice = () => {
            const mode = document.getElementById('sh-ai').value;
            switch (mode) {
                case 'tit-for-tat': return lastYourChoice;
                case 'cautious':
                    if (round <= 2) return 1; // 前两轮猎兔试探
                    return lastYourChoice === 0 ? 0 : 1;
                case 'always-stag': return 0;
                case 'always-hare': return 1;
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
                }, document.getElementById('sh-result'));

                this._updateScores(yourScore, theirScore, round, document.getElementById('sh-score'));
                UI.renderHistory(history, document.getElementById('sh-history'));
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
