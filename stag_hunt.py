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
    GREEN   = "\033[92m"
    RED     = "\033[91m"
    YELLOW  = "\033[93m"
    CYAN    = "\033[96m"
    MAGENTA = "\033[95m"
    BOLD    = "\033[1m"
    RESET   = "\033[0m"

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
#  增强模式 v2：连续投入 + 随机天气 + 道具 + 事件 + 连胜
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
        r = random.random()
        if r < 0.30: return cls.SUNNY
        if r < 0.70: return cls.CLOUDY
        return cls.STORMY

    @classmethod
    def worsen(cls, weather: tuple) -> tuple:
        """天气恶化一级（用于随机事件）"""
        if weather == cls.SUNNY: return cls.CLOUDY
        if weather == cls.CLOUDY: return cls.STORMY
        return cls.STORMY  # 暴雨不能再恶化


MAX_INVEST = 3


# ── 道具系统 ──────────────────────────────────────────

class Item:
    """一次性道具"""
    all_items: list["Item"] = []  # 类级别注册

    def __init__(self, icon: str, name: str, desc: str, effect_desc: str):
        self.icon = icon
        self.name = name
        self.desc = desc
        self.effect_desc = effect_desc
        Item.all_items.append(self)

    def __repr__(self):
        return f"{self.icon} {self.name}"


# 6 种道具定义
ITEM_SCOUT  = Item("🔭", "侦查镜", "偷看对手本轮投入", "使用后先看对手投入，再决定自己的投入")
ITEM_ARROW  = Item("🏹", "精钢箭", "猎鹿投入+1", "本轮你的猎鹿投入免费+1（不消耗行动点）")
ITEM_SHIELD = Item("🛡️", "保险符", "失败返还一半", "猎鹿失败时返还你投入点数的一半")
ITEM_BAIT   = Item("🌿", "诱鹿草", "门槛-1", "本轮猎鹿门槛降低1点")
ITEM_LUCKY  = Item("🍀", "幸运符", "收益×1.5", "本轮你的总收益×1.5")
ITEM_SNIPER = Item("🎯", "神射手", "倍率+2", "猎鹿成功时你的投入倍率+2")


def random_items(n: int = 2) -> list[Item]:
    """随机发放 n 个不重复的道具"""
    pool = Item.all_items.copy()
    random.shuffle(pool)
    return pool[:n]


# ── 随机事件 ──────────────────────────────────────────

class RandomEvent:
    all_events: list["RandomEvent"] = []

    def __init__(self, icon: str, name: str, desc: str, apply_fn):
        self.icon = icon
        self.name = name
        self.desc = desc
        self.apply_fn = apply_fn  # fn(game_state) -> (p1_delta, p2_delta, extra_msg)
        RandomEvent.all_events.append(self)


def _event_mushrooms(state):
    return 2, 2, "双方各捡到 2 分蘑菇 🍄"

def _event_wolves(state):
    return -2, -2, "双方各被野狼抢走 2 分猎物 🐺"

def _event_rainbow(state):
    state["double_round"] = True
    return 0, 0, "🌈 本轮所有收益翻倍！"

def _event_merchant(state):
    state["merchant_offer"] = True
    return 0, 0, "🎪 流浪商人路过！可花 3 分买随机道具（结算时扣款）"

def _event_storm_worsen(state):
    state["weather"] = Weather.worsen(state.get("weather", Weather.CLOUDY))
    return 0, 0, f"⚡ 天气骤变！变为 {state['weather'][0]}"


EVT_MUSHROOM  = RandomEvent("🍄", "遍地蘑菇", "双方各+2分", _event_mushrooms)
EVT_WOLVES    = RandomEvent("🐺", "野狼突袭", "双方各-2分", _event_wolves)
EVT_RAINBOW   = RandomEvent("🌈", "双倍彩虹", "本轮收益翻倍", _event_rainbow)
EVT_MERCHANT  = RandomEvent("🎪", "流浪商人", "花3分买道具", _event_merchant)
EVT_STORM     = RandomEvent("⚡", "天气骤变", "天气恶化一级", _event_storm_worsen)


