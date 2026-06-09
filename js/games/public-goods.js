/**
 * 公共物品博弈 (Public Goods Game)
 * 多人博弈：每人决定贡献多少到公共池，总贡献翻倍后平均分配
 */
const PublicGoodsGame = {
    id: 'public-goods',
    name: '公共物品博弈',
    description: `你和另外3名玩家各有20个代币。每人决定向<b>公共项目</b>贡献多少，<b>总贡献×2</b>后平均分配给所有人。
    <br><br>如果你贡献10个，总贡献100，翻倍200，每人得50——你净赚40！但如果别人都不贡献，你贡献10只净赚-5。
    <br><br>个体理性是<b>搭便车</b>（贡献0），但所有人贡献才能最大化集体收益。这就是<b>公共物品供给不足</b>的困境。`,

    init(container) {
        let endowment = 20;
        let yourTotal = 0, othersAverage = 0;
        let round = 0;
        const history = [];
        const numPlayers = 4;

        // 其他玩家的贡献策略
        const getOthersContribution = () => {
            // 模拟其他3个玩家的行为
            let total = 0;
            for (let i = 0; i < numPlayers - 1; i++) {
                // 有些慷慨有些自私
                const base = Math.random() < 0.3 ? endowment * 0.75 : endowment * 0.25;
                total += Math.floor(Math.random() * base + endowment * 0.1);
            }
            // 如果用户一直贡献多，其他人可能模仿
            if (history.length >= 2 && history.slice(-2).every(h => h.yourContribution >= 12)) {
                total = Math.floor(total * 1.2);
            }
            return Math.min(total, (numPlayers - 1) * endowment);
        };

        container.innerHTML = `
            <div class="game-panel public-goods-layout" style="max-width:700px;margin:0 auto">
                <div class="game-info">
                    <h2>🏦 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <p style="color:var(--accent);margin-bottom:12px">🎒 每轮你有 <b>${endowment}</b> 个代币</p>
                    <div class="slider-group">
                        <label>贡献: <span id="pg-contrib-val" style="color:var(--accent)">10</span> 个</label>
                        <input type="range" id="pg-contribution" min="0" max="20" value="10">
                        <label style="font-size:0.85rem;color:var(--text-secondary)">自留: <span id="pg-keep-val">10</span> 个</label>
                    </div>
                    <button class="btn btn-primary" id="pg-submit">确认贡献</button>
                    <div id="pg-result"></div>
                    <div id="pg-score"></div>
                    <div id="pg-history" style="margin-top:16px"></div>
                </div>
            </div>
        `;

        document.getElementById('pg-contribution').addEventListener('input', (e) => {
            document.getElementById('pg-contrib-val').textContent = e.target.value;
            document.getElementById('pg-keep-val').textContent = endowment - parseInt(e.target.value);
        });

        const updateScoreboard = () => {
            document.getElementById('pg-score').innerHTML = round > 0 ? `
                <div class="scoreboard">
                    <div class="score-item">
                        <div class="score-label">你的累计收益</div>
                        <div class="score-value" style="color:var(--accent)">${yourTotal}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">其他玩家平均收益</div>
                        <div class="score-value" style="color:var(--danger)">${othersAverage.toFixed(0)}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">轮次</div>
                        <div class="score-value" style="color:var(--text-secondary)">${round}</div>
                    </div>
                </div>
            ` : '';
        };

        document.getElementById('pg-submit').addEventListener('click', () => {
            const yourContribution = parseInt(document.getElementById('pg-contribution').value);
            const othersContrib = getOthersContribution();
            const totalContrib = yourContribution + othersContrib;
            const doubled = totalContrib * 2;
            const perPerson = doubled / numPlayers;
            const yourProfit = endowment - yourContribution + perPerson;
            const othersProfit = endowment - (othersContrib / (numPlayers - 1)) + perPerson;

            round++;
            yourTotal += yourProfit;
            othersAverage = (othersAverage * (round - 1) + othersProfit) / round;

            history.push({
                round, yourContribution, othersContrib: othersContrib.toFixed(0),
                totalContrib: totalContrib.toFixed(0), doubled: doubled.toFixed(0),
                yourProfit: yourProfit.toFixed(1)
            });

            document.getElementById('pg-result').innerHTML = `
                <div class="result-panel">
                    <table style="width:100%;text-align:center;margin-bottom:12px">
                        <tr style="color:var(--text-secondary)">
                            <td>你贡献</td><td>其他人贡献</td><td>总贡献</td><td>翻倍后</td><td>每人分得</td>
                        </tr>
                        <tr style="font-size:1.1rem;font-weight:600">
                            <td style="color:var(--accent)">${yourContribution}</td>
                            <td>${othersContrib.toFixed(0)}</td>
                            <td>${totalContrib.toFixed(0)}</td>
                            <td style="color:var(--warning)">${doubled.toFixed(0)}</td>
                            <td style="color:var(--success)">${perPerson.toFixed(0)}</td>
                        </tr>
                    </table>
                    <div class="payoff-display">
                        <div>
                            <span class="payoff-value you">+${yourProfit.toFixed(1)}</span><br>
                            <span style="color:var(--text-secondary);font-size:0.85rem">你的净收益</span>
                        </div>
                    </div>
                    ${yourContribution === 0 ? '<p style="color:var(--warning);margin-top:8px">🟡 你选择了搭便车——个体理性但集体受损</p>' : ''}
                    ${yourContribution === endowment ? '<p style="color:var(--success);margin-top:8px">✅ 你全力贡献——最大化集体利益</p>' : ''}
                </div>
            `;

            updateScoreboard();

            let histHtml = '<h4 style="margin-bottom:8px">历史记录</h4><div style="max-height:200px;overflow-y:auto;font-size:0.8rem">';
            for (let i = history.length - 1; i >= 0; i--) {
                const h = history[i];
                histHtml += `<div style="padding:4px 0;border-bottom:1px solid var(--border)">
                    第${h.round}轮: 你贡献${h.yourContribution}, 收益${h.yourProfit}
                </div>`;
            }
            histHtml += '</div>';
            document.getElementById('pg-history').innerHTML = histHtml;
        });
    },

    cleanup() {}
};
