// Curated editor-pick recommendations for subjective queries like
// "what's the best ribs?" or "must-try food". Sourced from:
//   - Ian McNulty, "New dishes to try at Jazz Fest 2026" (NOLA.com)
//   - Gambit Weekly, "6 unsung dishes worth trying"
//   - Crowd-favorite consensus (multiple recap articles, fest-goer threads)
//
// Add or update entries each year — the app reads these directly, no
// runtime scraping. Each pick has multiple `categories` so the same item
// can surface for "best oysters", "must try", or "seafood".

export type RecommendationType = "food" | "drink" | "music";

export interface Recommendation {
  // Tags used for category-aware filtering. Lowercase, hyphen-joined.
  categories: string[];
  // Dish, drink, or artist name as it should display.
  title: string;
  // Vendor / stage / venue.
  vendor: string;
  // Physical location at the festival.
  location: string;
  // Attribution for credibility — shown in the response.
  source: string;
  // 1-sentence rationale.
  reason: string;
  type: RecommendationType;
}

export const recommendations: Recommendation[] = [
  // ---- Ian McNulty 2026 picks (NOLA.com) ----
  {
    categories: ["oysters", "seafood", "must-try", "new-2026"],
    title: "Charbroiled Oysters",
    vendor: "Lady Nellie Oyster Farm",
    location: "Heritage Square",
    source: "Ian McNulty (NOLA.com)",
    reason: "Chile butter, parmesan, pecorino — McNulty says \"run to\" these.",
    type: "food",
  },
  {
    categories: ["jamaican", "savory", "must-try", "new-2026", "small-plate"],
    title: "Spicy Beef Patty",
    vendor: "Palmer's Jamaican Cuisine",
    location: "Congo Square",
    source: "Ian McNulty (NOLA.com)",
    reason: "Hand pie with herb-flecked butter sauce. Jamaican soul food.",
    type: "food",
  },
  {
    categories: ["jamaican", "stew", "must-try", "new-2026"],
    title: "Oxtail Stew",
    vendor: "Afrodisiac",
    location: "Cultural Exchange Pavilion",
    source: "Ian McNulty (NOLA.com)",
    reason: "Tender oxtail in peppery stew with rice and peas. Bring napkins.",
    type: "food",
  },
  {
    categories: ["soup", "creole", "must-try", "new-2026"],
    title: "Turtle Soup",
    vendor: "TCA Brocato",
    location: "Food Area 1",
    source: "Ian McNulty (NOLA.com)",
    reason: "Rich ground turtle with sherry. McNulty couldn't stop eating it.",
    type: "food",
  },
  {
    categories: ["tacos", "fish", "seafood", "new-2026"],
    title: "Baja Fish Tacos",
    vendor: "Tempero's Market Kitchen",
    location: "Food Area 2",
    source: "Ian McNulty (NOLA.com)",
    reason: "Tempura-battered fresh fish with extra-crunch scatter batter.",
    type: "food",
  },
  {
    categories: ["seafood", "appetizer", "shrimp"],
    title: "Fried Green Tomatoes with Shrimp",
    vendor: "Café Dauphine",
    location: "Food Area 2",
    source: "Ian McNulty (NOLA.com)",
    reason: "Flaky-crisp coating over juicy tomato with lightly-dressed boiled shrimp.",
    type: "food",
  },
  {
    categories: ["duck", "small-plate", "new-2026"],
    title: "Cajun Duck Sliders",
    vendor: "CCI Catering",
    location: "Food Area 1",
    source: "Ian McNulty (NOLA.com)",
    reason: "Pulled leg and thigh meat done debris-style.",
    type: "food",
  },
  {
    categories: ["crawfish", "boudin", "small-plate"],
    title: "Crawfish Boudin Ball",
    vendor: "Papa Ninety Catering",
    location: "Food Area 1",
    source: "Ian McNulty (NOLA.com)",
    reason: "Fried boudin with crawfish — a savory bite-sized find.",
    type: "food",
  },
  {
    categories: ["drink", "cocktail", "rum", "new-2026"],
    title: "One Love Punch",
    vendor: "Cultural Exchange Bar",
    location: "Cultural Exchange Pavilion",
    source: "Ian McNulty (NOLA.com)",
    reason: "Rum, passionfruit, coconut water. The drink to beat.",
    type: "drink",
  },

  // ---- Crowd favorites / Jazz Fest classics ----
  {
    categories: ["crawfish", "pasta", "iconic", "must-try"],
    title: "Crawfish Monica",
    vendor: "Big River Foods",
    location: "Food Area 2",
    source: "Crowd favorite",
    reason: "South Louisiana's cousin to mac and cheese. Jazz Fest legend.",
    type: "food",
  },
  {
    categories: ["crawfish", "bread", "iconic", "must-try"],
    title: "Crawfish Bread",
    vendor: "Panaroma Foods",
    location: "Food Area 1",
    source: "Crowd favorite",
    reason: "Handheld classic — almost everyone gets one at least once.",
    type: "food",
  },
  {
    categories: ["po-boy", "pork", "iconic", "must-try"],
    title: "Cochon de Lait Po-Boy",
    vendor: "Walker's BBQ / Love At First Bite",
    location: "Food Area 1",
    source: "Crowd favorite",
    reason: "Slow-roasted pulled pork. Often the longest line for a reason.",
    type: "food",
  },
  {
    categories: ["dessert", "drink", "iconic", "must-try", "sweet"],
    title: "Mango Freeze",
    vendor: "WWOZ Community Radio",
    location: "Food Area 1",
    source: "Crowd favorite",
    reason: "Sweet, frozen, essential when it gets hot. Funds local public radio.",
    type: "food",
  },
  {
    categories: ["pork", "ribs", "bbq"],
    title: "BBQ Pork Ribs",
    vendor: "Down Home Creole Cookin'",
    location: "Heritage Square",
    source: "Crowd favorite",
    reason: "Classic smoky ribs. Their turkey wings are also worth a switch-up.",
    type: "food",
  },
  {
    categories: ["crawfish", "appetizer", "small-plate"],
    title: "Crawfish Strudel",
    vendor: "Caluda's Cottage Catering",
    location: "Food Area 2",
    source: "Crowd favorite",
    reason: "Phyllo-wrapped, creamy, lightly cheesy. Easy to share.",
    type: "food",
  },
  {
    categories: ["crab", "shrimp", "appetizer", "vegetarian-friendly", "small-plate"],
    title: "Fried Bell Pepper Bites Stuffed with Crabmeat & Shrimp",
    vendor: "Café Dauphine",
    location: "Food Area 2",
    source: "Crowd favorite",
    reason: "Bursting with creamy crab and shrimp. Standout small bite.",
    type: "food",
  },
  {
    categories: ["crawfish", "appetizer", "iconic"],
    title: "Crawfish Sack",
    vendor: "Patton's Caterers",
    location: "Food Area 1",
    source: "Crowd favorite",
    reason: "Beggar's-purse pastry fried with crawfish filling.",
    type: "food",
  },
  {
    categories: ["dessert", "beignet", "sweet", "iconic", "must-try"],
    title: "Praline-Stuffed Beignet",
    vendor: "Loretta's Authentic Pralines",
    location: "Heritage Square",
    source: "Crowd favorite",
    reason: "Loretta's stuffed beignets are not to be missed. Sweet pick of the fest.",
    type: "food",
  },
  {
    categories: ["crawfish", "enchilada", "creole"],
    title: "Crawfish Enchilada",
    vendor: "Prejean's Restaurant",
    location: "Food Area 2",
    source: "Crowd favorite",
    reason: "Creamy crawfish enchilada — Prejean's brings their Cajun pheasant gumbo too.",
    type: "food",
  },
  {
    categories: ["po-boy", "pork", "must-try"],
    title: "Cochon de Lait Po-Boy",
    vendor: "Walker's BBQ",
    location: "Food Area 1",
    source: "Gambit Weekly",
    reason: "Repeatedly cited as the single most-iconic Jazz Fest dish.",
    type: "food",
  },
];
