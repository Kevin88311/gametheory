/**
 * 演化博弈模拟 (Evolutionary Dynamics)
 * 复制者动态、演化稳定策略、群体选择可视化
 */
const EvolutionGame = {
    id: 'evolution',
    name: '演化博弈模拟',
    description: `观察<b>种群</b>中不同策略比例的演化。每个策略的增长率取决于其<b>相对适应度</b>。
    <br><br>点击下方单纯形设置初始种群比例，系统模拟<b>复制者动态</b>直至收敛。稳定点 = <b>演化稳定策略(ESS)</b>。
    <br>演化博弈不依赖理性假设——策略通过自然选择和模仿传播。`,

    init(container) {
        // 预设博弈矩阵
        const presets = {
            'prisoner': {
                name: '囚徒困境',
                matrix: [[-1, -5], [0, -3]],
                strategies: ['合作 🤝', '背叛 🗡️']
            },
            'chicken': {
                name: '鹰鸽博弈',
                matrix: [[0, -1], [3, -5]],
                strategies: ['鸽派 🕊️', '鹰派 🦅']
            },
            'stag': {
                name: '猎鹿博弈',
                matrix: [[4, 0], [2, 2]],
                strategies: ['猎鹿 🦌', '猎兔 🐰']
            },
            'coordination': {
                name: '协调博弈',
                matrix: [[3, 0], [0, 2]],
                strategies: ['策略A', '策略B']
            }
        };

        let engine = new EvolutionEngine(presets['prisoner'].matrix, presets['prisoner'].strategies);
        let pop = [0.5, 0.5];
        let trajectory = [];
        let animationId = null;

        container.innerHTML = `
            <div class="game-panel ultimatum-layout" style="max-width:800px">
                <div class="game-info">
                    <h2>🧬 ${this.name}</h2>
                    <div class="game-desc">${this.description}</div>
                    <div class="ai-select" style="margin-bottom:12px">
                        <select id="ev-preset">
                            ${Object.entries(presets).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}
                        </select>
                    </div>
                    <canvas id="ev-canvas" width="500" height="500" style="background:var(--bg-primary);border-radius:12px;border:1px solid var(--border);width:100%;max-width:500px;cursor:pointer"></canvas>
                    <div style="margin-top:12px;display:flex;gap:8px">
                        <button class="btn btn-primary" id="ev-run">▶ 开始模拟</button>
                        <button class="btn btn-secondary" id="ev-reset">↺ 重置</button>
                    </div>
                    <div id="ev-info" style="margin-top:12px;color:var(--text-secondary);font-size:0.85rem"></div>
                    <div id="ev-fixed" style="margin-top:8px;font-size:0.85rem"></div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('ev-canvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;

        const drawSimplex = () => {
            ctx.clearRect(0, 0, w, h);

            // 绘制坐标轴和标签（2D 单纯形 = 线段 x∈[0,1]）
            const margin = 60;
            const lineY = h / 2;
            const x0 = margin, x1 = w - margin;

            // 线段
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x0, lineY);
            ctx.lineTo(x1, lineY);
            ctx.stroke();

            // 两端点
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(x0, lineY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x1, lineY, 8, 0, Math.PI * 2);
            ctx.fill();

            // 标签
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '14px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`100% ${engine.strategies[0]}`, x0, lineY - 20);
            ctx.fillText(`100% ${engine.strategies[1]}`, x1, lineY - 20);

            // 不动点标记
            const fp = engine.findFixedPoints();
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px system-ui';
            for (const pt of fp) {
                const px = x0 + pt.x * (x1 - x0);
                ctx.fillStyle = pt.stable ? '#4ade80' : '#f87171';
                ctx.beginPath();
                ctx.arc(px, lineY, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 10px system-ui';
                ctx.fillText(pt.stable ? 'S' : 'U', px, lineY + 4);
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '11px system-ui';
                ctx.fillText(pt.label, px, lineY + 28);
            }

            // 向量场箭头
            const field = engine.getVectorField(30);
            const dx = (x1 - x0) / 30;
            ctx.strokeStyle = 'rgba(148,163,184,0.4)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 30; i++) {
                const px = x0 + i * dx;
                const vec = field[i][0];
                const arrowLen = vec.dx * (x1 - x0) * 0.8;
                const arrowX = px + Math.max(-dx * 0.8, Math.min(dx * 0.8, arrowLen * 0.5));

                if (Math.abs(arrowLen) > 0.5) {
                    ctx.beginPath();
                    ctx.moveTo(px, lineY);
                    ctx.lineTo(arrowX, lineY);
                    ctx.stroke();

                    // 箭头尖
                    const dir = arrowLen > 0 ? 1 : -1;
                    ctx.fillStyle = 'rgba(148,163,184,0.6)';
                    ctx.beginPath();
                    ctx.moveTo(arrowX, lineY);
                    ctx.lineTo(arrowX - dir * 6, lineY - 4);
                    ctx.lineTo(arrowX - dir * 6, lineY + 4);
                    ctx.fill();
                }
            }

            // 初始种群标记
            const ix = x0 + pop[0] * (x1 - x0);
            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ix, lineY, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 轨迹
            if (trajectory.length > 1) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 3]);
                ctx.beginPath();
                for (let i = 0; i < trajectory.length; i++) {
                    const t = trajectory[i];
                    const tx = x0 + t[0] * (x1 - x0);
                    const ty = lineY + (i % 2 === 0 ? 15 : -15);
                    if (i === 0) ctx.moveTo(tx, ty);
                    else ctx.lineTo(tx, ty);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 当前种群指示
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '13px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${engine.strategies[0]}: ${(pop[0]*100).toFixed(1)}% | ${engine.strategies[1]}: ${(pop[1]*100).toFixed(1)}%`, w/2, h - 10);
        };

        canvas.addEventListener('click', (e) => {
            if (animationId) return; // 运行中不可编辑
            const rect = canvas.getBoundingClientRect();
            const scaleX = w / rect.width;
            const clickX = (e.clientX - rect.left) * scaleX;
            const margin = 60;
            const x0 = margin, x1 = w - margin;

            if (clickX >= x0 && clickX <= x1) {
                pop[0] = (clickX - x0) / (x1 - x0);
                pop[1] = 1 - pop[0];
                trajectory = [pop];
                drawSimplex();
                updateInfo();
            }
        });

        const updateInfo = () => {
            const fits = engine.fitness(pop);
            const avg = engine.avgFitness(pop);
            document.getElementById('ev-info').innerHTML = `
                策略1 适应度: <b style="color:var(--accent)">${fits[0].toFixed(3)}</b> |
                策略2 适应度: <b style="color:var(--danger)">${fits[1].toFixed(3)}</b> |
                平均: ${avg.toFixed(3)}
            `;
            const fps = engine.findFixedPoints();
            document.getElementById('ev-fixed').innerHTML = '不动点: ' + fps.map(f =>
                `<span style="color:${f.stable ? 'var(--success)' : 'var(--danger)'}">${f.label} ${f.stable ? '(稳定)' : '(不稳定)'}</span>`
            ).join(' | ');
        };

        drawSimplex();
        updateInfo();

        document.getElementById('ev-preset').addEventListener('change', (e) => {
            const preset = presets[e.target.value];
            engine = new EvolutionEngine(preset.matrix, preset.strategies);
            pop = [0.5, 0.5];
            trajectory = [];
            if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
            drawSimplex();
            updateInfo();
        });

        document.getElementById('ev-run').addEventListener('click', () => {
            if (animationId) return;
            trajectory = [pop];
            const result = engine.simulate(pop, 0.02, 300, 0.0001);
            let stepIdx = 0;

            const animate = () => {
                if (stepIdx < result.trajectory.length) {
                    pop = result.trajectory[stepIdx];
                    trajectory.push(pop);
                    drawSimplex();
                    updateInfo();
                    stepIdx++;
                    animationId = requestAnimationFrame(animate);
                } else {
                    animationId = null;
                    const final = result.finalPopulation;
                    document.getElementById('ev-info').innerHTML +=
                        `<br>✅ 已收敛: ${engine.strategies[0]} ${(final[0]*100).toFixed(1)}% / ${engine.strategies[1]} ${(final[1]*100).toFixed(1)}%`;
                }
            };
            animationId = requestAnimationFrame(animate);
        });

        document.getElementById('ev-reset').addEventListener('click', () => {
            if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
            pop = [0.5, 0.5];
            trajectory = [];
            drawSimplex();
            updateInfo();
        });
    },

    cleanup() {
        // Canvas 动画会在 DOM 移除时自动停止
    }
};
