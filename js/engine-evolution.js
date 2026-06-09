/**
 * 演化博弈引擎 — 复制者动态、演化稳定策略(ESS)、向量场
 */

class EvolutionEngine {
    /**
     * @param {number[][]} payoffMatrix - n×n 支付矩阵（对称博弈）
     * @param {string[]} strategies - 策略名称
     */
    constructor(payoffMatrix, strategies) {
        this.matrix = payoffMatrix;
        this.strategies = strategies;
        this.n = payoffMatrix.length;
    }

    /** 计算给定种群状态下各策略的适应度 */
    fitness(population) {
        const fits = new Array(this.n).fill(0);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                fits[i] += this.matrix[i][j] * population[j];
            }
        }
        return fits;
    }

    /** 平均适应度 */
    avgFitness(population) {
        const fits = this.fitness(population);
        let avg = 0;
        for (let i = 0; i < this.n; i++) {
            avg += fits[i] * population[i];
        }
        return avg;
    }

    /** 复制者方程: dx_i/dt = x_i * (f_i(x) - avg_f(x)) */
    replicatorDerivative(population) {
        const fits = this.fitness(population);
        const avg = this.avgFitness(population);
        return population.map((x, i) => x * (fits[i] - avg));
    }

    /** 一步复制者动态（欧拉法） */
    replicatorStep(population, dt = 0.01) {
        const deriv = this.replicatorDerivative(population);
        let newPop = population.map((x, i) => x + deriv[i] * dt);
        // 归一化（防止浮点误差）
        const sum = newPop.reduce((a, b) => a + b, 0);
        newPop = newPop.map(x => Math.max(0, Math.min(1, x / sum)));
        // 再次归一化
        const sum2 = newPop.reduce((a, b) => a + b, 0);
        return newPop.map(x => x / sum2);
    }

    /** 模拟直到收敛 */
    simulate(initialPop, dt = 0.01, maxSteps = 5000, tolerance = 1e-6) {
        let pop = [...initialPop];
        const trajectory = [pop];
        const steps = [];

        for (let s = 0; s < maxSteps; s++) {
            const newPop = this.replicatorStep(pop, dt);
            const diff = newPop.reduce((sum, x, i) => sum + Math.abs(x - pop[i]), 0);

            steps.push({ step: s, population: newPop, diff });
            trajectory.push(newPop);
            pop = newPop;

            if (diff < tolerance) break;
        }

        return { finalPopulation: pop, trajectory, steps, converged: steps[steps.length - 1].diff < tolerance };
    }

    /** 检测演化稳定策略 (ESS) — 2策略情况 */
    isESS(strategyIndex) {
        if (this.n !== 2) return null; // 目前仅支持2策略

        const s = strategyIndex;
        const t = 1 - s;

        // 条件1: (s,s) 必须是纳什均衡
        const sPayoff = this.matrix[s][s];
        const tPayoff = this.matrix[t][s];
        if (tPayoff > sPayoff) return false;

        // 条件2: 如果 tPayoff == sPayoff, 则需要 (s,t) > (t,t)
        if (Math.abs(tPayoff - sPayoff) < 1e-9) {
            return this.matrix[s][t] > this.matrix[t][t];
        }

        return true; // 条件1严格满足
    }

    /** 生成向量场数据（用于可视化） */
    getVectorField(gridSize = 20) {
        const field = [];
        for (let i = 0; i <= gridSize; i++) {
            const row = [];
            for (let j = 0; j <= gridSize; j++) {
                const x = i / gridSize;
                const y = j / gridSize;
                // 对于2策略，种群状态为 [x, 1-x]，其余策略为0
                if (this.n === 2) {
                    const deriv = this.replicatorDerivative([x, 1 - x]);
                    row.push({ dx: deriv[0], dy: -deriv[0] });
                } else if (this.n === 3) {
                    // 3策略在单纯形上 (x, y, 1-x-y)
                    const z = 1 - x - y;
                    if (z < -0.01 || z > 1.01) {
                        row.push({ dx: 0, dy: 0 });
                        continue;
                    }
                    const pop = [Math.max(0, x), Math.max(0, y), Math.max(0, z)];
                    const sum = pop.reduce((a, b) => a + b, 0);
                    const deriv = this.replicatorDerivative(pop.map(p => p / sum));
                    row.push({ dx: deriv[0], dy: deriv[1] });
                }
            }
            field.push(row);
        }
        return field;
    }

    /** 查找所有不动点（2策略情况） */
    findFixedPoints() {
        if (this.n !== 2) return [];

        const points = [];
        // x=0 和 x=1 总是不动点
        const checkEndpoint = (x) => {
            const pop = [x, 1 - x];
            const deriv = this.replicatorDerivative(pop);
            return Math.abs(deriv[0]) < 1e-6;
        };

        if (checkEndpoint(0)) points.push({ x: 0, label: `全${this.strategies[1]}`, stable: this.isESS(1) });
        if (checkEndpoint(1)) points.push({ x: 1, label: `全${this.strategies[0]}`, stable: this.isESS(0) });

        // 内部不动点: x = (b-d)/(b+d-a-c) where matrix = [[a,b],[c,d]]
        const [[a, b], [c, d]] = this.matrix;
        const denom = b + c - a - d;
        if (Math.abs(denom) > 1e-9) {
            const xStar = (b - d) / denom;
            if (xStar > 0.001 && xStar < 0.999) {
                // 判断稳定性：导数符号
                const deriv = this.replicatorDerivative([xStar + 0.001, 1 - xStar - 0.001]);
                const stable = deriv[0] < 0; // x*上方导数为负 = 稳定
                points.push({ x: xStar, label: `混合 ${(xStar*100).toFixed(0)}%`, stable });
            }
        }

        return points;
    }
}
