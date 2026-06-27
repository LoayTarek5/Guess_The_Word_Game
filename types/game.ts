/**
 * Shared game types used by both the server (game backend) and the
 * browser client. These are type-only definitions, erased at build time,
 * so they can be imported with `import type` from either side.
 */

export type LetterStatus = "correct" | "present" | "absent";

export interface LetterFeedback {
  letter: string;
  status: LetterStatus;
}

export type GameStatus =
  | "waiting"
  | "active"
  | "paused"
  | "completed"
  | "abandoned";

export type RoundEndReason = "correct_guess" | "max_tries" | "time_expired";

export interface GamePlayerState {
  userId: string;
  username: string;
  avatar: string;
  score: number;
  wordsGuessed: number;
  isCurrentTurn: boolean;
}

export interface GameSettingsState {
  wordLength: number;
  maxTries: number;
  difficulty: string;
  language: string;
  roundsToWin: number;
  timePerRound: number;
}

export interface CurrentTurnInfo {
  userId: string;
  username: string;
  avatar?: string;
}

/** Full game state served to a client (the target word is never included). */
export interface GameStatePayload {
  gameId: string;
  status: GameStatus;
  currentRound: number;
  currentTurn: CurrentTurnInfo;
  wordLength: number;
  maxTries: number;
  currentAttempts: number;
  hint?: string;
  category?: string;
  players: GamePlayerState[];
  settings: GameSettingsState;
  roundStartTime?: string | Date;
}

/** Broadcast to a room when a game starts. */
export interface GameStartedPayload {
  gameId: string;
  roomId: string;
  roomCode?: string;
  status: GameStatus;
  currentRound: number;
  currentTurn: string;
  roundsToWin: number;
  timePerRound: number;
  wordLength: number;
  maxTries: number;
  players: GamePlayerState[];
  settings: GameSettingsState;
  roundStartTime: string | Date;
}

export interface GuessResultPayload {
  guess: string;
  feedback: LetterFeedback[];
  isCorrect: boolean;
  attempts: number;
  maxTries: number;
  userId: string;
  username: string;
}

export interface TurnChangePayload {
  currentTurn: string;
  username: string;
}

export interface WinnerInfo {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
}

export interface FinalScore {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  wordsGuessed: number;
}

export interface NextRoundInfo {
  roundNumber: number;
  wordLength: number;
  currentTurn: string;
  startTime: string | Date;
}

export interface RoundCompletePayload {
  roundNumber: number;
  word: string;
  winner: WinnerInfo | null;
  reason: RoundEndReason | null;
  gameComplete: boolean;
  nextRound?: NextRoundInfo;
  finalScores?: FinalScore[];
  overallWinner?: string | null;
  timestamp?: string | Date;
}

export interface GameOverPayload {
  gameId?: string;
  winner: WinnerInfo | null;
  finalScores: FinalScore[];
  reason?: RoundEndReason | null;
  timestamp?: string | Date;
}

export interface ScoreUpdatePayload {
  scores: Array<{ userId: string; score: number; wordsGuessed: number }>;
  timestamp?: string | Date;
}

export interface TimerUpdatePayload {
  timeRemaining: number;
  timestamp?: string | Date;
}

export interface GameErrorPayload {
  message: string;
}

export interface PlayerConnectionPayload {
  userId: string;
  username: string;
  timestamp?: string | Date;
}

/* ----- client -> server ----- */

export interface SubmitGuessPayload {
  gameId: string;
  guess: string;
}

export interface JoinGamePayload {
  gameId: string;
}

export interface RequestStatePayload {
  gameId: string;
}

/** Names of every game socket event, grouped by direction. */
export interface ServerToClientGameEvents {
  "game:started": GameStartedPayload;
  "game:stateUpdate": GameStatePayload;
  "game:guessResult": GuessResultPayload;
  "game:turnChange": TurnChangePayload;
  "game:roundComplete": RoundCompletePayload;
  "game:over": GameOverPayload;
  "game:scoreUpdate": ScoreUpdatePayload;
  "game:timerUpdate": TimerUpdatePayload;
  "game:timeExpired": { message: string; timestamp?: string | Date };
  "game:error": GameErrorPayload;
  "game:playerDisconnected": PlayerConnectionPayload;
  "game:playerReconnected": PlayerConnectionPayload;
}

export interface ClientToServerGameEvents {
  "game:join": JoinGamePayload;
  "game:requestState": RequestStatePayload;
  "game:submitGuess": SubmitGuessPayload;
}
