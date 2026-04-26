export type FestivalDay =
  | "Thu Apr 23"
  | "Fri Apr 24"
  | "Sat Apr 25"
  | "Sun Apr 26"
  | "Thu Apr 30"
  | "Fri May 1"
  | "Sat May 2"
  | "Sun May 3";

export interface Artist {
  artist_name: string;
  stage: string;
  day: FestivalDay;
  start_time: string; // "HH:MM" 24h
  end_time: string; // "HH:MM" 24h
  bio: string;
  genre: string;
}

export interface Stage {
  stage_name: string;
  description: string;
}

export interface Vendor {
  vendor_name: string;
  location_description: string;
  food_items: string[];
  category: string;
}

export interface Demo {
  name: string;
  area: string;        // e.g. "Louisiana Folklife Village", "Cultural Exchange Pavilion"
  sub_area?: string;   // e.g. "Tent B", "Stage Backdrop"
  weekend: "1" | "2" | "both";
  category: string;    // e.g. "Craft Demonstration", "Exhibit", "Performance"
  description: string;
}

export interface FAQ {
  topic: string;       // e.g. "Tickets", "Transportation", "Payment"
  question: string;
  answer: string;
  // Keywords to help the intent router find this FAQ.
  keywords: string[];
}

export type Intent =
  | "artist_lookup"
  | "stage_lookup"
  | "now_playing"
  | "food_lookup"
  | "food_recommendations"
  | "artist_bio"
  | "day_lookup"
  | "next_on_stage"
  | "prev_on_stage"
  | "genre_lookup"
  | "time_window"
  | "conflict_lookup"
  | "cultural_lookup"
  | "faq_lookup"
  | "headliner_lookup"
  | "surprise_me"
  | "subjective_recommendation"
  | "unknown";

// When a handler asks a follow-up question (e.g. "which Thursday?",
// "food, music, or culture?"), it returns a PendingDisambiguation so the
// next turn can resolve it. Discriminated union — add new kinds as needed.
export type PendingDisambiguation =
  | { kind: "day"; options: FestivalDay[]; originalQuery: string }
  | { kind: "surprise" };

// Active conversation memory. The client sends the previous context with
// every request and stores the AnswerResult.updatedContext as the new
// state. This is what makes follow-ups like "who is he?" / "what stage?"
// resolvable without naming the subject again.
export interface AnswerContext {
  // The last artist the assistant talked about. Resolves pronouns ("him",
  // "her", "them", "they", "that band") and bare follow-ups ("what stage?").
  lastArtist?: string;
  // The last stage the assistant resolved. Resolves "there", "that stage".
  lastStage?: string;
  // The last day the assistant resolved. Resolves "that day", "then".
  lastDay?: FestivalDay;
  // The last clock time the assistant resolved (HH:MM 24h). Powers
  // "what else is playing then?" follow-ups.
  lastTime?: string;
  // The previous turn's intent. Lets the bot reason about flow — e.g. shift
  // from music to "what about food?".
  lastIntent?: Intent;
  // If the previous turn asked a follow-up ("which day?"), this carries
  // the options and original query so a short reply like "23" / "first" / "music" resolves.
  pending?: PendingDisambiguation;
}

export interface AnswerResult {
  intent: Intent;
  response: string;
  // Per-field resolutions (kept for backwards compatibility with the
  // existing client). New code should prefer `updatedContext`.
  resolvedArtist?: string;
  resolvedStage?: string;
  resolvedDay?: FestivalDay;
  resolvedTime?: string;
  // If the handler asked a follow-up question, client stashes this and sends
  // it back on the next turn as context.pending.
  pending?: PendingDisambiguation;
  // Full new context to store on the client. Already merges any prior
  // context with what this turn resolved. Frontend can replace its state
  // wholesale with this value.
  updatedContext?: AnswerContext;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
