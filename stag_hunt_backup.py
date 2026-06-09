#!/usr/bin/env python3
"""
猎鹿博弈 (Stag Hunt) — 交互式博弈游戏
======================================

收益矩阵:
            对手猎鹿    对手猎兔
你猎鹿      (4, 4)     (0, 2)
你猎兔      (2, 0)     (2, 2)

玩法:
  - 人机对战: 你选一种AI策略与之对弈
  - 双人对战: 本地两人轮流输入
  - 锦标赛:  多种AI策略两两对决，积分排名
"""

import random
import math
import os
import sys
from typing import NamedTuple, Callable
from collections import defaultdict


# ── 数据结构 ────────────────────────────────────────────

class Move:
    STAG = "🦌"
    HARE = "🐇"

    @classmethod
    def all(cls):
        return [cls.STAG, cls.HARE]


# 收益矩阵: payoff[my_move][opponent_move]
PAYOFF = {
    Move.STAG: {Move.STAG: 4, Move.HARE: 0},
    Move.HARE: {Move.STAG: 2, Move.HARE: 2},
}


def payoff(my: str, opp: str) -> int:
    return PAYOFF[my][opp]


class RoundResult(NamedTuple):
    round_num: int
    p1_move: str
    p2_move: str
    p1_score: int
    p2_score: int


# ── 终端美化 ────────────────────────────────────────────

class Color:
    GREEN  = "\033[92m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"

    @staticmethod
    def supports_color() -> bool:
        return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


def color(text: str, color_code: str) -> str:
    if Color.supports_color():
        return f"{color_code}{text}{Color.RESET}"
    return text


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


# ── AI 策略 ─────────────────────────────────────────────

class Strategy:
    """策略基类，每个策略有名字、描述，并维护自己的内部状态"""

    def __init__(self):
        self.my_history: list[str] = []
        self.opp_history: list[str] = []

    def name(self) -> str:
        raise NotImplementedError

    def description(self) -> str:
        raise NotImplementedError

    def choose(self) -> str:
        raise NotImplementedError

    def observe(self, my_move: str, opp_move: str):
        """每轮结束后调用，记录对手行为"""
        self.my_history.append(my_move)
        self.opp_history.append(opp_move)

    def reset(self):
        self.my_history.clear()
        self.opp_history.clear()


class AlwaysStag(Strategy):
    def name(self): return "AlwaysStag (永远猎鹿)"
    def description(self): return "无条件猎鹿，追求最大共赢。信任所有人，哪怕被反复背叛。"
    def choose(self): return Move.STAG


class AlwaysHare(Strategy):
    def name(self): return "AlwaysHare (永远猎兔)"
    def description(self): return "无条件猎兔，确保底线收益。宁可不赚大钱也不冒险。"
    def choose(self): return Move.HARE


class RandomStrategy(Strategy):
    def name(self): return "Random (随机)"
    def description(self): return "50% 猎鹿, 50% 猎兔，完全随机。"
    def choose(self): return random.choice([Move.STAG, Move.HARE])


class TitForTat(Strategy):
    """第一轮猎鹿，之后复制对手上一轮的策略"""
    def name(self): return "TitForTat (以牙还牙)"
    def description(self): return "首轮猎鹿示好，之后模仿对手上一轮的策略。你合作我合作，你背叛我背叛。"
    def choose(self):
        if not self.opp_history:
            return Move.STAG
        return self.opp_history[-1]


class Grudger(Strategy):
    """一直猎鹿，直到被背叛，然后永远猎兔"""
    def name(self): return "Grudger (记仇者)"
    def description(self): return "一直猎鹿，一旦被背叛就永远不再信任对手。一次背叛，终身猎兔。"
    def choose(self):
        if Move.HARE in self.opp_history:
            return Move.HARE
        return Move.STAG


class ForgivingTitForTat(Strategy):
    """TitForTat 但被背叛后有 30% 概率原谅并继续猎鹿"""
    def name(self): return "ForgivingTFT (宽容以牙还牙)"
    def description(self): return "类似以牙还牙，但被背叛后有30%概率原谅对手、继续猎鹿。给关系留修复空间。"
    def choose(self):
        if not self.opp_history:
            return Move.STAG
        if self.opp_history[-1] == Move.HARE and random.random() < 0.7:
            return Move.HARE
        return Move.STAG


