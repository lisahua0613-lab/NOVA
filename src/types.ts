export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
  WIN = 'WIN'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  speed: number;
  radius: number;
  color: string;
}

export interface Missile extends Entity {
  startX: number;
  startY: number;
  progress: number;
}

export interface Enemy extends Entity {
  startX: number;
  startY: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  duration: number;
  elapsed: number;
}

export interface City {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}

export interface Silo {
  id: string;
  x: number;
  y: number;
  ammo: number;
  maxAmmo: number;
}

export const TRANSLATIONS = {
  zh: {
    title: "Lisa Nova",
    start: "开始游戏",
    restart: "重新开始",
    playAgain: "再玩一次",
    gameOver: "城市全毁",
    victory: "防御成功",
    score: "得分",
    round: "关卡",
    ammo: "弹药",
    targetScore: "目标分数",
    cityBonus: "城市存活奖励",
    ammoBonus: "剩余弹药奖励",
    nextRound: "下一轮",
    combo: "连击!",
    loading: "加载中...",
    instructions: "点击屏幕拦截敌方火箭。保护你的城市！",
  },
  en: {
    title: "Lisa Nova",
    start: "Start Game",
    restart: "Restart",
    playAgain: "Play Again",
    gameOver: "All Cities Destroyed",
    victory: "Defense Successful",
    score: "Score",
    round: "Round",
    ammo: "Ammo",
    targetScore: "Target Score",
    cityBonus: "City Survival Bonus",
    ammoBonus: "Ammo Bonus",
    nextRound: "Next Round",
    combo: "COMBO!",
    loading: "Loading...",
    instructions: "Tap anywhere to intercept rockets. Protect your cities!",
  }
};
