/**
 * 蜈蚣博弈 (Centipede Game)
 * 序贯博弈：两人轮流选择继续或终止，逆向归纳法预测第一轮终止
 */
const CentipedeGame = {
    id: 'centipede',
    name: '蜈蚣博弈',
    description: `两人轮流决策。每轮当前玩家可<b>继续</b>（切换玩家，总奖金增长）或<b>终止</b>（终止者拿更多）。
    <br><br>逆向归纳法预测<b>第一轮就终止</b>，但真实实验中人们会合作多轮。这揭示了<b>逆向归纳悖论</b>——理论最优与人类行为的鸿沟。`,

    init(container) {
        const rounds = 5;
        const tree = createCentipedeTree(rounds);
        const spePath = tree.backwardInduction();
        const speEdges = tree.getEquilibriumEdges();

        let currentPath = ['n0']; // 当前用户路径
        let gameOver = false;

        container.innerHTML = `
            <div class="game-panel ultimatum-layout" style="max-width:900px">
                <div class="game-info" style="grid-column:1/-1">
                    <h2>🌳 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div style="display:flex;gap:12px;margin-bottom:16px">
                        <button class="btn btn-primary" id="cg-restart">🔄 重新开始</button>
                        <button class="btn btn-secondary" id="cg-show-spe">🔍 显示均衡路径</button>
                    </div>
                    <div id="cg-tree"></div>
                    <div id="cg-result"></div>
                </div>
            </div>
        `;

        const allNodes = tree.getAllNodes();
        const depth = tree.getDepth();

        const renderTree = (highlightPath = null, equilibriumEdges = null) => {
            const treeDiv = document.getElementById('cg-tree');
            let html = '<div style="overflow-x:auto;padding:20px 0">';
            html += '<div style="display:flex;align-items:flex-start;gap:4px;min-width:fit-content">';

            // BFS 按层生成
            const nodesByLevel = {};
            for (const node of allNodes) {
                const path = tree.getPathTo(node.id);
                const level = path.length - 1;
                if (!nodesByLevel[level]) nodesByLevel[level] = [];
                nodesByLevel[level].push({ node, path });
            }

            for (let level = 0; level < depth; level++) {
                html += '<div style="display:flex;flex-direction:column;gap:12px;min-width:120px">';
                const levelNodes = nodesByLevel[level] || [];

                for (const { node, path } of levelNodes) {
                    const isOnPath = highlightPath && highlightPath.includes(node.id);
                    const isEquil = equilibriumEdges && equilibriumEdges.some(e => e.from === node.id);
                    const borderColor = isEquil ? 'var(--warning)' :
                                       isOnPath ? 'var(--accent)' : 'var(--border)';
                    const bg = isOnPath ? 'rgba(56,189,248,0.1)' : 'var(--bg-primary)';
                    const opacity = highlightPath && !isOnPath ? '0.5' : '1';

                    html += `<div style="padding:10px 14px;border:2px solid ${borderColor};
                        border-radius:8px;background:${bg};opacity:${opacity};text-align:center;font-size:0.85rem">`;
                    html += `<strong>${node.label || '节点'}</strong><br>`;
                    html += `<span style="color:var(--text-secondary)">${node.player ? `玩家${node.player}` : '终局'}</span>`;
                    if (node.payoffs) {
                        html += `<br><span style="color:var(--accent)">你:${node.payoffs[0]}</span> `;
                        html += `<span style="color:var(--danger)">对手:${node.payoffs[1]}</span>`;
                    }
                    html += '</div>';

                    // 如果不是最后一层，显示按钮
                    if (!node.isLeaf() && isOnPath && !gameOver) {
                        html += '<div style="display:flex;gap:4px;margin-top:2px">';
                        for (const ch of node.children) {
                            const isTerm = ch.node.isLeaf();
                            html += `<button class="strategy-btn ${isTerm ? 'defect' : 'cooperate'}"
                                style="font-size:0.75rem;padding:4px 8px"
                                data-node="${node.id}" data-target="${ch.node.id}">${ch.edge}</button>`;
                        }
                        html += '</div>';
                    }
                }
                html += '</div>';

                // 层级间的箭头
                if (level < depth - 1) {
                    html += '<div style="display:flex;align-items:center;color:var(--text-secondary);font-size:2rem;padding:0 8px">→</div>';
                }
            }

            html += '</div></div>';
            treeDiv.innerHTML = html;

            // 绑定按钮事件
            if (!gameOver) {
                treeDiv.querySelectorAll('.strategy-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const targetId = this.dataset.target;
                        const targetNode = allNodes.find(n => n.id === targetId);
                        currentPath.push(targetId);

                        if (targetNode.isLeaf()) {
                            gameOver = true;
                            document.getElementById('cg-result').innerHTML = `
                                <div class="result-panel">
                                    <p style="font-size:1.2rem">博弈结束</p>
                                    <div class="payoff-display">
                                        <div><span class="payoff-value you">${targetNode.payoffs[0]}</span><br>你的收益</div>
                                        <div><span class="payoff-value them">${targetNode.payoffs[1]}</span><br>对手收益</div>
                                    </div>
                                    <p style="color:var(--text-secondary);margin-top:8px">
                                        逆向归纳预测第一轮终止，你的实际选择持续了 <b>${currentPath.length - 1}</b> 轮
                                    </p>
                                </div>`;
                        }

                        renderTree(currentPath, speEdges);
                    });
                });
            }
        };

        renderTree(currentPath, speEdges);

        document.getElementById('cg-restart').addEventListener('click', () => {
            currentPath = ['n0'];
            gameOver = false;
            document.getElementById('cg-result').innerHTML = '';
            renderTree(currentPath, speEdges);
        });

        document.getElementById('cg-show-spe').addEventListener('click', () => {
            const btn = document.getElementById('cg-show-spe');
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                renderTree(currentPath);
            } else {
                btn.classList.add('active');
                renderTree(currentPath, speEdges);
            }
        });
    },

    cleanup() {}
};