class Bayesian(Strategy):
    """对对手猎鹿概率维持 Beta 分布的信念 (alpha, beta)，用 Thompson Sampling 决策"""
    def __init__(self):
        super().__init__()
        self.alpha = 1.0   # 对手猎鹿次数 + 1 (先验)
        self.beta = 1.0     # 对手猎兔次数 + 1 (先验)
        self.threshold = 0.4  # 低于此概率则猎兔自保

    def name(self): return "Bayesian (贝叶斯推断)"
    def description(self): return (
        "用Beta分布估计对手猎鹿概率，当信心不足时猎兔自保。"
        "越多次合作成功，越倾向猎鹿。"
    )

    def choose(self):
        p = self.alpha / (self.alpha + self.beta)
        if p < self.threshold:
            return Move.HARE
        return Move.STAG

    def observe(self, my_move, opp_move):
        super().observe(my_move, opp_move)
        if opp_move == Move.STAG:
            self.alpha += 1
        else:
            self.beta += 1

    def reset(self):
        super().reset()
        self.alpha = 1.0
        self.beta = 1.0


class Detective(Strategy):
    """前 4 轮按固定模式试探，之后根据结果做决定"""
    def __init__(self):
        super().__init__()
        self.probe_sequence = [Move.STAG, Move.HARE, Move.STAG, Move.STAG]
        self.decided = False
        self.decision = Move.STAG

    def name(self): return "Detective (侦探)"
    def description(self): return (
        "前4轮按固定模式试探对手：鹿→兔→鹿→鹿，分析对手反应后决定策略。"
        "若对手曾猎鹿则用TitForTat，否则永远猎兔。"
    )

    def choose(self):
        r = len(self.my_history)
        if r < len(self.probe_sequence):
            return self.probe_sequence[r]
        if not self.decided:
            self.decided = True
            if Move.STAG in self.opp_history:
                self.decision = "TFT"
            else:
                self.decision = "HARE"
        if self.decision == "TFT":
            return self.opp_history[-1]
        return Move.HARE

    def reset(self):
        super().reset()
        self.decided = False
        self.decision = Move.STAG


# ── 策略注册表 ──────────────────────────────────────────

ALL_STRATEGIES: list[type[Strategy]] = [
    AlwaysStag,
    AlwaysHare,
    RandomStrategy,
    TitForTat,
    Grudger,
    ForgivingTitForTat,
    Bayesian,
    Detective,
]


def make_strategy(idx: int) -> Strategy:
    return ALL_STRATEGIES[idx]()


# ── 游戏引擎 ────────────────────────────────────────────

class StagHuntGame:
    """单局两方博弈的控制器"""

    def __init__(self, p1, p2, rounds: int = 1):
        """
        p1, p2: 玩家，可以是 Strategy 对象或 HumanPlayer
        rounds: 重复博弈的轮数
        """
        self.p1 = p1
        self.p2 = p2
        self.total_rounds = rounds
        self.history: list[RoundResult] = []

    def play_round(self, r: int) -> RoundResult:
        m1 = self.p1.choose()
        m2 = self.p2.choose()
        s1 = payoff(m1, m2)
        s2 = payoff(m2, m1)
        self.p1.observe(m1, m2)
        self.p2.observe(m2, m1)
        result = RoundResult(r, m1, m2, s1, s2)
        self.history.append(result)
        return result

    def play_all(self, silent: bool = False) -> "MatchResult":
        for r in range(1, self.total_rounds + 1):
            result = self.play_round(r)
            if not silent:
                self._print_round(result)
        return MatchResult(
            p1_name=get_player_name(self.p1),
            p2_name=get_player_name(self.p2),
            p1_total=sum(r.p1_score for r in self.history),
            p2_total=sum(r.p2_score for r in self.history),
            rounds=self.total_rounds,
            move_pairs=[(r.p1_move, r.p2_move) for r in self.history],
        )

    def _print_round(self, r: RoundResult):
        dc = "🦌" if r.p1_move == Move.STAG else "🐇"
        oc = "🦌" if r.p2_move == Move.STAG else "🐇"
        print(f"  第{r.round_num:2d}轮  │  你: {dc}  │  对手: {oc}  │  得分: 你 {r.p1_score}  |  对手 {r.p2_score}")

    def reset(self):
        self.p1.reset()
        self.p2.reset()
        self.history.clear()


class HumanPlayer:
    """命令行人类玩家"""

    def __init__(self, label: str):
        self.label = label
        self.my_history: list[str] = []
        self.opp_history: list[str] = []

    def name(self): return self.label

    def description(self): return "人类玩家"

    def choose(self) -> str:
        while True:
            prompt = f"  [{self.label}]  猎鹿(🦌) 按 [1]  |  猎兔(🐇) 按 [2]: "
            try:
                choice = input(prompt).strip()
                if choice == "1":
                    return Move.STAG
                elif choice == "2":
                    return Move.HARE
                else:
                    print(color("  请输入 1 或 2", Color.RED))
            except (EOFError, KeyboardInterrupt):
                print("\n")
                sys.exit(0)

    def observe(self, my_move: str, opp_move: str):
        self.my_history.append(my_move)
        self.opp_history.append(opp_move)

    def reset(self):
        self.my_history.clear()
        self.opp_history.clear()


