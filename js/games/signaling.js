/**
 * 信号博弈 (Signaling Game)
 * 不完全信息：发送者类型未知，通过信号传递信息
 */
const SignalingGame = {
    id: 'signaling',
    name: '信号博弈',
    description: `求职者有两种<b>类型</b>：高能力(60%概率)或低能力(40%)。求职者选择<b>教育信号</b>（高学历/低学历）。
    <br>雇主看到信号后决定<b>工资</b>（高/低），但不知道求职者真实类型。
    <br>高能力者学历成本低、低能力者成本高——这可能导致<b>分离均衡</b>（只有高能力者选择高学历）或<b>混同均衡</b>（两类人都选相同信号）。`,

    init(container) {
        // 博弈参数
        const priorHigh = 0.6; // 先验概率：高能力
        const costHigh = { high: 2, low: 0 };  // 高能力者的信号成本
        const costLow = { high: 5, low: 0 };   // 低能力者的信号成本
        const wageHigh = 10;
        const wageLow = 4;

        let role = 'sender'; // sender 或 receiver
        let playerType = 'high'; // 用户类型（当扮演发送者时）
        let rounds = [];
        let totalWage = 0;

        const render = () => {
            container.innerHTML = `
                <div class="game-panel ultimatum-layout" style="max-width:700px">
                    <div class="game-info">
                        <h2>📡 ${this.name}</h2>
                        <div class="game-desc">${this.description}</div>
                        <div style="display:flex;gap:8px;margin:12px 0">
                            <button class="nav-btn ${role === 'sender' ? 'active' : ''}" id="sg-sender">我当求职者</button>
                            <button class="nav-btn ${role === 'receiver' ? 'active' : ''}" id="sg-receiver">我当雇主</button>
                        </div>
                        <div id="sg-play"></div>
                        <div id="sg-result"></div>
                        <div id="sg-score"></div>
                    </div>
                </div>
            `;

            // 贝叶斯更新展示
            const showBeliefs = (belief) => {
                return `
                    <div style="margin-top:12px;padding:12px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border);text-align:center">
                        <span style="color:var(--text-secondary);font-size:0.85rem">雇主信念 P(高能力): </span>
                        <span style="font-size:1.3rem;font-weight:700;color:var(--warning)">${(belief*100).toFixed(0)}%</span>
                    </div>
                `;
            };

            if (role === 'sender') {
                // 随机分配类型
                playerType = Math.random() < priorHigh ? 'high' : 'low';
                const cost = playerType === 'high' ? costHigh : costLow;

                document.getElementById('sg-play').innerHTML = `
                    <div class="result-panel">
                        <p style="font-size:1.1rem">你的类型: <b style="color:${playerType === 'high' ? 'var(--success)' : 'var(--danger)'}">${playerType === 'high' ? '高能力 ⭐' : '低能力'}</b></p>
                        <p style="color:var(--text-secondary);font-size:0.9rem">
                            高学历成本: ${cost.high} | 低学历成本: ${cost.low}
                        </p>
                        <div style="display:flex;gap:12px;justify-content:center;margin-top:12px">
                            <button class="strategy-btn cooperate" id="sg-high-ed">🎓 高学历 (成本 ${cost.high})</button>
                            <button class="strategy-btn defect" id="sg-low-ed">📋 低学历 (成本 ${cost.low})</button>
                        </div>
                    </div>
                `;

                const handleChoice = (education) => {
                    // 雇主的贝叶斯推断
                    let belief;
                    if (education === 'high') {
                        // 分离均衡信念：只有高能力选高学历
                        belief = 1.0;
                    } else {
                        // 低学历：可能两种类型
                        belief = priorHigh * 0.1 / (priorHigh * 0.1 + (1 - priorHigh) * 0.9);
                    }

                    // 雇主基于信念决定工资
                    const expectedHigh = belief * wageHigh + (1 - belief) * (wageHigh * 0.3);
                    const expectedLow = belief * wageLow + (1 - belief) * wageLow;
                    const offeredWage = expectedHigh >= 6 ? 'high' : 'low';
                    const wageAmount = offeredWage === 'high' ? wageHigh : wageLow;

                    const netPayoff = wageAmount - cost[education];
                    totalWage += netPayoff;
                    rounds.push({ type: playerType, education, wage: offeredWage, amount: wageAmount, net: netPayoff, belief });

                    document.getElementById('sg-result').innerHTML = `
                        <div class="result-panel">
                            <p>雇主看到你的信号后...</p>
                            ${showBeliefs(belief)}
                            <p style="margin-top:8px">雇主给你: <b style="color:${offeredWage === 'high' ? 'var(--success)' : 'var(--danger)'}">${offeredWage === 'high' ? '高工资' : '低工资'} ($${wageAmount})</b></p>
                            <div class="payoff-display">
                                <div><span class="payoff-value you">$${netPayoff}</span><br><span style="color:var(--text-secondary)">你的净收益</span></div>
                            </div>
                            <button class="btn btn-primary" style="margin-top:12px" id="sg-next">下一轮 →</button>
                        </div>
                    `;

                    updateScore();
                    document.getElementById('sg-next').addEventListener('click', () => render());
                };

                document.getElementById('sg-high-ed').addEventListener('click', () => handleChoice('high'));
                document.getElementById('sg-low-ed').addEventListener('click', () => handleChoice('low'));

            } else {
                // Receiver 角色
                const senderType = Math.random() < priorHigh ? 'high' : 'low';
                const cost = senderType === 'high' ? costHigh : costLow;
                let senderEducation;

                // 发送者策略（模拟分离均衡）
                if (senderType === 'high') {
                    senderEducation = Math.random() < 0.8 ? 'high' : 'low';
                } else {
                    senderEducation = Math.random() < 0.1 ? 'high' : 'low';
                }

                document.getElementById('sg-play').innerHTML = `
                    <div class="result-panel">
                        <p style="font-size:1.1rem">求职者选择: <b>${senderEducation === 'high' ? '🎓 高学历' : '📋 低学历'}</b></p>
                        <p style="color:var(--text-secondary);font-size:0.9rem">你不确定求职者真实类型（高能力概率 60%）</p>
                        <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:4rem">
                            更新你的信念。如果这是分离均衡，高学历 = 高能力信号。
                        </p>
                        <div style="display:flex;gap:12px;justify-content:center;margin-top:12px">
                            <button class="strategy-btn cooperate" id="sg-high-wage">💰 高工资 ($${wageHigh})</button>
                            <button class="strategy-btn defect" id="sg-low-wage">💵 低工资 ($${wageLow})</button>
                        </div>
                    </div>
                `;

                document.getElementById('sg-high-wage').addEventListener('click', () => {
                    handleReceiver(senderType, senderEducation, 'high');
                });
                document.getElementById('sg-low-wage').addEventListener('click', () => {
                    handleReceiver(senderType, senderEducation, 'low');
                });
            }

            const handleReceiver = (type, education, wage) => {
                const wageAmount = wage === 'high' ? wageHigh : wageLow;
                const cost = type === 'high' ? costHigh : costLow;
                const senderPayoff = wageAmount - cost[education];
                const correctType = (wage === 'high' && type === 'high') || (wage === 'low' && type === 'low');
                const correctEducation = (wage === 'high' && education === 'high') || (wage === 'low' && education === 'low');
                const employerPayoff = (correctType ? 2 : -1) + (correctEducation ? 1 : 0);

                // 贝叶斯更新
                let belief;
                if (education === 'high') {
                    belief = priorHigh * 0.8 / (priorHigh * 0.8 + (1 - priorHigh) * 0.1);
                } else {
                    belief = priorHigh * 0.2 / (priorHigh * 0.2 + (1 - priorHigh) * 0.9);
                }

                rounds.push({ type, education, wage, wageAmount, correctType, senderPayoff, employerPayoff, belief });

                document.getElementById('sg-result').innerHTML = `
                    <div class="result-panel">
                        <p>求职者真实类型: <b style="color:${type === 'high' ? 'var(--success)' : 'var(--danger)'}">${type === 'high' ? '高能力 ⭐' : '低能力'}</b></p>
                        ${showBeliefs(belief)}
                        <p style="margin-top:8px">
                            ${correctType ? '<span style="color:var(--success)">✅ 工资匹配能力</span>' : '<span style="color:var(--danger)">❌ 工资与能力不匹配</span>'}
                            ${!correctEducation ? '<br><span style="color:var(--text-secondary)">信号可能具有误导性</span>' : ''}
                        </p>
                        <p style="color:var(--text-secondary);margin-top:4px">
                            求职者净收益: $${senderPayoff} | 雇主收益: ${employerPayoff}
                        </p>
                        <button class="btn btn-primary" style="margin-top:12px" id="sg-next">下一轮 →</button>
                    </div>
                `;

                updateScore();
                document.getElementById('sg-next').addEventListener('click', () => render());
            };

            const updateScore = () => {
                document.getElementById('sg-score').innerHTML = `
                    <div class="scoreboard">
                        <div class="score-item">
                            <div class="score-label">${role === 'sender' ? '累计净收益' : '正确决策'}</div>
                            <div class="score-value" style="color:var(--accent)">
                                ${role === 'sender' ? '$' + totalWage : rounds.filter(r => r.correctType).length + '/' + rounds.length}
                            </div>
                        </div>
                        <div class="score-item">
                            <div class="score-label">轮次</div>
                            <div class="score-value" style="color:var(--text-secondary)">${rounds.length}</div>
                        </div>
                    </div>
                `;
            };

            // 角色切换按钮
            document.getElementById('sg-sender').addEventListener('click', () => { role = 'sender'; render(); });
            document.getElementById('sg-receiver').addEventListener('click', () => { role = 'receiver'; render(); });
        };

        render();
    },

    cleanup() {}
};
