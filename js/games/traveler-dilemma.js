/**
 * 旅行者困境 (Traveler's Dilemma)
 * 两个旅客索赔2-100，低者获「低价+罚款」，高者获「低价-罚款」
 */
const TravelerDilemma = {
    id: 'traveler-dilemma',
    name: '旅行者困境',
    description: `航空公司丢失了你和另一位旅客的相同物品。各自<b>索赔 $2-$100</b>。
    <br><br>若索赔相同，各获赔该金额。若不同：<b>低价者</b>得「低价+$R」，<b>高价者</b>得「低价-$R」。
    <br>纳什均衡是<b>双方都索赔 $2</b>（唯一）。但实验中人们索赔远高于此——太"理性"反而不划算。
    <br>调整惩罚 R 值观察行为变化。`,

    init(container) {
        let R = 2; // 惩罚/奖励金额
        let yourScore = 0, aiScore = 0, round = 0;
        const history = [];

        const render = () => {
            container.innerHTML = `
                <div class="game-panel ultimatum-layout" style="max-width:700px">
                    <div class="game-info">
                        <h2>✈️ ${this.name}</h2>
                        <div class="game-desc">${this.description}</div>
                        <div class="ai-select" style="margin-bottom:8px">
                            <label style="color:var(--text-secondary);font-size:0.9rem">惩罚金额 R</label>
                            <select id="td-r">
                                <option value="1">R = 1</option>
                                <option value="2" selected>R = 2</option>
                                <option value="5">R = 5</option>
                                <option value="10">R = 10</option>
                                <option value="50">R = 50</option>
                            </select>
                        </div>
                        <div class="slider-group">
                            <label>你的索赔: <span id="td-claim-val" style="color:var(--accent)">50</span> 元</label>
                            <input type="range" id="td-claim" min="2" max="100" value="50">
                        </div>
                        <div style="margin-bottom:12px;color:var(--text-secondary);font-size:0.85rem">
                            纳什均衡: 索赔 $2 | 但合作最优: 索赔 $100
                        </div>
                        <button class="btn btn-primary" id="td-submit">提交索赔</button>
                        <div id="td-result"></div>
                        <div id="td-score"></div>
                        <div id="td-history" style="margin-top:16px"></div>
                        <canvas id="td-chart" width="600" height="250" style="width:100%;margin-top:16px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border)"></canvas>
                    </div>
                </div>
            `;

            document.getElementById('td-claim').addEventListener('input', function() {
                document.getElementById('td-claim-val').textContent = this.value;
                drawPayoffChart(parseInt(this.value));
            });

            document.getElementById('td-r').addEventListener('change', function() {
                R = parseInt(this.value);
                const claim = parseInt(document.getElementById('td-claim').value);
                drawPayoffChart(claim);
            });

            drawPayoffChart(50);

            document.getElementById('td-submit').addEventListener('click', () => {
                const yourClaim = parseInt(document.getElementById('td-claim').value);

                // AI 策略：通常索赔较高（模拟真人行为）
                const aiMode = Math.random();
                let aiClaim;
                if (aiMode < 0.5) {
                    aiClaim = Math.floor(Math.random() * 30) + 80; // 80-100
                } else if (aiMode < 0.8) {
                    aiClaim = Math.floor(Math.random() * 40) + 50; // 50-90
                } else {
                    aiClaim = Math.floor(Math.random() * 20) + 20; // 20-40
                }
                aiClaim = Math.max(2, Math.min(100, aiClaim));

                let yourPayoff, aiPayoff;
                if (yourClaim === aiClaim) {
                    yourPayoff = yourClaim;
                    aiPayoff = aiClaim;
                } else if (yourClaim < aiClaim) {
                    yourPayoff = yourClaim + R;
                    aiPayoff = yourClaim - R;
                } else {
                    yourPayoff = aiClaim - R;
                    aiPayoff = aiClaim + R;
                }

                round++;
                yourScore += yourPayoff;
                aiScore += aiPayoff;
                history.push({ round, yourClaim, aiClaim, yourPayoff, aiPayoff });

                document.getElementById('td-result').innerHTML = `
                    <div class="result-panel">
                        <div class="choices">
                            <div><span style="color:var(--text-secondary)">你索赔</span><br><span class="choice-badge you">$${yourClaim}</span></div>
                            <div><span style="color:var(--text-secondary)">对方索赔</span><br><span class="choice-badge them">$${aiClaim}</span></div>
                        </div>
                        <div class="payoff-display">
                            <div><span class="payoff-value you">$${yourPayoff}</span></div>
                            <div><span class="payoff-value them">$${aiPayoff}</span></div>
                        </div>
                        ${yourClaim === 2 ? '<p style="color:var(--warning);margin-top:4px">🟡 你玩了纳什均衡策略</p>' : ''}
                        ${yourClaim >= 90 ? '<p style="color:var(--success);margin-top:4px">✅ 你选择了接近合作的策略</p>' : ''}
                    </div>
                `;

                updateScoreboard();
                updateHistory();
            });
        };

        const updateScoreboard = () => {
            document.getElementById('td-score').innerHTML = `
                <div class="scoreboard">
                    <div class="score-item">
                        <div class="score-label">你的总分</div>
                        <div class="score-value" style="color:var(--accent)">$${yourScore}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">对手总分</div>
                        <div class="score-value" style="color:var(--danger)">$${aiScore}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">轮次</div>
                        <div class="score-value" style="color:var(--text-secondary)">${round}</div>
                    </div>
                </div>
            `;
        };

        const updateHistory = () => {
            if (history.length === 0) return;
            let html = '<h4>历史</h4><div style="max-height:120px;overflow-y:auto;font-size:0.8rem">';
            for (const h of [...history].reverse().slice(0, 10)) {
                html += `<div style="padding:2px 0;border-bottom:1px solid var(--border)">
                    R${h.round}: 你$${h.yourClaim} | 对方$${h.aiClaim} → 你得$${h.yourPayoff}
                </div>`;
            }
            html += '</div>';
            document.getElementById('td-history').innerHTML = html;
        };

        const drawPayoffChart = (yourClaim) => {
            const canvas = document.getElementById('td-chart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const margin = { top: 30, right: 20, bottom: 40, left: 50 };
            const pw = w - margin.left - margin.right;
            const ph = h - margin.top - margin.bottom;

            // 网格
            ctx.strokeStyle = 'rgba(51,65,85,0.5)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 5; i++) {
                const y = margin.top + (ph * i / 5);
                ctx.beginPath();
                ctx.moveTo(margin.left, y);
                ctx.lineTo(w - margin.right, y);
                ctx.stroke();
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px system-ui';
                ctx.fillText(Math.round(120 - i * 24), 10, y + 4);
            }

            // 收益曲线
            const drawCurve = (color, isYour) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let x = 2; x <= 100; x++) {
                    let payoff;
                    if (isYour) {
                        payoff = x === yourClaim ? x : (x < yourClaim ? x + R : yourClaim - R);
                    } else {
                        payoff = x === yourClaim ? x : (x < yourClaim ? x - R : yourClaim + R);
                    }
                    const px = margin.left + ((x - 2) / 98) * pw;
                    const py = margin.top + ph - (Math.max(-20, Math.min(120, payoff)) + 20) / 140 * ph;
                    if (x === 2) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            };

            drawCurve('#38bdf8', true);  // 你的收益曲线

            // 标记你的索赔点
            const px = margin.left + ((yourClaim - 2) / 98) * pw;
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(px, margin.top + ph - (yourClaim + 20) / 140 * ph, 6, 0, Math.PI * 2);
            ctx.fill();

            // 标签
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '12px system-ui';
            ctx.fillText(`你的索赔 = $${yourClaim}`, margin.left, margin.top - 8);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('对方索赔金额 →', w / 2, h - 5);
        };

        render();
    },

    cleanup() {}
};