class MatchResult(NamedTuple):
    p1_name: str
    p2_name: str
    p1_total: int
    p2_total: int
    rounds: int
    move_pairs: list[tuple[str, str]]

    def winner(self) -> str:
        if self.p1_total > self.p2_total:
            return self.p1_name
        elif self.p2_total > self.p1_total:
            return self.p2_name
        return "平局"

    def cooperated_pct(self, player: int) -> float:
        """1 for p1, 2 for p2"""
        moves = [p[player - 1] for p in self.move_pairs]
        return sum(1 for m in moves if m == Move.STAG) / len(moves) * 100


def get_player_name(player) -> str:
    return player.name() if callable(player.name) else player.name


# ── 显示工具 ────────────────────────────────────────────

def print_banner():
    print()
    print(color("╔══════════════════════════════════════╗", Color.CYAN))
    print(color("║       🦌  猎 鹿 博 弈  🦌           ║", Color.CYAN + Color.BOLD))
    print(color("║        Stag Hunt Game               ║", Color.CYAN))
    print(color("╚══════════════════════════════════════╝", Color.CYAN))
    print()


def print_payoff_matrix():
    print(color("  ── 收益矩阵 ──", Color.YELLOW))
    print(f"               对手猎鹿🦌      对手猎兔🐇")
    print(f"  你猎鹿🦌      (4, 4)         (0, 2)")
    print(f"  你猎兔🐇      (2, 0)         (2, 2)")
    print()
    print(f"  💡 启示：合作共赢但需信任，背叛自保但收益有限。")
    print()


def print_strategies():
    """打印所有AI策略供选择"""
    print(color("  ── AI 策略列表 ──", Color.YELLOW))
    for i, cls in enumerate(ALL_STRATEGIES):
        inst = cls()
        print(f"  [{i+1}] {color(inst.name(), Color.BOLD)}")
        print(f"      {inst.description()}")
    print()


def print_match_summary(result: MatchResult):
    print()
    print(color("  ══════════════════════════", Color.GREEN))
    print(color("        📊 比赛结果", Color.GREEN + Color.BOLD))
    print(color("  ══════════════════════════", Color.GREEN))
    print(f"  {result.p1_name:20s}  {result.p1_total:3d} 分")
    print(f"  {result.p2_name:20s}  {result.p2_total:3d} 分")
    print(f"  共 {result.rounds} 轮, 胜者: {color(result.winner(), Color.BOLD)}")
    print(f"  P1 猎鹿率: {result.cooperated_pct(1):.1f}%")
    print(f"  P2 猎鹿率: {result.cooperated_pct(2):.1f}%")
    print()


