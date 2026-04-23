import type { FAQ } from "@/types";

// FAQ sourced from https://www.nojazzfest.com/faq/.
// `keywords` are used by the intent router to match natural-language questions.
// Keep them lowercase and short.
export const faqs: FAQ[] = [
  {
    topic: "Dates & Hours",
    question: "When and where is Jazz Fest 2026?",
    answer:
      "Thursday, April 23 – Sunday, April 26 & Thursday, April 30 – Sunday, May 3, 2026. Fair Grounds Race Course, 1751 Gentilly Boulevard (10 min from the French Quarter). Gates 11 AM – 7 PM daily.",
    keywords: [
      "dates", "hours", "address", "fair grounds", "location",
      "gate", "gates", "opening",
      // Festival open/close/start/end questions
      "festival start", "festival begin", "festival open", "festival opens",
      "festival close", "festival closes", "festival end", "festival ends", "festival over",
      "festival hours",
      "gates open", "gates close",
      "jazz fest start", "jazz fest begin", "jazz fest end", "jazz fest open", "jazz fest close", "jazz fest hours",
      "when does the festival", "when does jazz fest",
      "what time does the festival", "what time does jazz fest", "what time do gates",
    ],
  },
  {
    topic: "Music",
    question: "Is jazz the only music at Jazz Fest?",
    answer:
      "No. Jazz Fest celebrates all the indigenous music of New Orleans and Louisiana: blues, R&B, gospel, Cajun, zydeco, Afro-Caribbean, folk, Latin, rock, rap, country, bluegrass, and everything in between.",
    keywords: ["only jazz", "what music", "music types", "what kind of music", "just jazz"],
  },
  {
    topic: "Schedule",
    question: "When is the performance schedule released?",
    answer:
      "The full schedule grid, known as 'the Cubes,' is typically available about one month before the festival. The lineup is announced earlier.",
    keywords: ["schedule released", "cubes", "when announced", "schedule available"],
  },
  {
    topic: "Tickets",
    question: "How much do tickets cost and where do I buy them?",
    answer:
      "Tickets go on sale at the same time as the lineup announcement. Buy on the official site at nojazzfest.com/tickets.",
    keywords: ["tickets", "ticket price", "buy tickets", "admission", "cost", "how much"],
  },
  {
    topic: "Payment",
    question: "Is Jazz Fest cashless?",
    answer:
      "Yes. Every ticket, food, beverage, craft, and merchandise booth is cashless. Accepted: all major credit cards, debit cards, prepaid cards, Apple Pay, Google Pay, and Samsung Pay.",
    keywords: ["cashless", "cash", "payment", "credit card", "debit card", "apple pay", "google pay", "samsung pay", "pay", "forms of payment"],
  },
  {
    topic: "Transportation",
    question: "How do I get to the Fair Grounds?",
    answer:
      "Fair Grounds Race Course, 1751 Gentilly Boulevard. The Jazz Fest Express shuttle is the only shuttle that drops off and picks up inside the gates. Departure points: French Quarter (Steamboat Natchez Dock), Sheraton New Orleans, Hyatt Regency, and Wisner Lot (free parking).",
    keywords: ["how to get there", "transportation", "directions", "shuttle", "jazz fest express", "express shuttle", "bus", "get there"],
  },
  {
    topic: "Transportation",
    question: "Is there on-site parking?",
    answer:
      "Very limited. On-site parking is ONLY available with Big Chief, Grand Marshal, or Krewe of Jazz Fest VIP packages (pre-purchased). Everyone else: use the Jazz Fest Express, rideshare to the drop-off perimeter, or bike (free bicycle parking near Gentilly Blvd and Sauvage St gates).",
    keywords: ["parking", "park", "onsite parking", "on-site parking", "drive", "drive there", "park at"],
  },
  {
    topic: "Transportation",
    question: "Can I take an Uber or Lyft?",
    answer:
      "Rideshares can't drop off or pick up within a perimeter around the Fair Grounds — the City excludes them to lessen neighborhood impact. Use the Jazz Fest Express or a taxi stand.",
    keywords: ["uber", "lyft", "rideshare", "ride share", "ride-share", "taxi"],
  },
  {
    topic: "Transportation",
    question: "Where are the taxi stands?",
    answer:
      "Stallings Playground (Gentilly Blvd across from the Festival entrance) and Walter Wolfman Washington Memorial Park (Esplanade Avenue at Mystery Street).",
    keywords: ["taxi stand", "taxi", "cab"],
  },
  {
    topic: "Transportation",
    question: "Can I bike to Jazz Fest?",
    answer:
      "Yes. Limited free bicycle parking is available near the Gentilly Boulevard and Sauvage Street pedestrian gates.",
    keywords: ["bike", "bicycle", "cycle", "biking"],
  },
  {
    topic: "Accessibility",
    question: "Is Jazz Fest accessible for people with disabilities?",
    answer:
      "Yes. Jazz Fest welcomes people of all abilities. See the Accessibility page on the official site for ADA viewing areas, accessible routes, and accommodations.",
    keywords: ["accessibility", "accessible", "disability", "disabilities", "ada", "wheelchair"],
  },
  {
    topic: "Accessibility",
    question: "Is there a nursing / pumping area for mothers?",
    answer:
      "Yes. A dedicated area for mothers to pump or nurse is on the west side of the Grandstand, 3rd floor. Changing stations are in the 1st-floor women's restrooms of the Grandstand.",
    keywords: ["pump", "pumping", "nurse", "nursing", "breastfeed", "breastfeeding", "breastmilk", "mother", "mothers", "baby"],
  },
  {
    topic: "Lost & Found",
    question: "Where is lost & found?",
    answer:
      "The Information Booth / Lost & Found tent is on the pedestrian walkway behind the Shell Gentilly Stage. After hours or between weekends: text or call (504) 320-2899 or email lost@nojazzfest.com.",
    keywords: ["lost", "found", "lost and found", "lost something", "where's my", "can't find"],
  },
  {
    topic: "What to Bring",
    question: "What can I bring to Jazz Fest?",
    answer:
      "Jazz Fest publishes a visual allowed / prohibited list. Generally allowed: small bags, strollers, blankets, empty water bottles, cameras (non-pro), sunscreen, hats. Generally prohibited: coolers, outside food and drink, umbrellas, weapons, pro-grade cameras with detachable lenses, drones, pets (service animals OK). See the official 'What You Can Bring' page for the current-year list before you go.",
    keywords: ["bring", "what can i bring", "allowed", "prohibited", "banned", "cooler", "coolers", "camera", "cameras", "backpack", "bag", "stroller", "umbrella", "water bottle", "pets", "dog", "chairs"],
  },
  {
    topic: "What to Bring",
    question: "What should I wear?",
    answer:
      "Cool, unrestrictive clothing — lightweight cotton is great. Sunglasses, sunscreen, and a wide-brim hat or visor are essentials. Wear comfortable shoes — you'll be walking a lot.",
    keywords: ["wear", "dress", "what to wear", "clothing", "clothes", "sunscreen", "hat", "shoes", "prepare"],
  },
  {
    topic: "What to Bring",
    question: "What's the weather like at Jazz Fest?",
    answer:
      "New Orleans weather in late April / early May can swing from pleasantly warm to uncomfortably hot. Dress light, bring sunscreen, and stay hydrated.",
    keywords: ["weather", "hot", "temperature", "rain", "raining", "sun", "sunny"],
  },
  {
    topic: "Accommodations",
    question: "Where should I stay?",
    answer:
      "The official host hotel is the Sheraton New Orleans. Call 504-595-5500 or 800-253-6156. Book early — rooms fill up well in advance. New Orleans & Company can also help with accommodations.",
    keywords: ["hotel", "hotels", "stay", "accommodation", "accommodations", "lodging", "sheraton", "where to stay"],
  },
  {
    topic: "Food",
    question: "Are there vegan / vegetarian options?",
    answer:
      "Yes. Sweet Soulfood Vegan Cuisine (Food Area 2) is fully vegan, and several vendors list vegan/vegetarian items (e.g. Bennachin, Smoke Street's BBQ Jackfruit Sandwich, Douglas' Vegetarian Red Beans & Rice, Roasted Root).",
    keywords: ["vegan", "vegetarian", "plant based", "plant-based", "meat free", "veggie"],
  },
  {
    topic: "Food",
    question: "Is the food all just crawfish and alligator?",
    answer:
      "Not at all — though those are delicious. The food areas offer 60+ vendors with everything from Cajun and Creole classics to Vietnamese, Haitian, Mediterranean, Jamaican, vegan, and more.",
    keywords: ["crawfish only", "only crawfish", "alligator", "food variety", "what food", "what kind of food"],
  },
  {
    topic: "Weekend Choice",
    question: "Which weekend is better?",
    answer:
      "You can't go wrong either way. Jazz Fest distributes the music evenly across both weekends.",
    keywords: ["which weekend", "weekend 1", "weekend 2", "first weekend", "second weekend", "best weekend", "better weekend"],
  },
  {
    topic: "Posters & Merch",
    question: "I have an old Jazz Fest poster — is it worth anything?",
    answer:
      "Limited-edition Jazz Fest posters are produced by Art4Now. Their website (art4now.com) lists vintage poster values.",
    keywords: ["poster", "posters", "vintage poster", "art4now", "merch value"],
  },
  {
    topic: "Volunteering & Jobs",
    question: "How do I volunteer or work at Jazz Fest?",
    answer:
      "Volunteering: nojazzfest.com/info/volunteering. Job listings: nojazzfest.com/human-resources.",
    keywords: ["volunteer", "volunteering", "work at", "jobs", "job", "employment", "hire"],
  },
  {
    topic: "Apply to Perform",
    question: "How do I apply to perform at Jazz Fest?",
    answer:
      "The application for the 2027 Festival runs June 1 – September 15, 2026. About 85–90% of presented bands are active members of the Louisiana music community.",
    keywords: ["apply to perform", "perform at jazz fest", "audition", "play at jazz fest", "book at jazz fest"],
  },
  {
    topic: "Booth Applications",
    question: "How do I apply for a crafts or food booth?",
    answer:
      "Crafts booth applications for 2027 open in October 2026 (see nojazzfest.com/crafts or email craftsadmin@nojazzfest.com). Food vendor applicants must be full-time Louisiana residents; no self-contained structures; no carnival food items.",
    keywords: ["crafts booth", "craft booth", "food booth", "vendor application", "apply for booth", "sell at jazz fest"],
  },
  {
    topic: "Press & Sponsorship",
    question: "How do I apply for press credentials?",
    answer:
      "Submit a letter of assignment from your editor, a copy of the publication or outlet details, the days you plan to cover, your contact info, and any prior Jazz Fest coverage. Applications open on the official Press page.",
    keywords: ["press", "press credentials", "media", "media credentials", "journalist", "reporter"],
  },
  {
    topic: "Press & Sponsorship",
    question: "Who do I contact about sponsorship?",
    answer:
      "Email sponsorship@nojazzfest.com or write to: Sponsorship Department, New Orleans Jazz & Heritage Festival, One Canal Place, 365 Canal St. Suite 2250, New Orleans, LA 70130.",
    keywords: ["sponsorship", "sponsor", "sponsoring"],
  },
  {
    topic: "Restrooms",
    question: "Where are the bathrooms?",
    answer:
      "Toilets are spread all over the Fair Grounds — you're never far from one. Big clusters: behind the Festival Stage, around Heritage Square (between Blues Tent and Gospel Tent), near the Sauvage pedestrian entrance, behind the Shell Gentilly Stage, near the Sheraton Fais Do-Do Stage, by the Children's Activity Tent, and along both straightaways of the racetrack perimeter. The Grandstand has indoor, air-conditioned restrooms (changing stations are on the 1st floor of the women's room). Full map: /fairgrounds-map.pdf",
    keywords: [
      "bathroom", "bathrooms", "restroom", "restrooms",
      "toilet", "toilets", "potty", "porta potty", "porta-potty", "porta-potties",
      "ladies room", "mens room", "men's room",
      "where can i pee", "need to pee", "pee",
    ],
  },
  {
    topic: "Water",
    question: "Where can I refill my water bottle?",
    answer:
      "Free water refill stations are scattered across the grounds. Reliable spots: behind the Festival Stage, in/near Food Area 1 (center of the grounds), in/near Food Area 2 (left side), by the Children's Activity Tent, around the Grandstand, and along the perimeter walkways. Bring an empty reusable bottle (or any plastic bottle) and stay hydrated. Full map: /fairgrounds-map.pdf",
    keywords: [
      "water", "water bottle", "water bottles", "refill", "refill station", "refill stations",
      "drinking water", "free water", "water fountain", "water fountains",
      "fill up", "fill my bottle", "hydrate", "hydration", "stay hydrated",
    ],
  },
  {
    topic: "Map",
    question: "Where can I find a map of the Fair Grounds?",
    answer:
      "The official 2026 Fair Grounds map is at /fairgrounds-map.pdf. It shows every stage, food area, restroom, water refill station, ADA Access Center, medical tent, and entrance. Save it to your phone before you head in.",
    keywords: [
      "map", "maps", "fairgrounds map", "fair grounds map", "festival map", "site map",
      "show me the map", "where is the map", "where can i find the map",
      "layout", "grounds map", "ground map",
    ],
  },
  {
    topic: "Health & Safety",
    question: "What about COVID-19?",
    answer:
      "COVID-19 is still present and contagious. There is inherent risk of exposure in any public place. By entering Jazz Fest, attendees voluntarily assume all risks related to viruses.",
    keywords: ["covid", "covid-19", "corona", "coronavirus", "masks"],
  },
];