def trigger_random_event() -> RandomEvent | None:
    """18% 概率触发事件"""
    if random.random() < 0.18:
        return random.choice(RandomEvent.all_events)
    return None


# ── 连胜追踪 ──────────────────────────────────────────

class StreakTracker:
    def __init__(self):
        self.count = 0

    def on_success(self):
        self.count += 1

    def on_fail(self):
        self.count = 0

    def bonus_per_point(self) -> int:
        """返回猎鹿成功时每点投入的额外加成"""
        if self.count >= 4: return 3
        if self.count == 3: return 2
        if self.count == 2: return 1
        return 0

    def fire_display(self) -> str:
        if self.count >= 4: return f"🔥🔥🔥 ×{self.count}"
        if self.count >= 3: return f"🔥🔥 ×{self.count}"
        if self.count >= 2: return f"🔥 ×{self.count}"
        return ""

    def reset(self):
        self.count = 0


# ── 增强模式 AI 策略 ──────────────────────────────────

class EnhancedStrategy:
    """增强策略基类 — 支持道具使用"""

    def __init__(self):
        self.my_history: list[int] = []
        self.opp_history: list[int] = []
        self.weather_history: list[tuple] = []
        self.coop_history: list[bool] = []
        self.items: list[Item] = []
        self.streak: StreakTracker = StreakTracker()
        self.just_used_item: Item | None = None

    def name(self) -> str: raise NotImplementedError
    def description(self) -> str: raise NotImplementedError
    def personality(self) -> str: raise NotImplementedError

    def give_items(self, items: list[Item]):
        self.items = list(items)

    def choose(self, weather: tuple) -> int:
        """返回猎鹿投入 0~3"""
        raise NotImplementedError

    def choose_item(self, weather: tuple, opp_history: list[int]) -> Item | None:
        """决定本轮是否使用道具，返回使用的道具或 None。默认不用。"""
        return None

    def use_item(self, item: Item) -> bool:
        """消耗道具，返回是否成功"""
        if item in self.items:
            self.items.remove(item)
            self.just_used_item = item
            return True
        return False

    def observe(self, my_invest: int, opp_invest: int, weather: tuple, stag_ok: bool):
        self.my_history.append(my_invest)
        self.opp_history.append(opp_invest)
        self.weather_history.append(weather)
        self.coop_history.append(stag_ok)
        if stag_ok:
            self.streak.on_success()
        else:
            self.streak.on_fail()
        self.just_used_item = None

    def react(self, stag_ok: bool, event: RandomEvent | None) -> str:
        """回合后的个性反应"""
        return ""

    def reset(self):
        self.my_history.clear()
        self.opp_history.clear()
        self.weather_history.clear()
        self.coop_history.clear()
        self.items.clear()
        self.streak.reset()
        self.just_used_item = None


class InvestStag(EnhancedStrategy):
    def name(self): return "InvestStag (全力猎鹿)"
    def description(self): return "无论天气如何，押上全部3点猎鹿。"
    def personality(self): return "🔥 激进派 — '不冒险哪来的肉吃！'"
    def choose(self, weather): return MAX_INVEST
    def choose_item(self, weather, opp_history):
        if ITEM_BAIT in self.items and weather[1] >= 4:
            return ITEM_BAIT
        if ITEM_ARROW in self.items and weather[1] <= 3:
            return ITEM_ARROW
        return None
    def react(self, stag_ok, event):
        if stag_ok: return random.choice(["哈哈！合作愉快！🎉", "看到没？信任就是力量！💪", "鹿肉管够！🍖"])
        return random.choice(["你居然背叛我... 😡", "好吧，下次我不敢了 😰", "这天气害的... 🌧️"])


class InvestHare(EnhancedStrategy):
    def name(self): return "InvestHare (只猎兔)"
    def description(self): return "拒绝一切风险，稳定获利。"
    def personality(self): return "🐢 保守派 — '稳稳当当才是真'"
    def choose(self, weather): return 0
    def choose_item(self, weather, opp_history):
        if ITEM_LUCKY in self.items: return ITEM_LUCKY
        return None
    def react(self, stag_ok, event):
        return random.choice(["兔子也不错嘛 🐇", "稳扎稳打~", "至少我没亏 😌"])