def print_tournament_table(scores: dict[str, int], results: list[MatchResult]):
    print()
    print(color("  ═══════════════════════════════════════", Color.GREEN))
    print(color("        🏆  锦标赛最终排名", Color.GREEN + Color.BOLD))
    print(color("  ═══════════════════════════════════════", Color.GREEN))

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    medals = ["🥇", "🥈", "🥉"]
    for i, (name, score) in enumerate(ranked):
        medal = medals[i] if i < 3 else f"  {i+1}."
        bar = "█" * (score // 2) if score > 0 else ""
        print(f"  {medal} {name:30s} {score:4d} 分  {color(bar, Color.CYAN)}")

    print()
    # 显示几场经典对局
    print(color("  ── 精选对局 ──", Color.YELLOW))
    for r in results[:5]:
        print(f"  {r.p1_name:20s} vs {r.p2_name:20s}  →  {r.p1_total}-{r.p2_total}")


# ── 游戏模式 ────────────────────────────────────────────

def mode_human_vs_ai():
    """人机对战 — AI策略随机选择"""
    clear_screen()
    print_banner()
    print_payoff_matrix()

    while True:
        try:
            rounds = int(input(f"  对局轮数 (默认10): ").strip() or "10")
            if rounds > 0:
                break
        except ValueError:
            pass
        print(color("  请输入正整数", Color.RED))

    ai = make_strategy(random.randrange(len(ALL_STRATEGIES)))
    human = HumanPlayer("你")

    print()
    print(color(f"  🆚  你  VS  ??? (AI 策略已随机隐藏)", Color.CYAN + Color.BOLD))
    print(f"     💡 观察对手行为，在博弈中推测它的策略！")
    print()

    game = StagHuntGame(human, ai, rounds=rounds)
    result = game.play_all(silent=False)
    print_match_summary(result)

    # 揭示AI策略
    print(color("  ── 🤖 AI 策略揭秘 ──", Color.YELLOW))
    print(f"  策略名称: {color(ai.name(), Color.BOLD)}")
    print(f"  策略说明: {ai.description()}")
    stag_pct = sum(1 for m in ai.my_history if m == Move.STAG) / max(len(ai.my_history), 1) * 100
    print(f"  实际猎鹿率: {stag_pct:.0f}%")
    print()

    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


def mode_human_vs_human():
    """双人对战"""
    clear_screen()
    print_banner()
    print_payoff_matrix()

    while True:
        try:
            rounds = int(input(f"  对局轮数 (默认10): ").strip() or "10")
            if rounds > 0:
                break
        except ValueError:
            pass

    p1 = HumanPlayer("玩家1")
    p2 = HumanPlayer("玩家2")

    print()
    print(color(f"  🆚  玩家1  VS  玩家2  ({rounds}轮)", Color.CYAN + Color.BOLD))
    print()

    game = StagHuntGame(p1, p2, rounds=rounds)
    result = game.play_all(silent=False)
    print_match_summary(result)

    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


def mode_tournament():
    """锦标赛: 所有 AI 策略两两对决"""
    clear_screen()
    print_banner()

    while True:
        try:
            rounds = int(input(f"  每场对局轮数 (默认20): ").strip() or "20")
            if rounds > 0:
                break
        except ValueError:
            pass

    strategies = [cls() for cls in ALL_STRATEGIES]
    scores: dict[str, int] = defaultdict(int)
    all_results: list[MatchResult] = []

    n = len(strategies)
    total_matches = n * (n - 1) // 2
    match_count = 0

    print()
    print(color(f"  🏟️  锦标赛开始！{n} 种策略, {total_matches} 场比赛, 每场 {rounds} 轮", Color.CYAN + Color.BOLD))
    print()

    for i in range(n):
        for j in range(i + 1, n):
            match_count += 1
            s1, s2 = strategies[i], strategies[j]

            game = StagHuntGame(s1, s2, rounds=rounds)
            result = game.play_all(silent=True)

            # 锦标积分: 胜+3, 平+1, 负+0
            if result.p1_total > result.p2_total:
                scores[result.p1_name] += 3
            elif result.p2_total > result.p1_total:
                scores[result.p2_name] += 3
            else:
                scores[result.p1_name] += 1
                scores[result.p2_name] += 1

            all_results.append(result)

            bar_len = 30
            filled = int(match_count / total_matches * bar_len)
            bar = "█" * filled + "░" * (bar_len - filled)
            status = f"  [{bar}] {match_count}/{total_matches}"
            print(f"\r{status}", end="", flush=True)

            # 按键重置策略状态
            s1.reset()
            s2.reset()

    print()
    print_tournament_table(scores, all_results)
    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


def mode_strategy_explain():
    """策略详解"""
    clear_screen()
    print_banner()

    print(color("  ── 经典模式 AI 策略 ──", Color.YELLOW))
    for i, cls in enumerate(ALL_STRATEGIES):
        inst = cls()
        print(f"  [{i+1}] {color(inst.name(), Color.BOLD)}")
        print(f"      {inst.description()}")
    print()

    print(color("  ── 增强模式 AI 策略 ──", Color.YELLOW))
    for i, cls in enumerate(ENHANCED_STRATEGIES):
        inst = cls()
        print(f"  [{i+1}] {color(inst.name(), Color.BOLD)}")
        print(f"      {inst.description()}")
    print()

    print(color("  ── 猎鹿博弈理论背景 ──", Color.YELLOW))
    print()
    print("  猎鹿博弈由哲学家卢梭(Rousseau)提出，描述了两人合作")
    print("  猎鹿可以获得最大收益，但若对方背叛则可能一无所获。")
    print()
    print("  【经典模式】两个纯策略纳什均衡:")
    print("    • (猎鹿, 猎鹿) — 收益占优均衡 (Payoff Dominant)")
    print("    • (猎兔, 猎兔) — 风险占优均衡 (Risk Dominant)")
    print()
    print("  【增强模式】加入连续投入 + 随机天气后:")
    print("    • 天气公开信息改变了风险计算")
    print("    • 投入量成为新的策略维度")
    print("    • 晴天低门槛→合作信号增强；暴雨高门槛→背叛更理性")
    print()
    print("  核心张力: 信任 vs 安全 — 你愿意冒多大风险去追求更大的回报？")
    print()

    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


# ══════════════════════════════════════════════════════════
#  增强模式：连续投入 + 随机天气
# ══════════════════════════════════════════════════════════

class Weather:
    """天气条件 — 影响猎鹿的门槛与回报"""
    SUNNY   = ("☀️ 晴天", 2, 6, "鹿群活跃，合作门槛低，回报极高")
    CLOUDY  = ("🌥️ 多云", 3, 4, "普通天气，标准猎鹿条件")
    STORMY  = ("🌧️ 暴雨", 4, 3, "鹿群隐匿，门槛高，回报降低")

    @classmethod
    def all(cls):
        return [cls.SUNNY, cls.CLOUDY, cls.STORMY]

    @classmethod
    def random_draw(cls):
        """按概率抽取天气: 晴天30%  多云40%  暴雨30%"""
        r = random.random()
        if r < 0.30: return cls.SUNNY
        if r < 0.70: return cls.CLOUDY
        return cls.STORMY


MAX_INVEST = 3   # 每轮最大行动点数


class EnhancedRoundResult(NamedTuple):
    round_num: int
    weather: tuple
    p1_invest: int   # 猎鹿投入点数
    p2_invest: int
    stag_ok: bool     # 猎鹿是否成功
    p1_score: int
    p2_score: int


# ── 增强模式 AI 策略 ──────────────────────────────────

class EnhancedStrategy:
    def __init__(self):
        self.my_history: list[int] = []     # 自己的猎鹿投入
        self.opp_history: list[int] = []    # 对手的猎鹿投入
        self.weather_history: list[tuple] = []
        self.coop_history: list[bool] = []   # 本轮猎鹿是否成功

    def name(self) -> str: raise NotImplementedError
    def description(self) -> str: raise NotImplementedError

    def choose(self, weather: tuple) -> int:
        """根据天气返回对猎鹿的投入点数 0~3"""
        raise NotImplementedError

    def observe(self, my_invest: int, opp_invest: int, weather: tuple, stag_ok: bool):
        self.my_history.append(my_invest)
        self.opp_history.append(opp_invest)
        self.weather_history.append(weather)
        self.coop_history.append(stag_ok)

    def reset(self):
        self.my_history.clear()
        self.opp_history.clear()
        self.weather_history.clear()
        self.coop_history.clear()


class InvestStag(EnhancedStrategy):
    def name(self): return "InvestStag (全力猎鹿)"
    def description(self): return "无论天气如何，押上全部3点猎鹿。要么大赢，要么血本无归。"
    def choose(self, weather): return MAX_INVEST


class InvestHare(EnhancedStrategy):
    def name(self): return "InvestHare (只猎兔)"
    def description(self): return "拒绝一切风险，全部点数猎兔，稳定获利每轮3分。"
    def choose(self, weather): return 0


class InvestRandom(EnhancedStrategy):
    def name(self): return "InvestRandom (随机押注)"
    def description(self): return "每轮随机投入 0~3 点猎鹿，完全不可预测。"
    def choose(self, weather): return random.randint(0, MAX_INVEST)


class InvestCautious(EnhancedStrategy):
    """根据天气调整: 晴天多投，暴雨少投"""
    def name(self): return "InvestCautious (天气敏感)"
    def description(self): return "晴天投3点(低门槛高回报)，多云投2点，暴雨只投1点。按天气理性分配。"
    def choose(self, weather):
        _, threshold, mult, *_ = weather
        if threshold <= 2: return 3
        if threshold == 3: return 2
        return 1


class InvestTitForTat(EnhancedStrategy):
    """首轮投2点试探，之后模仿对手上一轮的投入水平"""
    def name(self): return "InvestTFT (投入版以牙还牙)"
    def description(self): return "首轮投入2点示好，之后模仿对手上一轮的猎鹿投入。"
    def choose(self, weather):
        if not self.opp_history: return 2
        return min(self.opp_history[-1], MAX_INVEST)


class InvestGrudger(EnhancedStrategy):
    """一直投3点，直到某轮猎鹿失败(被背叛)，之后永远投0"""
    def name(self): return "InvestGrudger (记仇者)"
    def description(self): return "全力猎鹿直到合作失败一次，之后永远不再信任对手。"
    def choose(self, weather):
        if False in self.coop_history: return 0
        return 3


class InvestAdaptive(EnhancedStrategy):
    """维持对"对手投入占其总点数的比例"的加权平均估计"""
    def __init__(self):
        super().__init__()
        self.trust = 0.6  # 初始信任度

    def name(self): return "InvestAdaptive (自适应)"
    def description(self): return "用指数平滑估计对手合作倾向，根据信任度+天气决定投入。信任越高投越多。"
    def choose(self, weather):
        _, threshold, mult, *_ = weather
        # 根据信任度和天气门槛计算最优投入
        raw = int(self.trust * MAX_INVEST)
        # 暴雨时保守一点
        if threshold >= 4: raw = max(0, raw - 1)
        return min(raw, MAX_INVEST)

    def observe(self, my_invest, opp_invest, weather, stag_ok):
        super().observe(my_invest, opp_invest, weather, stag_ok)
        opp_ratio = opp_invest / MAX_INVEST
        self.trust = 0.7 * self.trust + 0.3 * opp_ratio  # 指数平滑

    def reset(self):
        super().reset()
        self.trust = 0.6


class InvestBayesian(EnhancedStrategy):
    """Beta 分布估计对手猎鹿投入倾向，取期望值决策"""
    def __init__(self):
        super().__init__()
        self.alpha = 2.0
        self.beta = 2.0

    def name(self): return "InvestBayesian (贝叶斯)"
    def description(self): return "用Beta分布学习对手投入倾向，取期望投入量。越确认对方合作，投入越多。"
    def choose(self, weather):
        p = self.alpha / (self.alpha + self.beta)
        _, threshold, mult, *_ = weather
        invest = int(p * MAX_INVEST)
        # 如果门槛太高，降低投入
        if threshold >= 4: invest = max(0, invest - 1)
        return min(invest, MAX_INVEST)

    def observe(self, my_invest, opp_invest, weather, stag_ok):
        super().observe(my_invest, opp_invest, weather, stag_ok)
        ratio = opp_invest / MAX_INVEST
        self.alpha += ratio * 2
        self.beta += (1 - ratio) * 2

    def reset(self):
        super().reset()
        self.alpha = 2.0
        self.beta = 2.0


ENHANCED_STRATEGIES: list[type[EnhancedStrategy]] = [
    InvestStag, InvestHare, InvestRandom,
    InvestCautious, InvestTitForTat,
    InvestGrudger, InvestAdaptive, InvestBayesian,
]


def make_enhanced_strategy(idx: int) -> EnhancedStrategy:
    return ENHANCED_STRATEGIES[idx]()


# ── 增强模式引擎 ─────────────────────────────────────

class EnhancedHumanPlayer:
    def __init__(self, label: str):
        self.label = label
        self.my_history: list[int] = []
        self.opp_history: list[int] = []
        self.weather_history: list[tuple] = []
        self.coop_history: list[bool] = []

    def name(self): return self.label
    def description(self): return "人类玩家"

    def choose(self, weather: tuple) -> int:
        w_name, threshold, mult, w_desc = weather
        while True:
            print()
            print(color(f"  🌤️  本轮天气: {w_name} — {w_desc}", Color.YELLOW))
            print(f"      鹿群门槛: {threshold}点  |  成功倍率: ×{mult}")
            print(f"      你有 {MAX_INVEST} 个行动点，猎兔每点稳拿 1 分")
            try:
                choice = input(f"  [{self.label}] 投入几点猎鹿? [0-{MAX_INVEST}]: ").strip()
                invest = int(choice)
                if 0 <= invest <= MAX_INVEST:
                    return invest
                print(color(f"  请输入 0~{MAX_INVEST}", Color.RED))
            except ValueError:
                print(color(f"  请输入数字 0~{MAX_INVEST}", Color.RED))
            except (EOFError, KeyboardInterrupt):
                print("\n"); sys.exit(0)

    def observe(self, my_invest: int, opp_invest: int, weather: tuple, stag_ok: bool):
        self.my_history.append(my_invest)
        self.opp_history.append(opp_invest)
        self.weather_history.append(weather)
        self.coop_history.append(stag_ok)

    def reset(self):
        self.my_history.clear()
        self.opp_history.clear()
        self.weather_history.clear()
        self.coop_history.clear()


class EnhancedStagHuntGame:
    def __init__(self, p1, p2, rounds: int = 10):
        self.p1 = p1
        self.p2 = p2
        self.total_rounds = rounds
        self.history: list[EnhancedRoundResult] = []

    def play_round(self, r: int) -> EnhancedRoundResult:
        weather = Weather.random_draw()
        w_name, threshold, mult, w_desc = weather
        i1 = self.p1.choose(weather)
        i2 = self.p2.choose(weather)
        total = i1 + i2
        stag_ok = total >= threshold
        # 猎鹿收益: 成功则投入×倍率, 失败则0
        stag1 = i1 * mult if stag_ok else 0
        stag2 = i2 * mult if stag_ok else 0
        # 猎兔收益: 剩余点数×1
        hare1 = (MAX_INVEST - i1) * 1
        hare2 = (MAX_INVEST - i2) * 1
        s1 = stag1 + hare1
        s2 = stag2 + hare2

        self.p1.observe(i1, i2, weather, stag_ok)
        self.p2.observe(i2, i1, weather, stag_ok)
        result = EnhancedRoundResult(r, weather, i1, i2, stag_ok, s1, s2)
        self.history.append(result)
        return result

    def play_all(self, silent: bool = False):
        p1_total = p2_total = 0
        for r in range(1, self.total_rounds + 1):
            result = self.play_round(r)
            p1_total += result.p1_score
            p2_total += result.p2_score
            if not silent:
                self._print_round(result)
        return EnhancedMatchResult(
            p1_name=get_player_name(self.p1),
            p2_name=get_player_name(self.p2),
            p1_total=p1_total,
            p2_total=p2_total,
            rounds=self.total_rounds,
            history=self.history,
        )

    def _print_round(self, r: EnhancedRoundResult):
        w_name, threshold, mult, _ = r.weather
        status = color("✅ 猎鹿成功!", Color.GREEN) if r.stag_ok else color("❌ 猎鹿失败", Color.RED)
        print(f"  第{r.round_num:2d}轮 {w_name} │ 你投🦌{r.p1_invest}点 对手投🦌{r.p2_invest}点 "
              f"(总{r.p1_invest + r.p2_invest}/{threshold}) {status} │ "
              f"得分: 你{r.p1_score}  对手{r.p2_score}")

    def reset(self):
        self.p1.reset()
        self.p2.reset()
        self.history.clear()


class EnhancedMatchResult(NamedTuple):
    p1_name: str
    p2_name: str
    p1_total: int
    p2_total: int
    rounds: int
    history: list[EnhancedRoundResult]

    def winner(self) -> str:
        if self.p1_total > self.p2_total: return self.p1_name
        if self.p2_total > self.p1_total: return self.p2_name
        return "平局"


# ── 增强模式显示 ────────────────────────────────────

def print_enhanced_rules():
    print(color("  ── 增强模式规则 ──", Color.YELLOW))
    print(f"  • 每轮你有 {MAX_INVEST} 个行动点，秘密分配猎鹿投入 (0~{MAX_INVEST})")
    print(f"  • 剩余点数自动猎兔，每点稳拿 1 分")
    print(f"  • 两人猎鹿总投入 ≥ 天气门槛，则猎鹿成功，投入点数 × 倍率")
    print(f"  • 总投入 < 门槛，猎鹿失败，投入的点数血本无归！")
    print()
    print(color("  ── 天气影响 ──", Color.YELLOW))
    print(f"  ☀️ 晴天(30%): 门槛 2, 倍率 ×6   ← 最佳猎鹿时机")
    print(f"  🌥️ 多云(40%): 门槛 3, 倍率 ×4   ← 常规条件")
    print(f"  🌧️ 暴雨(30%): 门槛 4, 倍率 ×3   ← 高风险低回报")
    print()


def print_enhanced_match_summary(result: EnhancedMatchResult):
    print()
    print(color("  ══════════════════════════", Color.GREEN))
    print(color("        📊 比赛结果", Color.GREEN + Color.BOLD))
    print(color("  ══════════════════════════", Color.GREEN))
    print(f"  {result.p1_name:20s}  {result.p1_total:3d} 分")
    print(f"  {result.p2_name:20s}  {result.p2_total:3d} 分")
    print(f"  共 {result.rounds} 轮, 胜者: {color(result.winner(), Color.BOLD)}")
    avg_stag = sum(r.p1_invest + r.p2_invest for r in result.history) / max(len(result.history), 1)
    stag_ok_count = sum(1 for r in result.history if r.stag_ok)
    print(f"  平均总猎鹿投入: {avg_stag:.1f}点  |  猎鹿成功: {stag_ok_count}/{result.rounds} 轮")
    print()


# ── 增强模式入口 ────────────────────────────────────

def mode_enhanced_vs_ai():
    """增强模式人机对战"""
    clear_screen()
    print_banner()
    print_enhanced_rules()

    while True:
        try:
            rounds = int(input(f"  对局轮数 (默认10): ").strip() or "10")
            if rounds > 0: break
        except ValueError:
            pass
        print(color("  请输入正整数", Color.RED))

    ai = make_enhanced_strategy(random.randrange(len(ENHANCED_STRATEGIES)))
    human = EnhancedHumanPlayer("你")

    print()
    print(color(f"  🆚  增强模式: 你  VS  ??? (AI策略已随机隐藏)", Color.CYAN + Color.BOLD))
    print()

    game = EnhancedStagHuntGame(human, ai, rounds=rounds)
    result = game.play_all(silent=False)
    print_enhanced_match_summary(result)

    # 揭示AI
    print(color("  ── 🤖 AI 策略揭秘 ──", Color.YELLOW))
    print(f"  策略名称: {color(ai.name(), Color.BOLD)}")
    print(f"  策略说明: {ai.description()}")
    avg_invest = sum(ai.my_history) / max(len(ai.my_history), 1)
    print(f"  平均猎鹿投入: {avg_invest:.1f} 点 / {MAX_INVEST} 点")
    print()

    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


def mode_enhanced_vs_human():
    """增强模式双人对战"""
    clear_screen()
    print_banner()
    print_enhanced_rules()

    while True:
        try:
            rounds = int(input(f"  对局轮数 (默认10): ").strip() or "10")
            if rounds > 0: break
        except ValueError:
            pass

    p1 = EnhancedHumanPlayer("玩家1")
    p2 = EnhancedHumanPlayer("玩家2")

    print()
    print(color(f"  🆚  增强模式: 玩家1  VS  玩家2  ({rounds}轮)", Color.CYAN + Color.BOLD))
    print()

    game = EnhancedStagHuntGame(p1, p2, rounds=rounds)
    result = game.play_all(silent=False)
    print_enhanced_match_summary(result)
    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


def mode_enhanced_tournament():
    """增强模式锦标赛"""
    clear_screen()
    print_banner()

    while True:
        try:
            rounds = int(input(f"  每场对局轮数 (默认20): ").strip() or "20")
            if rounds > 0: break
        except ValueError:
            pass

    strategies = [cls() for cls in ENHANCED_STRATEGIES]
    scores: dict[str, int] = defaultdict(int)
    all_results: list[EnhancedMatchResult] = []

    n = len(strategies)
    total_matches = n * (n - 1) // 2
    match_count = 0

    print()
    print(color(f"  🏟️  增强模式锦标赛！{n} 种策略, {total_matches} 场比赛, 每场 {rounds} 轮", Color.CYAN + Color.BOLD))
    print()

    for i in range(n):
        for j in range(i + 1, n):
            match_count += 1
            s1, s2 = strategies[i], strategies[j]

            game = EnhancedStagHuntGame(s1, s2, rounds=rounds)
            result = game.play_all(silent=True)

            if result.p1_total > result.p2_total:
                scores[result.p1_name] += 3
            elif result.p2_total > result.p1_total:
                scores[result.p2_name] += 3
            else:
                scores[result.p1_name] += 1
                scores[result.p2_name] += 1

            all_results.append(result)

            bar_len = 30
            filled = int(match_count / total_matches * bar_len)
            bar = "█" * filled + "░" * (bar_len - filled)
            print(f"\r  [{bar}] {match_count}/{total_matches}", end="", flush=True)

            s1.reset()
            s2.reset()

    print()
    # 增强模式排名
    print()
    print(color("  ═══════════════════════════════════════", Color.GREEN))
    print(color("        🏆  增强模式锦标赛排名", Color.GREEN + Color.BOLD))
    print(color("  ═══════════════════════════════════════", Color.GREEN))

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    medals = ["🥇", "🥈", "🥉"]
    for i, (name, score) in enumerate(ranked):
        medal = medals[i] if i < 3 else f"  {i+1}."
        bar = "█" * (score // 2) if score > 0 else ""
        print(f"  {medal} {name:30s} {score:4d} 分  {color(bar, Color.CYAN)}")

    print()
    print(color("  ── 精选对局 ──", Color.YELLOW))
    for r in all_results[:5]:
        print(f"  {r.p1_name:20s} vs {r.p2_name:20s}  →  {r.p1_total}-{r.p2_total}")

    input(color("  按 Enter 返回主菜单...", Color.YELLOW))


# ── 主菜单 ──────────────────────────────────────────────

def main_menu():
    while True:
        clear_screen()
        print_banner()
        print_payoff_matrix()

        menu_items = [
            ("经典模式 🦌", "二元选择(猎鹿/猎兔)，8种AI，随机匹配"),
            ("增强模式 ⚡", "连续投入(0-3点) + 随机天气 + 门槛机制"),
            ("双人对战 👥", "经典模式，本地两人轮流输入"),
            ("经典锦标赛 🏆", "经典8种AI策略两两对决，排名积分"),
            ("增强锦标赛 🏟️", "增强8种AI策略两两对决，天气+投入博弈"),
            ("策略详解 📖", "了解经典与增强模式的全部AI策略"),
            ("退出 🚪", "结束游戏"),
        ]

        for i, (title, desc) in enumerate(menu_items):
            print(f"  [{i+1}] {color(title, Color.BOLD)} — {desc}")

        print()
        try:
            choice = input(f"  请选择 [1-{len(menu_items)}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            break

        if choice == "1":
            mode_human_vs_ai()
        elif choice == "2":
            mode_enhanced_vs_ai()
        elif choice == "3":
            mode_human_vs_human()
        elif choice == "4":
            mode_tournament()
        elif choice == "5":
            mode_enhanced_tournament()
        elif choice == "6":
            mode_strategy_explain()
        elif choice == "7":
            print()
            print(color("  再见！👋", Color.CYAN))
            print()
            break
        else:
            print(color("  无效选择", Color.RED))


if __name__ == "__main__":
    random.seed()
    main_menu()
