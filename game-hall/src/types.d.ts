export interface GameDefinition {
  id: string;
  version: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  categories: string[];
  icon: string;
  route: string;
  status: "available" | "coming-soon";
  theme: string;
  controls: string[];
  scoringType: "score" | "time" | "level" | "wins";
  badge?: string;
  maxLevel?: number;
  multiplayer?: boolean;
}

export interface GameRecord {
  gameId: string;
  highScore: number;
  bestTime?: number;
  highestLevel?: number;
  totalPlays: number;
  totalPlayTime: number;
  lastPlayedAt: string;
  recentScores: number[];
  favorite: boolean;
}

export interface PlayerSettings {
  nickname: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reduceMotion: boolean;
  showHamsterInGames: boolean;
  hamsterAnimationMode: "full" | "simple" | "off";
  hamsterSoundEnabled: boolean;
  hamsterVibrationEnabled: boolean;
  hamsterBubbleFrequency: "normal" | "low" | "quiet";
  hamsterAutoClaimRewards: boolean;
  hamsterShowNumbers: boolean;
  hamsterLobbyCollapsed: boolean;
  hamsterCompanionX: number | null;
  hamsterCompanionY: number | null;
}

export interface HamsterActivity {
  type: "work" | "outing" | "sleep" | "study";
  activityId: string;
  startedAt: string;
  endsAt: string;
  energyCost?: number;
  hungerCost?: number;
  cleanlinessCost?: number;
  rewardClaimed: boolean;
  resultSeed?: string;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  acquiredAt?: string;
}

export interface HamsterStatistics {
  totalFeedings: number;
  totalBaths: number;
  totalPettings: number;
  totalPlaySessions: number;
  totalSleepTime: number;
  totalWorkSessions: number;
  totalOutings: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  miniGamesCompleted: number;
  recordsWitnessed: number;
}

export interface HamsterProfile {
  id: string;
  name: string;
  createdAt: string;
  birthday: string;
  level: number;
  experience: number;
  coins: number;
  affection: number;
  hunger: number;
  cleanliness: number;
  energy: number;
  happiness: number;
  health: number;
  currentState: "idle" | "eating" | "bathing" | "playing" | "sleeping" | "working" | "outing" | "studying" | "resting";
  currentActivity?: HamsterActivity;
  activeOutfitId?: string;
  activeRoomThemeId?: string;
  ownedItems: InventoryItem[];
  achievements: string[];
  statistics: HamsterStatistics;
  lastUpdatedAt: string;
  lastInteractionAt: string;
}

export interface DailyTaskState {
  taskId: string;
  type: string;
  title: string;
  target: number;
  progress: number;
  claimed: boolean;
  date: string;
}

export interface ShopState {
  date: string;
  discountItemId: string;
  discountRate: number;
  purchases: string[];
}

export interface HamsterEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  data?: unknown;
}

export interface HamsterGameRewardState {
  date: string;
  normalCoinsEarned: number;
  extraCoinsEarned: number;
  rewardedRoundIds: string[];
  firstPlayGameIds: string[];
  completedGameIds: string[];
}

export interface HamsterSaveData {
  version: number;
  adopted: boolean;
  profile: HamsterProfile;
  dailyTasks: DailyTaskState[];
  shopState: ShopState;
  eventHistory: HamsterEvent[];
  unlockedContent: string[];
  lastDailyResetDate: string;
  cooldowns: Record<string, string>;
  gameRewardState: HamsterGameRewardState;
}

export interface HamsterActionResult {
  ok: boolean;
  message: string;
  save: HamsterSaveData;
  animation?: string;
  reward?: {
    coins?: number;
    experience?: number;
    itemId?: string;
    quantity?: number;
  };
}

export interface HamsterMiniGameReward {
  coins: number;
  experience: number;
  itemId?: string;
  message: string;
  softCapped: boolean;
}

declare global {
  var CrediusHamsterBalance: any;
}
