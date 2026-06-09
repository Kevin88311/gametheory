/**
 * 蜈蚣博弈 (Centipede Game)
 * 序贯博弈：用户(玩家1)与AI(玩家2)轮流选择继续或终止
 */
const CentipedeGame = {
    id: 'centipede',
    name: '蜈蚣博弈',
    description: `两人轮流决策。总奖金随轮次增长，但<b>随时可以终止</b>——终止者拿走大头，对方拿小头。
    <br>你扮演<b>玩家1</b>（先手），AI扮演<b>玩家2</b>。
    <br><br>逆向归纳法预测<b>第一轮就终止</b>，但实验中人们会合作多轮。这就是<b>逆向归纳悖论</b>。`,

    init(container) {
        const totalRounds = 6;
        let gameActive = true;
        let currentRound = 0;
        let history = [];
        this._aiTimeout = null;

        // 生成所有回合的收益数据
        const roundData = [];
        for (let r = 0; r < totalRounds; r++) {
            const base = (r + 1) * 2;
            if (r % 2 === 0) {
                // 玩家1的回合 — 终止则玩家1拿大头
                roundData.push({ round: r, player: 1, playerName: '你', ifTerm: [base + 1, base - 1], pot: base * 2 });
            } else {
                // 玩家2的回合 — 终止则玩家2拿大头
                roundData.push({ round: r, player: 2, playerName: 'AI', ifTerm: [base - 1, base + 1], pot: base * 2 });
            }
        }
        const finalPayoff = totalRounds * 2 + 2;

        const tree = createCentipedeTree(totalRounds);
        const spePath = tree.backwardInduction();

        // AI策略：按逆向归纳（在其回合终止）或以一定概率继续
        const aiCooperateProb = 0.3; // AI有30%概率选择继续（模拟真人行为）

        const getAIChoice = (aiCooperates) => {
            // SPE预测AI在轮到它时终止
            // 但加入一些"非理性"继续来模拟真人
            return aiCooperates ? 'cont' : 'term';
        };

        const restart = () => {
            if (this._aiTimeout) { clearTimeout(this._aiTimeout); this._aiTimeout = null; }
            gameActive = true;
            currentRound = 0;
            history = [];
            render();
        };

        const render = () => {
            container.innerHTML = `
                <div class="game-panel ultimatum-layout" style="max-width:800px">
                    <div class="game-info">
                        <h2>🌳 ${this.name}</h2>
                        <div class="game-desc">${this.description}</div>

                        <!-- 游戏流程可视化 -->
                        <div id="cg-flow" style="margin:20px 0;overflow-x:auto"></div>

                        <!-- 当前决策 -->
                        <div id="cg-current"></div>

                        <!-- 结果 -->
                        <div id="cg-result"></div>

                        <!-- 控制 -->
                        <div style="margin-top:12px;display:flex;gap:8px">
                            <button class="btn btn-primary" id="cg-restart">🔄 重新开始</button>
                        </div>

                        <!-- 博弈树参考图 -->
                        <details style="margin-top:16px">
                            <summary style="cursor:pointer;color:var(--text-secondary)">📊 查看完整博弈树</summary>
                            <div id="cg-full-tree" style="margin-top:8px;overflow-x:auto;font-size:0.8rem"></div>
                        </details>
                    </div>
                </div>
            `;

            // 绑定重启按钮（每次 render 后都要重新绑定，因为 DOM 被重建了）
            document.getElementById('cg-restart').addEventListener('click', restart);

            renderFlow();
            if (gameActive && currentRound < totalRounds) {
                renderCurrentDecision();
            }
            renderFullTree();
        };

        const renderFlow = () => {
            const flowDiv = document.getElementById('cg-flow');
            let html = '<div style="display:flex;align-items:center;gap:0;flex-wrap:nowrap;min-width:fit-content;padding:10px 0">';

            for (let r = 0; r < totalRounds; r++) {
                const d = roundData[r];
                const isCurrent = gameActive && r === currentRound;
                const isPast = r < currentRound || (r === currentRound && !gameActive);

                // 节点
                const bgColor = isCurrent ? 'var(--accent)' : isPast ? 'var(--bg-primary)' : 'var(--bg-secondary)';
                const borderColor = isCurrent ? 'var(--accent)' : isPast ? 'var(--border)' : 'var(--border)';
                const opacity = isPast && r < currentRound ? '0.4' : (isCurrent ? '1' : '0.7');

                html += `<div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity}">`;
                html += `<div style="padding:8px 14px;border:2px solid ${borderColor};border-radius:10px;
                    background:${bgColor};text-align:center;min-width:80px;white-space:nowrap">`;
                html += `<div style="font-weight:700;font-size:0.85rem">${d.playerName}的回合</div>`;
                html += `<div style="font-size:0.7rem;color:var(--text-secondary)">奖池: ${d.pot}</div>`;
                if (d.ifTerm) {
                    html += `<div style="font-size:0.7rem;margin-top:2px">
                        <span style="color:var(--accent)">终止:你${d.ifTerm[0]}</span> /
                        <span style="color:var(--danger)">对手${d.ifTerm[1]}</span>
                    </div>`;
                }
                html += `</div>`;

                // 如果过去某轮终止了，标记
                if (history.length > 0 && history[0].round === r) {
                    html += `<div style="font-size:0.7rem;color:var(--warning);margin-top:2px">✋ 在此终止</div>`;
                }

                html += `</div>`;

                // 箭头
                if (r < totalRounds - 1) {
                    html += `<div style="font-size:1.5rem;color:var(--text-secondary);padding:0 4px">→</div>`;
                }
            }

            // 最终合作收益
            html += `<div style="margin-left:4px;padding:8px 14px;border:2px solid var(--success);border-radius:10px;
                background:var(--bg-secondary);text-align:center;opacity:0.6;white-space:nowrap">
                <div style="font-weight:700;font-size:0.85rem;color:var(--success)">全部合作 🏆</div>
                <div style="font-size:0.7rem">各得 ${finalPayoff}</div>
            </div>`;

            html += '</div>';
            flowDiv.innerHTML = html;
        };

        const renderCurrentDecision = () => {
            const d = roundData[currentRound];
            const decisionDiv = document.getElementById('cg-current');

            if (d.player === 1) {
                // 用户的回合
                decisionDiv.innerHTML = `
                    <div style="padding:16px;background:var(--bg-primary);border:2px solid var(--accent);border-radius:12px;text-align:center">
                        <p style="font-size:1.1rem;margin-bottom:12px">
                            🎯 <b>你的回合</b> — 奖池: <b style="color:var(--warning)">${d.pot}</b>
                        </p>
                        <div style="display:flex;gap:12px;justify-content:center">
                            <button class="strategy-btn cooperate" id="cg-cont">🤝 继续（切给对手）</button>
                            <button class="strategy-btn defect" id="cg-term">✋ 终止（你拿${d.ifTerm[0]}，对手拿${d.ifTerm[1]}）</button>
                        </div>
                    </div>
                `;

                document.getElementById('cg-cont').addEventListener('click', () => {
                    history.push({ round: currentRound, player: 1, action: 'cont' });
                    currentRound++;
                    if (currentRound >= totalRounds) endGame('cooperate');
                    else render();
                });

                document.getElementById('cg-term').addEventListener('click', () => {
                    history.push({ round: currentRound, player: 1, action: 'term', payoffs: d.ifTerm });
                    endGame('terminate', d.ifTerm);
                });
            } else {
                // AI的回合 — 显示决策过程
                decisionDiv.innerHTML = `
                    <div style="padding:16px;background:var(--bg-primary);border:2px solid var(--danger);border-radius:12px;text-align:center">
                        <p style="font-size:1.1rem;margin-bottom:8px">
                            🤖 <b>AI的回合</b> — 奖池: <b style="color:var(--warning)">${d.pot}</b>
                        </p>
                        <p style="color:var(--text-secondary);font-size:0.9rem">AI正在决策...</p>
                    </div>
                `;

                // 延迟模拟AI思考
                this._aiTimeout = setTimeout(() => {
                    // AI决策：逆向归纳→终止，但有小概率继续
                    const aiWillCooperate = Math.random() < aiCooperateProb;
                    const action = getAIChoice(aiWillCooperate);

                    if (action === 'term') {
                        history.push({ round: currentRound, player: 2, action: 'term', payoffs: d.ifTerm });
                        endGame('ai_terminate', d.ifTerm, aiWillCooperate);
                    } else {
                        history.push({ round: currentRound, player: 2, action: 'cont', aiCooperated: true });
                        currentRound++;
                        if (currentRound >= totalRounds) endGame('cooperate');
                        else render();
                    }
                }, 800);
            }
        };

        const endGame = (reason, payoffs, aiWasCooperative = false) => {
            gameActive = false;

            let msg = '';
            if (reason === 'cooperate') {
                payoffs = [finalPayoff, finalPayoff];
                msg = '双方合作到最后！最大化共同收益。这在实际中很少见——逆向归纳预测第一轮就会终止。';
            } else if (reason === 'terminate') {
                msg = `你在第 ${currentRound + 1} 轮终止了博弈。逆向归纳法预测的正是这种行为。`;
            } else if (reason === 'ai_terminate') {
                msg = `AI在第 ${currentRound + 1} 轮终止了博弈。${aiWasCooperative ? 'AI最初考虑过合作，但最终选择了理性策略。' : '这符合逆向归纳法的预测。'}`;
            }

            const roundsPlayed = currentRound + 1;
            const speRounds = spePath.length - 1; // 逆向归纳预测的长度

            document.getElementById('cg-result').innerHTML = `
                <div class="result-panel">
                    <p style="font-size:1.2rem">🏁 博弈结束</p>
                    <div class="payoff-display">
                        <div><span class="payoff-value you">${payoffs[0]}</span><br>你的收益</div>
                        <div><span class="payoff-value them">${payoffs[1]}</span><br>AI收益</div>
                    </div>
                    <p style="color:var(--text-secondary);margin-top:12px">${msg}</p>
                    <div style="margin-top:12px;padding:8px;background:var(--bg-secondary);border-radius:8px">
                        <span style="color:var(--warning)">🔍 逆向归纳预测:</span> 第1轮终止 |
                        <span style="color:var(--accent)">实际:</span> 第${roundsPlayed}轮${reason === 'cooperate' ? '全部合作' : '终止'}
                        ${roundsPlayed > speRounds ? '<br>📊 你比逆向归纳预测多合作了 <b>' + (roundsPlayed - speRounds) + '</b> 轮' : ''}
                    </div>
                </div>
            `;

            document.getElementById('cg-current').innerHTML = '';
            renderFlow();
        };

        const renderFullTree = () => {
            const treeDiv = document.getElementById('cg-full-tree');
            const allNodes = tree.getAllNodes();
            const speEdges = tree.getEquilibriumEdges();

            // 按深度分组
            const byDepth = {};
            for (const node of allNodes) {
                const d = tree.getPathTo(node.id).length - 1;
                if (!byDepth[d]) byDepth[d] = [];
                byDepth[d].push(node);
            }

            let html = '<div style="display:flex;align-items:flex-start;gap:8px;min-width:fit-content;padding:10px">';

            const maxDepth = tree.getDepth();
            for (let d = 0; d < maxDepth; d++) {
                html += '<div style="display:flex;flex-direction:column;gap:6px;min-width:100px">';
                const nodes = byDepth[d] || [];
                for (const node of nodes) {
                    const isOnSPE = speEdges.some(e => e.from === node.id || e.to === node.id);
                    const border = isOnSPE ? 'var(--warning)' : 'var(--border)';
                    html += `<div style="padding:6px 8px;border:1px solid ${border};border-radius:6px;
                        background:var(--bg-primary);font-size:0.7rem;text-align:center">
                        <b>${node.label}</b><br>
                        ${node.player ? 'P' + node.player : '终'} |
                        ${node.payoffs ? node.payoffs.join('/') : '?'}
                    </div>`;
                }
                html += '</div>';
                if (d < maxDepth - 1) html += '<div style="font-size:1.2rem;padding-top:20px">→</div>';
            }

            html += '</div>';
            html += '<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px">🟡 高亮 = 逆向归纳均衡路径</p>';
            treeDiv.innerHTML = html;
        };

        render();
    },

    cleanup() {
        if (this._aiTimeout) { clearTimeout(this._aiTimeout); this._aiTimeout = null; }
    }
};
