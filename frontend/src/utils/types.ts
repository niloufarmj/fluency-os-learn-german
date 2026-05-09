export type ApiErrorShape = { detail?: string };

export type Profile = {
  name?: string;
  email?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | string;
  daily_time_minutes?: number;
  streak?: number;
  best_streak?: number;
  priorities?: string[];
  onboarded?: boolean;
  current_step?: number;
  level_analysis?: string;
};

export type DailyPlanTask =
  | { type: 'vocab_review'; duration_min: number; count: number }
  | { type: 'grammar'; duration_min: number; topic: string; step?: number }
  | { type: 'reading'; duration_min: number; level: string }
  | { type: 'roleplay'; duration_min: number }
  | { type: 'end_of_day_test'; duration_min: number; topic?: string };

export type DailyPlan = {
  tasks: DailyPlanTask[];
};

export type DailyPlanDetailed = {
  date: string;
  level: string;
  focus: string;
  vocab: Array<{ word: string; translation: string; part_of_speech: string; examples: string[] }>;
  grammar: {
    topic: string;
    explanation: string;
    examples: string[];
    exercises: Array<{ sentence: string; answer: string; hint?: string }>;
  };
  reading: {
    title: string;
    theme: string;
    article: string;
    questions: Array<{ q: string; a: string }>;
  };
  roleplay: { scenario_title: string; opening: string; target_phrases: string[] };
  youtube: Array<{ title: string; channel: string; url: string; why_relevant: string }>;
  end_of_day_test_blueprint: { topics: string[]; instructions: string };
};

export type DailyProgress = {
  tasks: { vocab: boolean; grammar: boolean; reading: boolean; roleplay: boolean };
  minutes_tracked: number;
  test: { generated: boolean; completed: boolean; score: number | null; attempts: number };
  completed: boolean;
};

export type PlanTodayResponse = {
  effective_date: string;
  backlog: boolean;
  plan: DailyPlanDetailed;
  progress: DailyProgress;
};

export type EndOfDayTest = {
  questions: Array<
    | { type: 'mc'; prompt: string; options: string[]; answer_index: number; explanation: string }
    | { type: 'short'; prompt: string; answer: string; explanation: string }
  >;
  pass_score: number;
};

export type VocabItem = {
  word: string;
  level?: string;
  next_review?: string;
  interval_days?: number;
  ease_factor?: number;
  sentences?: string[];
  translation?: string;
  part_of_speech?: string;
  ipa?: string;
  added_date?: string;
  last_reviewed?: string;
};

export type LogEntry = {
  date: string;
  type: string;
  active_minutes?: number;
  score?: number;
  transcript?: unknown;
};

export type SyllabusTopic = {
  level: string;
  topic: string;
  description: string;
};

export type Resource = {
  topic?: string;
  channel?: string;
  title?: string;
  url?: string;
};

export type GrammarExplanation = {
  explanation?: string;
  examples?: string[];
  exercises?: Array<{ sentence?: string; answer?: string; hint?: string }>;
};

export type ReadingResult = {
  article?: string;
  questions?: Array<{ q: string; a: string }>;
};

export type TranslateWordResult = {
  word?: string;
  translation?: string;
  part_of_speech?: string;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatScenarioResponse = { reply: string };

export type EndChatReviewResult = {
  mistakes?: Array<{ original: string; correction: string; explanation: string }>;
  score: number;
  summary?: string;
};