class InvestRandom(EnhancedStrategy):
    def name(self): return "InvestRandom (随机押注)"
    def description(self): return "完全不可预测的随机投入。"
    def personality(self): return "🎲 疯子 — '人生就是一场赌博！'"
    def choose(self, weather): return random.randint(0, MAX_INVEST)
    def choose_item(self, weather, opp_history):
        return random.choice([None] + [i for i in self.items]) if self.items else None
    def react(self, stag_ok, event):
        return random.choice(["哈哈随机的魅力！🎰", "算那么累干嘛~", "哇这也行？🤪"])


class InvestCautious(EnhancedStrategy):
    def name(self): return "InvestCautious (天气敏感)"
    def description(self): return "晴天3点，多云2点，暴雨1点。按天气理性分配。"
    def personality(self): return "🧠 理性派 — '数据不会骗人'"
    def choose(self, weather):
        _, threshold, mult, *_ = weather
        if threshold <= 2: return 3
        if threshold == 3: return 2
        return 1
    def choose_item(self, weather, opp_history):
        if ITEM_SCOUT in self.items and weather[1] >= 3:
            return ITEM_SCOUT
        if ITEM_BAIT in self.items and weather[1] >= 4:
            return ITEM_BAIT
        return None
    def react(self, stag_ok, event):
        if stag_ok: return "计算结果正确 ✅"
        return "风险评估需要调整... 📊"


class InvestTFT(EnhancedStrategy):
    def name(self): return "InvestTFT (投入版以牙还牙)"
    def description(self): return "首轮投2点，之后模仿对手上轮投入。"
    def personality(self): return "🤝 对等派 — '你怎么对我，我就怎么对你'"
    def choose(self, weather):
        if not self.opp_history: return 2
        return min(self.opp_history[-1], MAX_INVEST)
    def choose_item(self, weather, opp_history):
        if ITEM_SCOUT in self.items and len(opp_history) >= 2 and opp_history[-1] == 0:
            return ITEM_SCOUT  # 对手上次没投入，侦查一下
        return None
    def react(self, stag_ok, event):
        if stag_ok: return "合作愉快，继续保持！🤝"
        return "你不出力，我也不出 😤"


class InvestGrudger(EnhancedStrategy):
    def name(self): return "InvestGrudger (记仇者)"
    def description(self): return "全力猎鹿直到合作失败一次，之后永远投0。"
    def personality(self): return "💢 记仇派 — '一次不忠，终身不用'"
    def choose(self, weather):
        if False in self.coop_history: return 0
        return 3
    def choose_item(self, weather, opp_history):
        if ITEM_SHIELD in self.items and len(self.coop_history) == 0:
            return ITEM_SHIELD
        return None
    def react(self, stag_ok, event):
        if not stag_ok and len(self.coop_history) >= 1 and self.coop_history[-2] if len(self.coop_history) >= 2 else True:
            return "我记住了！再也不信你！💔"
        if stag_ok: return "信任还在延续..."
        return "..."

    def observe(self, my_invest, opp_invest, weather, stag_ok):
        # 只有猎鹿失败（总投入<门槛）才算背叛，不是因为门槛太高
        _, threshold, _, _ = weather
        was_betrayal = (my_invest + opp_invest) < threshold
        self.my_history.append(my_invest)
        self.opp_history.append(opp_invest)
        self.weather_history.append(weather)
        self.coop_history.append(not was_betrayal)
        if stag_ok:
            self.streak.on_success()
        else:
            self.streak.on_fail()
        self.just_used_item = None


