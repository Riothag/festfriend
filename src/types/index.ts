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
  | "unknown";

// When a handler asks a follow-up question (e.g. "which Thursday?"),
// it returns a PendingDisambiguation so the next turn can resolve it.
export interface PendingDisambiguation {
  kind: "day";
  options: FestivalDay[];
  originalQuery: string;
}

export interface AnswerContext {
  // The last artist the assistant talked about, used to resolve pronouns
  // like "them", "they", "that band" in follow-up questions.
  lastArtist?: string;
  // If the previous turn asked a follow-up ("which day?"), this carries
  // the options and original query so a short reply like "23" or "first" works.
  pending?: PendingDisambiguation;
}

export interface AnswerResult {
  intent: Intent;
  response: string;
  // If the response is artist-specific, the client stores this as the new
  // conversation "lastArtist" for follow-up queries.
  resolvedArtist?: string;
  // If the handler asked a follow-up question, client stashes this and sends
  // it back on the next turn as context.pending.
  pending?: PendingDisambiguation;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
