export interface Memory {
  id: string;
  category: string;
  key: string;
  value: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  started_at: string;
  last_message_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  emotion: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  due_at: string;
  repeat: "once" | "daily" | "weekly";
  completed_at: string | null;
  created_at: string;
}

export type DazyEmotion =
  | "neutral"
  | "affection"
  | "happy"
  | "playful"
  | "empathetic"
  | "curious"
  | "excited"
  | "sad"
  | "serious"
  | "confident";

export type DazyState = "idle" | "listening" | "thinking" | "speaking";

export interface DazyReply {
  response: string;
  emotion: DazyEmotion;
  language: string;
  memory_saved?: { key: string; value: string } | null;
  reminder_set?: { title: string; due_at: string } | null;
  speak: string;
}
