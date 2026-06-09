/**
 * UI 工具函数
 * 支付矩阵渲染、动画、通用组件
 */

const UI = {
    /** 渲染支付矩阵表格 */
    renderMatrix(engine, nashEquilibria, container) {
        const { strategies1, strategies2, p1Matrix, p2Matrix } = engine;
        let html = '<table class="payoff-matrix"><thead><tr><th></th>';

        for (const s of strategies2) {
            html += `<th>对手: ${s}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (let i = 0; i < strategies1.length; i++) {
            html += `<tr><th>你: ${strategies1[i]}</th>`;
            for (let j = 0; j < strategies2.length; j++) {
                const isNash = nashEquilibria.some(eq => eq.row === i && eq.col === j);
                const cls = isNash ? 'nash' : '';
                html += `<td class="${cls}">(${p1Matrix[i][j]}, ${p2Matrix[i][j]})</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table>';

        // 纳什均衡标记
        if (nashEquilibria.length > 0) {
            html += '<p style="margin-top:10px;color:var(--warning);font-size:0.85rem">';
            html += '🟡 高亮 = 纳什均衡: ';
            html += nashEquilibria.map(e => e.label).join(', ');
            html += '</p>';
        }

        container.innerHTML = html;
    },

    /** 渲染混合策略纳什均衡 */
    renderMixedNash(mixed, container) {
        if (!mixed || (!mixed.p1Mix && !mixed.p2Mix)) {
            container.innerHTML = '<p style="color:var(--text-secondary)">此博弈无混合策略纳什均衡。</p>';
            return;
        }
        let html = '<div style="margin-top:12px;padding:12px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border)">';
        html += '<strong style="color:var(--accent)">🎲 混合策略纳什均衡</strong><br>';
        html += `<span style="color:var(--text-secondary);font-size:0.9rem">${mixed.description}</span>`;
        html += '</div>';
        container.innerHTML = html;
    },

    /** 显示单轮结果 */
    showResult(result, container) {
        container.innerHTML = `
            <div class="result-panel">
                <div class="choices">
                    <div>
                        <span style="color:var(--text-secondary)">你的选择</span><br>
                        <span class="choice-badge you">${result.yourStrategy}</span>
                    </div>
                    <div style="font-size:2rem;color:var(--text-secondary)">VS</div>
                    <div>
                        <span style="color:var(--text-secondary)">对手选择</span><br>
                        <span class="choice-badge them">${result.theirStrategy}</span>
                    </div>
                </div>
                <div class="payoff-display">
                    <div>
                        <span style="color:var(--text-secondary)">你的收益</span><br>
                        <span class="payoff-value you">${result.yourPayoff}</span>
                    </div>
                    <div>
                        <span style="color:var(--text-secondary)">对手收益</span><br>
                        <span class="payoff-value them">${result.theirPayoff}</span>
                    </div>
                </div>
                ${result.isNash ? '<p style="margin-top:8px;color:var(--warning)">🟡 这是一个纳什均衡结果</p>' : ''}
                ${result.isPareto ? '<p style="margin-top:4px;color:var(--success)">✅ 这是一个帕累托最优结果</p>' : ''}
            </div>
        `;
    },

    /** 更新多轮得分 */
    updateScoreboard(yourTotal, theirTotal, container) {
        container.innerHTML = `
            <div class="scoreboard">
                <div class="score-item">
                    <div class="score-label">你的总分</div>
                    <div class="score-value" style="color:var(--accent)">${yourTotal}</div>
                </div>
                <div class="score-item">
                    <div class="score-label">对手总分</div>
                    <div class="score-value" style="color:var(--danger)">${theirTotal}</div>
                </div>
                <div class="score-item">
                    <div class="score-label">轮次</div>
                    <div class="score-value" style="color:var(--text-secondary)">${window.gameRound || 0}</div>
                </div>
            </div>
        `;
    },

    /** 渲染历史记录 */
    renderHistory(history, container) {
        if (history.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center">暂无记录</p>';
            return;
        }
        let html = '<div style="max-height:200px;overflow-y:auto">';
        html += '<table style="width:100%;font-size:0.85rem;border-collapse:collapse">';
        html += '<tr style="color:var(--text-secondary)"><th>轮次</th><th>你</th><th>对手</th><th>你的收益</th><th>对手收益</th></tr>';
        for (let i = history.length - 1; i >= 0; i--) {
            const h = history[i];
            html += `<tr style="border-top:1px solid var(--border);text-align:center">
                <td>${h.round}</td>
                <td>${h.yourStrategy}</td>
                <td>${h.theirStrategy}</td>
                <td style="color:var(--accent)">${h.yourPayoff}</td>
                <td style="color:var(--danger)">${h.theirPayoff}</td>
            </tr>`;
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
};