class InvestAdaptive(EnhancedStrategy):
    def __init__(self):
        super().__init__()
        self.trust = 0.6

    def name(self): return "InvestAdaptive (自适应)"
    def description(self): return "指数平滑估计对手合作倾向，动态调整投入。"
    def personality(self): return "🦎 适应派 — '随机应变，见招拆招'"
    def choose(self, weather):
        _, threshold, _, *_ = weather
        raw = int(self.trust * MAX_INVEST)
        if threshold >= 4: raw = max(0, raw - 1)
        return min(raw, MAX_INVEST)

    def observe(self, my_invest, opp_invest, weather, stag_ok):
        super().observe(my_invest, opp_invest, weather, stag_ok)
        opp_ratio = opp_invest / MAX_INVEST
        self.trust = 0.7 * self.trust + 0.3 * opp_ratio

    def choose_item(self, weather, opp_history):
        if ITEM_SCOUT in self.items and self.trust < 0.4:
            return ITEM_SCOUT
        if ITEM_ARROW in self.items and weather[1] <= 2 and self.trust > 0.5:
            return ITEM_ARROW
        return None

    def react(self, stag_ok, event):
        trust_pct = int(self.trust * 100)
        return f"信任度 {trust_pct}%... {'📈' if stag_ok else '📉'}"

    def reset(self):
        super().reset()
        self.trust = 0.6


class InvestBayesian(EnhancedStrategy):
    def __init__(self):
        super().__init__()
        self.alpha = 2.0
        self.beta = 2.0

    def name(self): return "InvestBayesian (贝叶斯)"
    def description(self): return "Beta分布学习对手投入倾向，按期望值决策。"
    def personality(self): return "🔮 推理派 — '先验信念，后验更新'"
    def choose(self, weather):
        p = self.alpha / (self.alpha + self.beta)
        _, threshold, *_ = weather
        invest = int(p * MAX_INVEST)
        if threshold >= 4: invest = max(0, invest - 1)
        return min(invest, MAX_INVEST)

    def observe(self, my_invest, opp_invest, weather, stag_ok):
        super().observe(my_invest, opp_invest, weather, stag_ok)
        ratio = opp_invest / MAX_INVEST
        self.alpha += ratio * 2
        self.beta += (1 - ratio) * 2

    def choose_item(self, weather, opp_history):
        p = self.alpha / (self.alpha + self.beta)
        if ITEM_SCOUT in self.items and 0.3 < p < 0.6:
            return ITEM_SCOUT
        return None

    def react(self, stag_ok, event):
        p = int(self.alpha / (self.alpha + self.beta) * 100)
        return f"后验合作概率 {p}%"

    def reset(self):
        super().reset()
        self.alpha = 2.0
        self.beta = 2.0


