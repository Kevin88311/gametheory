/**
 * 博弈论核心引擎
 * 提供支付矩阵建模、纳什均衡求解、策略分析等通用功能
 */

class GameEngine {
    /**
     * @param {number[][]} payoffMatrix - 玩家1的支付矩阵 [行][列]
     * @param {number[][]} payoffMatrix2 - 玩家2的支付矩阵 [行][列]（对称博弈可省略）
     * @param {string[]} strategies1 - 玩家1的策略名称
     * @param {string[]} strategies2 - 玩家2的策略名称（对称博弈可省略）
     */
    constructor(payoffMatrix, payoffMatrix2, strategies1, strategies2) {
        this.p1Matrix = payoffMatrix;
        this.p2Matrix = payoffMatrix2 || payoffMatrix;
        this.strategies1 = strategies1;
        this.strategies2 = strategies2 || strategies1;
        this.rows = this.p1Matrix.length;
        this.cols = this.p1Matrix[0].length;
    }

    /** 计算双方收益 */
    calculatePayoff(s1Index, s2Index) {
        return {
            player1: this.p1Matrix[s1Index][s2Index],
            player2: this.p2Matrix[s1Index][s2Index]
        };
    }

    /** 玩家1对玩家2策略的最佳反应 */
    bestResponse(s2Index) {
        let best = -Infinity;
        let bestIndices = [];
        for (let i = 0; i < this.rows; i++) {
            const payoff = this.p1Matrix[i][s2Index];
            if (payoff > best) {
                best = payoff;
                bestIndices = [i];
            } else if (payoff === best) {
                bestIndices.push(i);
            }
        }
        return { indices: bestIndices, payoff: best };
    }

    /** 玩家2对玩家1策略的最佳反应 */
    bestResponseP2(s1Index) {
        let best = -Infinity;
        let bestIndices = [];
        for (let j = 0; j < this.cols; j++) {
            const payoff = this.p2Matrix[s1Index][j];
            if (payoff > best) {
                best = payoff;
                bestIndices = [j];
            } else if (payoff === best) {
                bestIndices.push(j);
            }
        }
        return { indices: bestIndices, payoff: best };
    }

    /** 寻找纯策略纳什均衡 */
    findPureNash() {
        const equilibria = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const br1 = this.bestResponse(j);
                const br2 = this.bestResponseP2(i);
                if (br1.indices.includes(i) && br2.indices.includes(j)) {
                    equilibria.push({
                        row: i,
                        col: j,
                        payoff: this.calculatePayoff(i, j),
                        label: `(${this.strategies1[i]}, ${this.strategies2[j]})`
                    });
                }
            }
        }
        return equilibria;
    }

    /** 寻找混合策略纳什均衡（2x2博弈） */
    findMixedNash() {
        if (this.rows !== 2 || this.cols !== 2) return null;

        const a = this.p1Matrix;
        const b = this.p2Matrix;

        // 玩家1的混合策略概率 p (选策略0), 1-p (选策略1)
        // 使玩家2在两种策略间无差异
        const denom1 = b[0][1] - b[1][1] - b[0][0] + b[1][0];
        let p = denom1 !== 0 ? (b[1][1] - b[1][0]) / denom1 : null;
        if (p !== null) p = Math.max(0, Math.min(1, p));

        // 玩家2的混合策略概率 q (选策略0), 1-q (选策略1)
        const denom2 = a[0][1] - a[1][1] - a[0][0] + a[1][0];
        let q = denom2 !== 0 ? (a[1][1] - a[1][0]) / denom2 : null;
        if (q !== null) q = Math.max(0, Math.min(1, q));

        if (p === null && q === null) return null;

        const p1Exp = p !== null ?
            p * (q * a[0][0] + (1 - q) * a[0][1]) + (1 - p) * (q * a[1][0] + (1 - q) * a[1][1]) :
            null;

        const p2Exp = q !== null ?
            q * (p * b[0][0] + (1 - p) * b[1][0]) + (1 - q) * (p * b[0][1] + (1 - p) * b[1][1]) :
            null;

        return {
            p1Mix: p !== null ? [p, 1 - p] : null,
            p2Mix: q !== null ? [q, 1 - q] : null,
            p1Expected: p1Exp,
            p2Expected: p2Exp,
            description: this.formatMixed(p, q)
        };
    }

    formatMixed(p, q) {
        const parts = [];
        if (p !== null) {
            parts.push(`你: ${(p*100).toFixed(0)}% ${this.strategies1[0]} / ${((1-p)*100).toFixed(0)}% ${this.strategies1[1]}`);
        }
        if (q !== null) {
            parts.push(`对手: ${(q*100).toFixed(0)}% ${this.strategies2[0]} / ${((1-q)*100).toFixed(0)}% ${this.strategies2[1]}`);
        }
        return parts.join(' | ');
    }

    /** 检测结果是否为帕累托最优 */
    isParetoOptimal(row, col) {
        const current = this.calculatePayoff(row, col);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (i === row && j === col) continue;
                const other = this.calculatePayoff(i, j);
                if (other.player1 >= current.player1 && other.player2 >= current.player2 &&
                    (other.player1 > current.player1 || other.player2 > current.player2)) {
                    return false;
                }
            }
        }
        return true;
    }

    /** 找出所有帕累托最优结果 */
    findParetoOptimal() {
        const results = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (this.isParetoOptimal(i, j)) {
                    results.push({ row: i, col: j, payoff: this.calculatePayoff(i, j) });
                }
            }
        }
        return results;
    }
}
