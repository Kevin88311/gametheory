/**
 * 演化博弈模拟 (Evolutionary Dynamics)
 * 2-3策略复制者动态，三角单纯形可视化，自定义支付矩阵
 */
const EvolutionGame = {
    id: 'evolution',
    name: '演化博弈模拟',
    description: `设定支付矩阵和初始种群比例，观察<b>复制者动态</b>如何驱动种群演化。
    <br>策略的增长率 = 其适应度 − 平均适应度。稳定点即为<b>演化稳定策略(ESS)</b>。
    <br>支持 2-3 策略博弈。点击单纯形设置初始种群，拖动矩阵滑块调整收益。`,

    init(container) {
        // 默认3策略矩阵 (扩展RPS-like结构)
        let n = 3;
        let matrix = [
            [0, -1, 2],
            [2, 0, -1],
            [-1, 2, 0]
        ];
        let strategies = ['策略A', '策略B', '策略C'];
        let pop = [0.33, 0.33, 0.34];
        let trajectory = [];
        let animationId = null;
        let engine = new EvolutionEngine(matrix, strategies);

        const render = () => {
            container.innerHTML = `
                <div class="game-panel ultimatum-layout" style="max-width:850px">
                    <div class="game-info">
                        <h2>🧬 ${this.name}</h2>
                        <div class="game-desc">${this.description}</div>

                        <!-- 策略数量选择 -->
                        <div style="display:flex;gap:8px;margin:12px 0;align-items:center">
                            <span style="color:var(--text-secondary);font-size:0.9rem">策略数:</span>
                            <button class="nav-btn ${n===2?'active':''}" id="ev-n2">2</button>
                            <button class="nav-btn ${n===3?'active':''}" id="ev-n3">3</button>
                            <span style="color:var(--text-secondary);font-size:0.8rem;margin-left:8px">| 点击单纯形设置初始种群</span>
                        </div>

                        <!-- 矩阵编辑器 -->
                        <div style="margin:12px 0">
                            <span style="color:var(--text-secondary);font-size:0.85rem;font-weight:600">支付矩阵 (行=己方策略, 列=对方策略)</span>
                            <div id="ev-matrix-editor" style="margin-top:6px"></div>
                        </div>

                        <!-- Canvas -->
                        <canvas id="ev-canvas" width="500" height="${n===2?200:500}"
                            style="background:var(--bg-primary);border-radius:12px;border:1px solid var(--border);width:100%;max-width:500px;cursor:pointer"></canvas>

                        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                            <button class="btn btn-primary" id="ev-run">▶ 开始模拟</button>
                            <button class="btn btn-secondary" id="ev-reset">↺ 重置</button>
                            <button class="btn btn-secondary" id="ev-clear">🗑️ 清除轨迹</button>
                        </div>
                        <div id="ev-info" style="margin-top:12px;color:var(--text-secondary);font-size:0.85rem"></div>
                        <div id="ev-legend" style="margin-top:8px;font-size:0.85rem"></div>
                    </div>
                </div>
            `;

            buildMatrixEditor();
            drawCanvas();

            if (n === 2) {
                document.getElementById('ev-n2').addEventListener('click', () => switchToN(2));
                document.getElementById('ev-n3').addEventListener('click', () => switchToN(3));
            }

            document.getElementById('ev-run').addEventListener('click', runSimulation);
            document.getElementById('ev-reset').addEventListener('click', resetSimulation);
            document.getElementById('ev-clear').addEventListener('click', () => { trajectory = []; drawCanvas(); });
        };

        const switchToN = (newN) => {
            if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
            if (newN === n) return;
            n = newN;
            if (n === 2) {
                matrix = matrix.slice(0, 2).map(r => r.slice(0, 2));
                strategies = strategies.slice(0, 2);
                pop = [0.5, 0.5];
            } else {
                const oldN = matrix.length;
                if (oldN === 2) {
                    matrix = [
                        [matrix[0][0], matrix[0][1], 0],
                        [matrix[1][0], matrix[1][1], 0],
                        [0, 0, 0]
                    ];
                    strategies = ['策略A', '策略B', '策略C'];
                }
                pop = [0.33, 0.33, 0.34];
            }
            trajectory = [];
            engine = new EvolutionEngine(matrix, strategies);
            render();
        };

        const buildMatrixEditor = () => {
            const div = document.getElementById('ev-matrix-editor');
            let html = '<table style="border-collapse:collapse">';
            html += '<tr><th></th>';
            for (let j = 0; j < n; j++) html += `<th style="padding:2px 8px;color:var(--text-secondary);font-size:0.8rem">${strategies[j]}</th>`;
            html += '</tr>';
            for (let i = 0; i < n; i++) {
                html += `<tr><td style="color:var(--text-secondary);font-size:0.8rem;padding-right:8px">${strategies[i]}</td>`;
                for (let j = 0; j < n; j++) {
                    html += `<td><input type="number" class="ev-cell" data-i="${i}" data-j="${j}"
                        value="${matrix[i][j]}" style="width:55px;padding:4px 6px;border:1px solid var(--border);
                        border-radius:4px;background:var(--bg-primary);color:var(--text-primary);text-align:center;
                        font-size:0.85rem"></td>`;
                }
                html += '</tr>';
            }
            html += '</table>';
            div.innerHTML = html;

            document.querySelectorAll('.ev-cell').forEach(input => {
                input.addEventListener('change', function() {
                    const i = parseInt(this.dataset.i);
                    const j = parseInt(this.dataset.j);
                    matrix[i][j] = parseFloat(this.value) || 0;
                    engine = new EvolutionEngine(matrix, strategies);
                    trajectory = [];
                    drawCanvas();
                    updateInfo();
                });
            });
        };

        const drawCanvas = () => {
            const canvas = document.getElementById('ev-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            if (n === 2) drawSimplex2D(ctx, w, h);
            else drawSimplex3D(ctx, w, h);
        };

        const drawSimplex2D = (ctx, w, h) => {
            const m = 50;
            const lineY = h / 2;
            const x0 = m, x1 = w - m;

            // 线段
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x0, lineY);
            ctx.lineTo(x1, lineY);
            ctx.stroke();

            // 端点
            [x0, x1].forEach((x, i) => {
                ctx.fillStyle = i === 0 ? '#38bdf8' : '#f87171';
                ctx.beginPath();
                ctx.arc(x, lineY, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '13px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(`100% ${strategies[i]}`, x, lineY - 18);
            });

            // 向量场
            const field = engine.getVectorField(40);
            const dx = (x1 - x0) / 40;
            for (let i = 1; i < 40; i++) {
                const px = x0 + i * dx;
                const vec = field[i][0];
                const arrowLen = Math.max(-dx * 0.7, Math.min(dx * 0.7, vec.dx * (x1 - x0) * 0.6));

                if (Math.abs(arrowLen) > 0.3) {
                    ctx.strokeStyle = 'rgba(148,163,184,0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(px, lineY);
                    ctx.lineTo(px + arrowLen, lineY);
                    ctx.stroke();
                    const dir = arrowLen > 0 ? 1 : -1;
                    ctx.fillStyle = 'rgba(148,163,184,0.4)';
                    ctx.beginPath();
                    ctx.moveTo(px + arrowLen, lineY);
                    ctx.lineTo(px + arrowLen - dir * 5, lineY - 3);
                    ctx.lineTo(px + arrowLen - dir * 5, lineY + 3);
                    ctx.fill();
                }
            }

            // 不动点
            const fps = engine.findFixedPoints();
            for (const pt of fps) {
                const px = x0 + pt.x * (x1 - x0);
                ctx.fillStyle = pt.stable ? '#4ade80' : '#f87171';
                ctx.beginPath();
                ctx.arc(px, lineY, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 9px system-ui';
                ctx.fillText(pt.stable ? 'S' : 'U', px, lineY + 4);
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '11px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(pt.label, px, lineY + 28);
            }

            // 轨迹
            if (trajectory.length > 1) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                const tx = x0 + trajectory[0][0] * (x1 - x0);
                ctx.moveTo(tx, lineY);
                for (let i = 1; i < trajectory.length; i++) {
                    const tx = x0 + trajectory[i][0] * (x1 - x0);
                    ctx.lineTo(tx, lineY);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 当前种群标记
            const px = x0 + pop[0] * (x1 - x0);
            ctx.fillStyle = '#fbbf24';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, lineY, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 底部信息
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${strategies[0]}: ${(pop[0]*100).toFixed(0)}% | ${strategies[1]}: ${(pop[1]*100).toFixed(0)}%`, w / 2, h - 8);
        };

        const drawSimplex3D = (ctx, w, h) => {
            const m = 60;
            // 三角形顶点
            const top = { x: w / 2, y: m };
            const left = { x: m, y: h - m };
            const right = { x: w - m, y: h - m };

            // 三角形
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(top.x, top.y);
            ctx.lineTo(right.x, right.y);
            ctx.lineTo(left.x, left.y);
            ctx.closePath();
            ctx.stroke();

            // 填充背景
            ctx.fillStyle = 'rgba(30,41,59,0.5)';
            ctx.fill();

            // 顶点标签
            const verts = [top, left, right];
            verts.forEach((v, i) => {
                ctx.fillStyle = ['#38bdf8', '#f87171', '#4ade80'][i];
                ctx.beginPath();
                ctx.arc(v.x, v.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '12px system-ui';
                ctx.textAlign = 'center';
                const labelY = i === 0 ? v.y - 18 : v.y + 20;
                ctx.fillText(strategies[i], v.x, labelY);
            });

            // 向量场
            const gridSize = 25;
            const field = engine.getVectorField(gridSize);
            for (let i = 1; i < gridSize; i++) {
                for (let j = 1; j < gridSize; j++) {
                    const bx = i / gridSize;
                    const by = j / gridSize;
                    const bz = 1 - bx - by;
                    if (bz < 0.01 || bz > 0.99) continue;

                    const px = bx * top.x + by * left.x + bz * right.x;
                    const py = bx * top.y + by * left.y + bz * right.y;
                    const vec = field[i][j];

                    // 投影到三角形平面
                    const vx = vec.dx * top.x + vec.dy * left.x + (vec.dx + vec.dy) * right.x * 0;
                    const vy = vec.dx * top.y + vec.dy * left.y;

                    const arrowScale = 150;
                    const ex = px + vec.dx * arrowScale;
                    const ey = py + vec.dy * arrowScale;

                    if (Math.abs(vec.dx) + Math.abs(vec.dy) > 0.0003) {
                        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(ex, ey);
                        ctx.stroke();
                    }
                }
            }

            // 轨迹
            if (trajectory.length > 1) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                for (const t of trajectory) {
                    const px = t[0] * top.x + t[1] * left.x + t[2] * right.x;
                    const py = t[0] * top.y + t[1] * left.y + t[2] * right.y;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 当前种群
            const cx = pop[0] * top.x + pop[1] * left.x + pop[2] * right.x;
            const cy = pop[0] * top.y + pop[1] * left.y + pop[2] * right.y;
            ctx.fillStyle = '#fbbf24';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 底部图例
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '11px system-ui';
            ctx.textAlign = 'center';
            const pct = pop.map((x, i) => `${strategies[i]}: ${(x*100).toFixed(0)}%`).join(' | ');
            ctx.fillText(pct, w / 2, h - 5);
        };

        // Canvas 点击设置初始种群
        this._canvasHandler = function handler(e) {
            const canvas = document.getElementById('ev-canvas');
            if (!canvas || e.target.closest('canvas') !== canvas) return;
            if (animationId) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;

            if (n === 2) {
                const m = 50;
                const lineY = canvas.height / 2;
                const x0 = m, x1 = canvas.width - m;
                if (cx >= x0 && cx <= x1 && Math.abs(cy - lineY) < 50) {
                    pop[0] = (cx - x0) / (x1 - x0);
                    pop[1] = 1 - pop[0];
                    trajectory = [pop];
                    drawCanvas();
                    updateInfo();
                }
            } else {
                const top = { x: canvas.width / 2, y: 60 };
                const left = { x: 60, y: canvas.height - 60 };
                const right = { x: canvas.width - 60, y: canvas.height - 60 };

                // 重心坐标
                const denom = (left.y - right.y) * (top.x - right.x) + (right.x - left.x) * (top.y - right.y);
                const a = ((left.y - right.y) * (cx - right.x) + (right.x - left.x) * (cy - right.y)) / denom;
                const b = ((right.y - top.y) * (cx - right.x) + (top.x - right.x) * (cy - right.y)) / denom;
                const c = 1 - a - b;

                if (a >= -0.05 && b >= -0.05 && c >= -0.05 && a <= 1.05 && b <= 1.05 && c <= 1.05) {
                    pop = [Math.max(0, a), Math.max(0, b), Math.max(0, c)];
                    const sum = pop.reduce((s, x) => s + x, 0);
                    pop = pop.map(x => x / sum);
                    trajectory = [pop];
                    drawCanvas();
                    updateInfo();
                }
            }
        };
        document.addEventListener('click', this._canvasHandler);

        const updateInfo = () => {
            const fits = engine.fitness(pop);
            const avg = engine.avgFitness(pop);
            document.getElementById('ev-info').innerHTML = `
                适应度: ${strategies.map((s,i) => `<b style="color:${['var(--accent)','var(--danger)','var(--success)'][i]}">${s}=${fits[i].toFixed(3)}</b>`).join(' | ')} |
                平均: ${avg.toFixed(3)}
            `;

            if (n === 2) {
                const fps = engine.findFixedPoints();
                document.getElementById('ev-legend').innerHTML = '不动点: ' + fps.map(f =>
                    `<span style="color:${f.stable?'var(--success)':'var(--danger)'}">${f.label} ${f.stable?'(稳定/ESS)':'(不稳定)'}</span>`
                ).join(' | ');
            } else {
                document.getElementById('ev-legend').innerHTML = '<span style="color:var(--text-secondary)">🟡 黄色轨迹 = 演化路径 | 绿色点 = 稳定不动点</span>';
            }
        };

        const runSimulation = () => {
            if (animationId) return;
            trajectory = [pop.slice()];
            const result = engine.simulate(pop, 0.015, 400, 0.0001);
            let stepIdx = 0;

            const animate = () => {
                if (stepIdx < result.trajectory.length) {
                    pop = result.trajectory[stepIdx].slice();
                    // 归一化
                    const sum = pop.reduce((a, b) => a + b, 0);
                    pop = pop.map(x => x / sum);
                    trajectory.push(pop.slice());
                    drawCanvas();
                    updateInfo();
                    stepIdx++;
                    animationId = requestAnimationFrame(animate);
                } else {
                    animationId = null;
                    document.getElementById('ev-info').innerHTML +=
                        `<br>✅ 已收敛 (${stepIdx} 步)`;
                }
            };
            animationId = requestAnimationFrame(animate);
        };

        const resetSimulation = () => {
            if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
            pop = n === 2 ? [0.5, 0.5] : [0.33, 0.33, 0.34];
            trajectory = [];
            drawCanvas();
            updateInfo();
        };

        render();
    },

    cleanup() {
        if (this._canvasHandler) {
            document.removeEventListener('click', this._canvasHandler);
            this._canvasHandler = null;
        }
    }
};