ENHANCED_STRATEGIES: list[type[EnhancedStrategy]] = [
    InvestStag, InvestHare, InvestRandom,
    InvestCautious, InvestTFT,
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
        self.items: list[Item] = []
        self.streak = StreakTracker()
        self.just_used_item: Item | None = None

    def name(self): return self.label
    def description(self): return "人类玩家"
    def personality(self): return "🧑 你"
    def give_items(self, items): self.items = list(items)

    def choose_item(self, weather, opp_history) -> Item | None:
        """询问玩家是否使用道具"""
        if not self.items:
            return None
        while True:
            print()
            print(color(f"  🎒 你的道具背包:", Color.CYAN))
            for idx, it in enumerate(self.items):
                print(f"     [{idx+1}] {it.icon} {it.name} — {it.effect_desc}")
            print(f"     [0] 不使用道具，直接进入投入阶段")
            try:
                c = input(f"  使用哪个道具? [0-{len(self.items)}]: ").strip()
                if c == "0": return None
                c = int(c)
                if 1 <= c <= len(self.items):
                    return self.items[c - 1]
            except ValueError:
                pass
            print(color("  输入无效", Color.RED))

    def use_item(self, item):
        if item in self.items:
            self.items.remove(item)
            self.just_used_item = item
            return True
        return False

    def choose(self, weather: tuple) -> int:
        w_name, threshold, mult, w_desc = weather
        while True:
            print()
            print(color(f"  🌤️  天气: {w_name} | 门槛:{threshold}点 | 倍率:×{mult} | {w_desc}", Color.YELLOW))
            print(f"      你有 {MAX_INVEST} 行动点，猎兔每点稳拿 1 分")
            streak_bonus = self.streak.bonus_per_point()
            if streak_bonus > 0:
                print(color(f"      🔥 连胜 ×{self.streak.count}！猎鹿成功则每点额外 +{streak_bonus}", Color.GREEN))
            try:
                choice = input(f"  [{self.label}] 猎鹿投入几点? [0-{MAX_INVEST}]: ").strip()
                invest = int(choice)
                if 0 <= invest <= MAX_INVEST:
                    return invest
                print(color(f"  请输入 0~{MAX_INVEST}", Color.RED))
            except ValueError:
                print(color(f"  请输入数字", Color.RED))
            except (EOFError, KeyboardInterrupt):
                print("\n"); sys.exit(0)

    def observe(self, my_invest, opp_invest, weather, stag_ok):
        self.my_history.append(my_invest)
        self.opp_history.append(opp_invest)
        self.weather_history.append(weather)
        self.coop_history.append(stag_ok)
        if stag_ok:
            self.streak.on_success()
        else:
            self.streak.on_fail()
        self.just_used_item = None

    def react(self, stag_ok, event):
        return ""

    def reset(self):
        self.my_history.clear()
        self.opp_history.clear()
        self.weather_history.clear()
        self.coop_history.clear()
        self.items.clear()
        self.streak.reset()
        self.just_used_item = None


class EnhancedRoundResult(NamedTuple):
    round_num: int
    weather: tuple
    p1_invest: int
    p2_invest: int
    p1_item: Item | None
    p2_item: Item | None
    event: RandomEvent | None
    stag_ok: bool
    p1_score: int
    p2_score: int
    p1_streak: int
    p2_streak: int
    event_msg: str


class EnhancedStagHuntGame:
    def __init__(self, p1, p2, rounds: int = 10):
        self.p1 = p1
        self.p2 = p2
        self.total_rounds = rounds
        self.history: list[EnhancedRoundResult] = []
        # 分配道具
        p1.give_items(random_items(2))
        p2.give_items(random_items(2))

    def play_round(self, r: int) -> EnhancedRoundResult:
        weather = Weather.random_draw()

        # ── 道具使用阶段 ──
        p1_item = self.p1.choose_item(weather, getattr(self.p2, 'my_history', []))
        if p1_item: self.p1.use_item(p1_item)
        p2_item = self.p2.choose_item(weather, getattr(self.p1, 'my_history', []))
        if p2_item: self.p2.use_item(p2_item)

        # ── 投入决策阶段（侦查镜效果） ──
        if p1_item == ITEM_SCOUT:
            p2_invest_hint = self.p2.choose(weather)
        if p2_item == ITEM_SCOUT:
            p1_invest_hint = self.p1.choose(weather)

        i1 = self.p1.choose(weather)
        i2 = self.p2.choose(weather)

        # 精钢箭效果: 投入+1
        if p1_item == ITEM_ARROW: i1 = min(i1 + 1, MAX_INVEST)
        if p2_item == ITEM_ARROW: i2 = min(i2 + 1, MAX_INVEST)

        # 诱鹿草效果: 门槛-1
        _, threshold, mult, _ = weather
        if p1_item == ITEM_BAIT: threshold -= 1
        if p2_item == ITEM_BAIT: threshold -= 1
        threshold = max(1, threshold)

        # 神射手效果: 倍率+2
        if p1_item == ITEM_SNIPER: mult += 2
        if p2_item == ITEM_SNIPER: mult += 2

        total = i1 + i2
        stag_ok = total >= threshold

        # 连胜加成
        streak_bonus1 = self.p1.streak.bonus_per_point() if stag_ok else 0
        streak_bonus2 = self.p2.streak.bonus_per_point() if stag_ok else 0

        # 猎鹿收益
        stag1 = i1 * (mult + streak_bonus1) if stag_ok else 0
        stag2 = i2 * (mult + streak_bonus2) if stag_ok else 0

        # 保险符: 失败返还一半
        if not stag_ok and p1_item == ITEM_SHIELD:
            stag1 = (i1 * 1) // 2  # 返还一半（按兔肉价）
        if not stag_ok and p2_item == ITEM_SHIELD:
            stag2 = (i2 * 1) // 2

        # 猎兔收益
        hare1 = (MAX_INVEST - i1) * 1
        hare2 = (MAX_INVEST - i2) * 1

        s1 = stag1 + hare1
        s2 = stag2 + hare2

        # ── 随机事件阶段 ──
        event = trigger_random_event()
        event_msg = ""
        event_delta1 = event_delta2 = 0
        if event:
            state = {"weather": weather, "double_round": False, "merchant_offer": False}
            event_delta1, event_delta2, event_msg = event.apply_fn(state)
            # 双倍彩虹
            if state.get("double_round"):
                s1 *= 2
                s2 *= 2
            # 商人（AI 和人类都会在结算后处理）
            if state.get("merchant_offer"):
                # 简化：商人事件直接加分表示"买了道具的价值"
                # 人类玩家在显示时特殊处理
                pass

        # 幸运符: 收益×1.5
        if p1_item == ITEM_LUCKY: s1 = int(s1 * 1.5)
        if p2_item == ITEM_LUCKY: s2 = int(s2 * 1.5)

        s1 += event_delta1
        s2 += event_delta2
        s1 = max(0, s1)
        s2 = max(0, s2)

        self.p1.observe(i1, i2, weather, stag_ok)
        self.p2.observe(i2, i1, weather, stag_ok)

        result = EnhancedRoundResult(
            r, weather, i1, i2, p1_item, p2_item,
            event, stag_ok, s1, s2,
            self.p1.streak.count, self.p2.streak.count,
            event_msg
        )
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
        total_inv = r.p1_invest + r.p2_invest
        status = color("✅ 猎鹿成功!", Color.GREEN) if r.stag_ok else color("❌ 猎鹿失败", Color.RED)

        # 基础行
        parts = [f"第{r.round_num:2d}轮 {w_name}"]
        parts.append(f"你🦌{r.p1_invest}点 对🦌{r.p2_invest}点 (总{total_inv}/{threshold})")
        parts.append(status)

        # 道具使用
        if r.p1_item:
            parts.append(f"你用了{r.p1_item.icon}")
        if r.p2_item:
            parts.append(f"对手用了{r.p2_item.icon}")

        # 连胜
        if r.p1_streak >= 2:
            parts.append(f"你🔥×{r.p1_streak}")
        if r.p2_streak >= 2:
            parts.append(f"对🔥×{r.p2_streak}")

        print("  " + " │ ".join(parts))
        print(f"        得分: 你 {r.p1_score:2d}  |  对手 {r.p2_score:2d}")

        # 事件消息
        if r.event_msg:
            print(color(f"        ⚡ 事件: {r.event_msg}", Color.YELLOW))

        # 个性反应
        react1 = self.p1.react(r.stag_ok, r.event)
        react2 = self.p2.react(r.stag_ok, r.event)
        if react1 and hasattr(self.p1, 'personality'):
            print(f"        {self.p1.personality().split('—')[0].strip()}: \"{react1}\"")
        if react2 and hasattr(self.p2, 'personality'):
            print(f"        {self.p2.personality().split('—')[0].strip()}: \"{react2}\"")

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
    print(color("  ── 增强模式 v2 规则 ──", Color.YELLOW + Color.BOLD))
    print(f"  • 每轮 {MAX_INVEST} 行动点，秘密分配猎鹿投入 (0~{MAX_INVEST})")
    print(f"  • 剩余自动猎兔，每点稳拿 1 分")
    print(f"  • 总投入 ≥ 门槛 → 猎鹿成功，投入 × 倍率 + 连胜加成")
    print(f"  • 总投入 < 门槛 → 猎鹿失败，投入血本无归")
    print()
    print(color("  🎒 道具 (开局随机 2 个，一次性使用):", Color.CYAN))
    for it in Item.all_items:
        print(f"     {it.icon} {it.name} — {it.effect_desc}")
    print()
    print(color("  ⚡ 随机事件 (每轮 18% 概率):", Color.MAGENTA))
    for evt in RandomEvent.all_events:
        print(f"     {evt.icon} {evt.name} — {evt.desc}")
    print()
    print(color("  🔥 连胜加成:", Color.GREEN))
    print(f"     连续猎鹿成功 → ×2:+1/点  ×3:+2/点  ×4+:+3/点")
    print(f"     猎鹿失败 → 连胜归零")
    print()
    print(color("  ── 天气影响 ──", Color.YELLOW))
    print(f"  ☀️ 晴天(30%): 门槛 2, 倍率 ×6")
    print(f"  🌥️ 多云(40%): 门槛 3, 倍率 ×4")
    print(f"  🌧️ 暴雨(30%): 门槛 4, 倍率 ×3")
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
    item_count = sum(1 for r in result.history if r.p1_item or r.p2_item)
    evt_count = sum(1 for r in result.history if r.event)
    print(f"  平均猎鹿投入: {avg_stag:.1f}点 | 成功: {stag_ok_count}/{result.rounds}轮 | 道具使用: {item_count}次 | 事件: {evt_count}次")
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
    print(color(f"  🆚  增强模式: 你  VS  ???", Color.CYAN + Color.BOLD))
    print(f"     🎒 你获得 2 个随机道具，每轮可选择使用")
    print(f"     ⚡ 每轮可能触发随机事件")
    print(f"     🔥 连续猎鹿成功有递增奖励")
    print()

    game = EnhancedStagHuntGame(human, ai, rounds=rounds)
    result = game.play_all(silent=False)
    print_enhanced_match_summary(result)

    # 揭示AI
    print(color("  ── 🤖 AI 策略揭秘 ──", Color.YELLOW))
    print(f"  策略: {color(ai.name(), Color.BOLD)}")
    print(f"  性格: {ai.personality()}")
    print(f"  说明: {ai.description()}")
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
    print_enhanced_rules()

    while True:
        try:
            rounds = int(input(f"  每场对局轮数 (默认15): ").strip() or "15")
            if rounds > 0: break
        except ValueError:
            pass

    strategies = [cls() for cls in ENHANCED_STRATEGIES]
    scores: dict[str, int] = defaultdict(int)
    all_results: list[EnhancedMatchResult] = []
    personality_wins: dict[str, int] = defaultdict(int)

    n = len(strategies)
    total_matches = n * (n - 1) // 2
    match_count = 0

    print()
    print(color(f"  🏟️  增强锦标赛！{n} 种策略, {total_matches} 场, 每场 {rounds} 轮", Color.CYAN + Color.BOLD))
    print(f"     🎒 道具 + ⚡ 事件 + 🔥 连胜 全开启")
    print()

    for i in range(n):
        for j in range(i + 1, n):
            match_count += 1
            s1, s2 = strategies[i], strategies[j]

            game = EnhancedStagHuntGame(s1, s2, rounds=rounds)
            result = game.play_all(silent=True)

            if result.p1_total > result.p2_total:
                scores[result.p1_name] += 3
                personality_wins[result.p1_name] += 1
            elif result.p2_total > result.p1_total:
                scores[result.p2_name] += 3
                personality_wins[result.p2_name] += 1
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
    print()
    print(color("  ═══════════════════════════════════════", Color.GREEN))
    print(color("        🏆  增强锦标赛排名", Color.GREEN + Color.BOLD))
    print(color("  ═══════════════════════════════════════", Color.GREEN))

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    medals = ["🥇", "🥈", "🥉"]
    for i, (name, score) in enumerate(ranked):
        medal = medals[i] if i < 3 else f"  {i+1}."
        bar = "█" * (score // 2) if score > 0 else ""
        wins = personality_wins.get(name, 0)
        print(f"  {medal} {name:30s} {score:4d} 分 ({wins}胜)  {color(bar, Color.CYAN)}")

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
