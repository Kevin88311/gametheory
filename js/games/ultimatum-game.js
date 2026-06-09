/**
 * 最后通牒博弈 (Ultimatum Game)
 * 一人提议分配，另一人接受或拒绝。拒绝则双方都得0。
 */
const UltimatumGame = {
    id: 'ultimatum',
    name: '最后通牒博弈',
    description: `有一笔100元的钱需要分配。<b>提议者</b>提出分配方案，<b>回应者</b>决定接受还是拒绝。
    <br><br>如果接受，按方案分配；如果拒绝，双方都得0。<br>
    纯理性预测：提议者给1元，回应者也会接受。但实验表明：<b>低于20-30%的分配通常被拒绝</b>——人们会为了公平而牺牲自身利益。`,

    init(container) {
        let role = 'responder'; // 用户默认扮演回应者
        let total = 100;
        let rounds = [];
        let proposerScore = 0, responderScore = 0;

        const renderGame = () => {
            let html = `
                <div class="game-panel ultimatum-layout" style="max-width:700px;margin:0 auto">
                    <div class="game-info">
                        <h2>💰 ${this.name}</h2>
                        <div class="game-desc">${this.description}</div>
                        <div style="margin:16px 0">
                            <button class="nav-btn ${role === 'proposer' ? 'active' : ''}" id="ug-role-proposer">我是提议者</button>
                            <button class="nav-btn ${role === 'responder' ? 'active' : ''}" id="ug-role-responder">我是回应者</button>
                        </div>
                        <div id="ug-play-area"></div>
                        <div id="ug-result"></div>
                        <div id="ug-score"></div>
                        <div id="ug-history" style="margin-top:16px"></div>
                    </div>
                </div>
            `;
            container.innerHTML = html;

            document.getElementById('ug-role-proposer').addEventListener('click', () => { role = 'proposer'; renderPlayArea(); });
            document.getElementById('ug-role-responder').addEventListener('click', () => { role = 'responder'; renderPlayArea(); });
            renderPlayArea();
            updateScoreboard();
        };

        const renderPlayArea = () => {
            const area = document.getElementById('ug-play-area');
            if (role === 'proposer') {
                area.innerHTML = `
                    <div class="slider-group">
                        <label>分给对方: <span id="ug-offer-val" style="color:var(--accent)">50</span> 元</label>
                        <input type="range" id="ug-offer" min="0" max="100" value="50">
                        <label style="font-size:0.85rem;color:var(--text-secondary)">你自己留: <span id="ug-keep-val">50</span> 元</label>
                    </div>
                    <button class="btn btn-primary" id="ug-submit">提交方案</button>
                `;

                document.getElementById('ug-offer').addEventListener('input', (e) => {
                    document.getElementById('ug-offer-val').textContent = e.target.value;
                    document.getElementById('ug-keep-val').textContent = 100 - parseInt(e.target.value);
                });

                document.getElementById('ug-submit').addEventListener('click', () => {
                    const offer = parseInt(document.getElementById('ug-offer').value);
                    const threshold = Math.random() < 0.5 ? 20 + Math.random() * 20 : Math.random() * 40;
                    const accepted = offer >= threshold;

                    const result = document.getElementById('ug-result');
                    if (accepted) {
                        proposerScore += (100 - offer);
                        responderScore += offer;
                        result.innerHTML = `
                            <div class="result-panel">
                                <p style="font-size:1.2rem">✅ 对方<b>接受</b>了你的方案</p>
                                <p style="color:var(--text-secondary)">对方心理底线约 ${threshold.toFixed(0)} 元，你给了 ${offer} 元</p>
                                <div class="payoff-display">
                                    <div><span class="payoff-value you">+${100 - offer}</span><br><span style="color:var(--text-secondary)">你得到</span></div>
                                    <div><span class="payoff-value them">+${offer}</span><br><span style="color:var(--text-secondary)">对方得到</span></div>
                                </div>
                            </div>`;
                    } else {
                        result.innerHTML = `
                            <div class="result-panel">
                                <p style="font-size:1.2rem">❌ 对方<b>拒绝</b>了你的方案</p>
                                <p style="color:var(--text-secondary)">对方心理底线约 ${threshold.toFixed(0)} 元，你只给了 ${offer} 元</p>
                                <p style="color:var(--danger)">双方都得 0！</p>
                            </div>`;
                    }
                    rounds.push({ role: 'proposer', offer, accepted, threshold });
                    updateScoreboard();
                    renderHistory();
                });
            } else {
                area.innerHTML = `
                    <p style="color:var(--text-secondary);margin-bottom:12px">对方提出了分配方案，请决定是否接受：</p>
                    <button class="btn btn-primary" id="ug-new-offer">生成新方案</button>
                    <div id="ug-offer-display"></div>
                `;

                document.getElementById('ug-new-offer').addEventListener('click', () => {
                    const offer = Math.floor(Math.random() * 50) + 1; // 1-50
                    const display = document.getElementById('ug-offer-display');
                    display.innerHTML = `
                        <div style="margin-top:16px;padding:20px;background:var(--bg-primary);border-radius:12px;border:1px solid var(--border);text-align:center">
                            <p style="font-size:1.2rem;margin-bottom:12px">对方提议：<b style="color:var(--accent)">你 ${offer} 元</b>，对方 ${100 - offer} 元</p>
                            <button class="btn btn-primary" id="ug-accept" style="margin-right:8px">接受</button>
                            <button class="btn btn-secondary" id="ug-reject">拒绝</button>
                        </div>
                    `;

                    document.getElementById('ug-accept').addEventListener('click', () => {
                        responderScore += offer;
                        proposerScore += (100 - offer);
                        document.getElementById('ug-result').innerHTML = `
                            <div class="result-panel">
                                <p style="font-size:1.2rem;color:var(--success)">✅ 你接受了方案</p>
                                <div class="payoff-display">
                                    <div><span class="payoff-value you">+${offer}</span></div>
                                    <div><span class="payoff-value them">+${100 - offer}</span></div>
                                </div>
                            </div>`;
                        rounds.push({ role: 'responder', offer, accepted: true });
                        updateScoreboard();
                        renderHistory();
                    });

                    document.getElementById('ug-reject').addEventListener('click', () => {
                        document.getElementById('ug-result').innerHTML = `
                            <div class="result-panel">
                                <p style="font-size:1.2rem;color:var(--danger)">❌ 你拒绝了方案</p>
                                <p style="color:var(--text-secondary)">双方都得 0。这是你对不公平的抗议。</p>
                            </div>`;
                        rounds.push({ role: 'responder', offer, accepted: false });
                        updateScoreboard();
                        renderHistory();
                    });
                });

                document.getElementById('ug-new-offer').click();
            }
        };

        const updateScoreboard = () => {
            const el = document.getElementById('ug-score');
            if (!el) return;
            el.innerHTML = `
                <div class="scoreboard">
                    <div class="score-item">
                        <div class="score-label">提议者累计</div>
                        <div class="score-value" style="color:var(--accent)">${proposerScore}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">回应者累计</div>
                        <div class="score-value" style="color:var(--danger)">${responderScore}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">轮次</div>
                        <div class="score-value" style="color:var(--text-secondary)">${rounds.length}</div>
                    </div>
                </div>
            `;
        };

        const renderHistory = () => {
            if (rounds.length === 0) return;
            let html = '<h4 style="margin-bottom:8px">历史记录</h4><div style="max-height:200px;overflow-y:auto;font-size:0.85rem">';
            for (let i = rounds.length - 1; i >= 0; i--) {
                const r = rounds[i];
                html += `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
                    第${i+1}轮: ${r.role === 'proposer' ? '你提议' : '对方提议'} ${r.offer}元 →
                    ${r.accepted ? '<span style="color:var(--success)">接受</span>' : '<span style="color:var(--danger)">拒绝</span>'}
                </div>`;
            }
            html += '</div>';
            document.getElementById('ug-history').innerHTML = html;
        };

        renderGame();
    },

    cleanup() {}
};
