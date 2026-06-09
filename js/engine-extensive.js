/**
 * 序贯博弈引擎 — 博弈树、逆向归纳法、子博弈精炼均衡
 */

class GameTreeNode {
    constructor(id, player, label, payoffs = null, children = []) {
        this.id = id;
        this.player = player;      // 1 或 2，null 表示终结点
        this.label = label;        // 节点标签
        this.payoffs = payoffs;    // 终结点: [p1, p2]；非终结点: null
        this.children = children;  // [{edge: '动作名', node: GameTreeNode}]
        this.parent = null;
        this.bestChild = null;     // 逆向归纳选出的最优子节点
    }

    isLeaf() { return this.children.length === 0; }
}

class GameTree {
    constructor(root) {
        this.root = root;
        this._indexParents(this.root, null);
    }

    _indexParents(node, parent) {
        node.parent = parent;
        for (const ch of node.children) {
            this._indexParents(ch.node, node);
        }
    }

    /** 逆向归纳法 — 返回均衡路径上的节点 ID 序列 */
    backwardInduction() {
        this._biRecursive(this.root);
        return this._getEquilibriumPath(this.root);
    }

    _biRecursive(node) {
        if (node.isLeaf()) return node.payoffs;

        // 先计算所有子节点
        for (const ch of node.children) {
            this._biRecursive(ch.node);
        }

        // 当前玩家选择最大化自己收益的子节点
        const playerIdx = node.player - 1;
        let bestChild = node.children[0];
        let bestPayoff = bestChild.node.payoffs[playerIdx];

        for (let i = 1; i < node.children.length; i++) {
            const payoff = node.children[i].node.payoffs[playerIdx];
            if (payoff > bestPayoff) {
                bestPayoff = payoff;
                bestChild = node.children[i];
            }
        }

        node.bestChild = bestChild;
        node.payoffs = bestChild.node.payoffs;
        return node.payoffs;
    }

    _getEquilibriumPath(node) {
        const path = [node.id];
        if (!node.isLeaf() && node.bestChild) {
            path.push(...this._getEquilibriumPath(node.bestChild.node));
        }
        return path;
    }

    /** 获取均衡路径上的边标签 */
    getEquilibriumEdges() {
        const edges = [];
        let node = this.root;
        while (!node.isLeaf() && node.bestChild) {
            edges.push({
                from: node.id,
        to: node.bestChild.node.id,
                edge: node.bestChild.edge,
                player: node.player
            });
            node = node.bestChild.node;
        }
        return edges;
    }

    /** 获取从根到某节点的路径 */
    getPathTo(nodeId) {
        return this._findPath(this.root, nodeId, []);
    }

    _findPath(node, targetId, path) {
        path.push(node);
        if (node.id === targetId) return path;
        for (const ch of node.children) {
            const result = this._findPath(ch.node, targetId, [...path]);
            if (result) return result;
        }
        return null;
    }

    /** 获取所有节点（BFS） */
    getAllNodes() {
        const nodes = [];
        const queue = [this.root];
        while (queue.length > 0) {
            const node = queue.shift();
            nodes.push(node);
            for (const ch of node.children) {
                queue.push(ch.node);
            }
        }
        return nodes;
    }

    /** 获取树的最大深度 */
    getDepth() {
        return this._maxDepth(this.root);
    }

    _maxDepth(node) {
        if (node.isLeaf()) return 1;
        return 1 + Math.max(...node.children.map(ch => this._maxDepth(ch.node)));
    }
}

/** 蜈蚣博弈特定 — 生成指定轮数的蜈蚣博弈树 */
function createCentipedeTree(rounds) {
    const root = new GameTreeNode('n0', 1, '开始');
    let currentNodes = [root];
    let nodeId = 1;

    for (let r = 0; r < rounds; r++) {
        const nextNodes = [];
        for (const node of currentNodes) {
            if (node.isLeaf()) continue;
            const player = node.player;

            // "终止"子节点 — 当前玩家拿走较大份额
            const baseAmount = (r + 1) * 2;
            const termPayoffs = player === 1 ?
                [baseAmount + 1, baseAmount - 1] :
                [baseAmount - 1, baseAmount + 1];

            const termNode = new GameTreeNode(`n${nodeId}`, null, '终止', termPayoffs, []);
            nodeId++;

            // "继续"子节点 — 切换玩家
            const contNode = new GameTreeNode(`n${nodeId}`, player === 1 ? 2 : 1, '继续', null, []);
            nodeId++;
            nextNodes.push(contNode);

            node.children = [
                { edge: '终止 ✋', node: termNode },
                { edge: '继续 ➡️', node: contNode }
            ];
        }
        currentNodes = nextNodes;
    }

    // 最后节点：双方选择"继续"时的终局收益
    const finalPayoff = rounds * 2 + 2;
    for (const node of currentNodes) {
        if (!node.isLeaf()) {
            node.payoffs = [finalPayoff, finalPayoff];
            node.player = null;
            node.label = '终局';
            node.children = [];
        }
    }

    return new GameTree(root);
}
