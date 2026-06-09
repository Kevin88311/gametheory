/**
 * 选美比赛博弈 (Keynes Beauty Contest)
 * k级推理：每人猜0-100，最接近「平均值×p」的人获胜
 */
const BeautyContest = {
    id: 'beauty-contest',
    name: '选美比赛',
    description: `每个人从 0-100 猜一个数。最接近<b>所有人平均值 × ${(0.67).toFixed(0)}</b> 的人获胜。
    <br><br>L0 随机猜；L1 认为其他人是 L0，所以猜 50×0.67≈33；L2 认为其他人是 L1，猜 33×0.67≈22... <b>L∞ = 0</b>。
    <br>你的猜测揭示了你的<b>推理深度</b>——你认为别人会想几步？`,

    init(container) {
        const p = 2/3; // 乘数
        const numAI = 9; // AI 对手数量
        let round = 0;
        const history = [];
        let playerKLevel = null;

        container.innerHTML = `
            <div class="game-panel ultimatum-layout" style="max-width:700px">
                <div class="game-info">
                    <h2>🎯 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div class="slider-group">
                        <label>你的猜测: <span id="bc-guess-val" style="color:var(--accent)">50</span></label>
                        <input type="range" id="bc-guess" min="0" max="100" value="50">
                        <label style="font-size:0.85rem;color:var(--text-secondary)">
                            乘数 p = ${p.toFixed(2)} | 目标 = 平均值 × ${p.toFixed(2)}
                        </label>
                    </div>
                    <button class="btn btn-primary" id="bc-submit">提交猜测</button>
                    <div id="bc-result"></div>
                    <div id="bc-score"></div>
                    <div id="bc-history" style="margin-top:16px"></div>
                </div>
            </div>
        `;

        document.getElementById('bc-guess').addEventListener('input', (e) => {
            document.getElementById('bc-guess-val').textContent = e.target.value;
        });

        let yourScore = 0;

        const getAIKLevels = () => {
            // 生成不同 k 级别的 AI
            const kLevels = [];
            // L0: 随机
            for (let i = 0; i < 2; i++) {
                kLevels.push({ level: 'L0 (随机)', guess: Math.floor(Math.random() * 100) });
            }
            // L1: 认为别人随机，猜 50*p
            for (let i = 0; i < 2; i++) {
                kLevels.push({ level: 'L1', guess: Math.floor(50 * p + (Math.random() - 0.5) * 10) });
            }
            // L2: 认为别人L1
            const l2base = 50 * p * p;
            for (let i = 0; i < 2; i++) {
                kLevels.push({ level: 'L2', guess: Math.floor(l2base + (Math.random() - 0.5) * 8) });
            }
            // L3
            const l3base = 50 * p * p * p;
            for (let i = 0; i < 2; i++) {
                kLevels.push({ level: 'L3', guess: Math.floor(l3base + (Math.random() - 0.5) * 5) });
            }
            // L∞ (=0)
            kLevels.push({ level: 'L∞ (均衡)', guess: Math.floor(Math.random() * 3) });

            return kLevels;
        };

        const estimateKLevel = (playerGuess, aiGuesses) => {
            // 根据玩家的猜测估计其k级别
            const allGuesses = [playerGuess, ...aiGuesses.map(a => a.guess)];
            const avg = allGuesses.reduce((a, b) => a + b, 0) / allGuesses.length;
            const target = avg * p;

            // 逆向推算：如果玩家认为所有人猜 target，那么 playerGuess ≈ target * p_effective
            // k级别越高，猜测越接近0
            if (playerGuess <= 2) return 'L∞ (纳什均衡)';
            if (playerGuess <= 8) return 'L3-L4';
            if (playerGuess <= 18) return 'L2';
            if (playerGuess <= 35) return 'L1';
            if (playerGuess <= 55) return 'L0 (随机水平)';
            return '>L0 (高于随机)';
        };

        document.getElementById('bc-submit').addEventListener('click', () => {
            const yourGuess = parseInt(document.getElementById('bc-guess').value);
            const aiPlayers = getAIKLevels();
            const allGuesses = [yourGuess, ...aiPlayers.map(a => a.guess)];
            const avg = allGuesses.reduce((a, b) => a + b, 0) / allGuesses.length;
            const target = avg * p;

            // 找最接近目标的
            let winner = { guess: null, dist: Infinity, who: '' };
            const checkWinner = (guess, who) => {
                const dist = Math.abs(guess - target);
                if (dist < winner.dist) { winner = { guess, dist, who }; }
            };
            checkWinner(yourGuess, '你');
            for (const ai of aiPlayers) checkWinner(ai.guess, `AI (${ai.level})`);

            round++;
            const won = winner.who === '你';
            if (won) yourScore++;
            playerKLevel = estimateKLevel(yourGuess, aiPlayers);

            history.push({ round, yourGuess, target: target.toFixed(1), avg: avg.toFixed(1), won });

            document.getElementById('bc-result').innerHTML = `
                <div class="result-panel">
                    <p style="font-size:1.1rem;margin-bottom:12px">
                        平均值: <b>${avg.toFixed(1)}</b> | 目标 (×${p.toFixed(2)}): <b style="color:var(--warning)">${target.toFixed(1)}</b>
                    </p>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:8px">
                        <span class="choice-badge you">你: ${yourGuess}</span>
                        ${aiPlayers.map(a => `<span style="padding:4px 10px;border-radius:12px;background:var(--bg-secondary);font-size:0.8rem">${a.level}: ${a.guess}</span>`).join(' ')}
                    </div>
                    <p style="margin-top:8px">
                        ${won ? '<span style="color:var(--success);font-size:1.2rem">🏆 你赢了！</span>' : `<span style="color:var(--text-secondary)">胜者: ${winner.who} (猜${winner.guess})</span>`}
                    </p>
                    <p style="color:var(--accent);margin-top:4px">🧠 你的推理层级: <b>${playerKLevel}</b></p>
                </div>
            `;

            document.getElementById('bc-score').innerHTML = `
                <div class="scoreboard">
                    <div class="score-item">
                        <div class="score-label">获胜次数</div>
                        <div class="score-value" style="color:var(--accent)">${yourScore}/${round}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">推理层级</div>
                        <div class="score-value" style="color:var(--warning)">${playerKLevel}</div>
                    </div>
                </div>
            `;

            let histHtml = '<h4>历史</h4><div style="max-height:150px;overflow-y:auto;font-size:0.8rem">';
            for (const h of [...history].reverse()) {
                histHtml += `<div style="padding:3px 0;border-bottom:1px solid var(--border)">
                    R${h.round}: 你猜${h.yourGuess}, 目标${h.target} ${h.won ? '🏆' : ''}
                </div>`;
            }
            histHtml += '</div>';
            document.getElementById('bc-history').innerHTML = histHtml;
        });
    },

    cleanup() {}
};
