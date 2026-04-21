import type { Demo } from "@/types";

// Cultural programming at Jazz Fest 2026.
// Sources:
//  - https://www.nojazzfest.com/louisiana-folklife-village/
//  - https://www.nojazzfest.com/cultural-exchange-artist-demonstrations/
//  - https://www.nojazzfest.com/cultural-exchange-pavilion-exhibits/
// 2026 featured country at the Cultural Exchange Pavilion: Jamaica.

export const demos: Demo[] = [
  // ---- Louisiana Folklife Village: Weekend 1 ----
  // Tent B — The Work of Many Lives: Waterways in Louisiana
  { name: "Duck Carving — John Hacsunda", area: "Louisiana Folklife Village", sub_area: "Tent B — The Work of Many Lives: Waterways in Louisiana", weekend: "1", category: "Craft Demonstration", description: "Lafayette Parish demonstrator." },
  { name: "Miniature Boats — Charles Robin III", area: "Louisiana Folklife Village", sub_area: "Tent B — The Work of Many Lives: Waterways in Louisiana", weekend: "1", category: "Craft Demonstration", description: "St. Bernard Parish demonstrator." },
  { name: "Shrimp Net Making — Charlie Robin IV", area: "Louisiana Folklife Village", sub_area: "Tent B — The Work of Many Lives: Waterways in Louisiana", weekend: "1", category: "Craft Demonstration", description: "St. Bernard Parish demonstrator." },
  { name: "Traditional Boat Building & Cypress Paddles — Ernie Savoie", area: "Louisiana Folklife Village", sub_area: "Tent B — The Work of Many Lives: Waterways in Louisiana", weekend: "1", category: "Craft Demonstration", description: "Center for Traditional Louisiana Boat Building (Lafourche Parish)." },

  // Tent C — Past Meets Pixel (W1)
  { name: "Cultural Zines — Erin Segura", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "1", category: "Digital Folklife", description: "New Orleans demonstrator." },
  { name: "Quilt Documenting — Quilters' Guild of Acadiana", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "1", category: "Digital Folklife", description: "Lafayette Parish demonstrators." },
  { name: "Campfire Conversations", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "1", category: "Digital Folklife", description: "Local demonstrators." },
  { name: "Digital Loom — Weaving Folklife Traditions with Technology", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "1", category: "Digital Folklife", description: "Immersive digital experience exploring folklife through new media." },

  // Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration (W1)
  { name: "Social Aid & Pleasure Club Crafts & Traditions — Wynoka Boudreaux", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "1", category: "Craft Demonstration", description: "Ladies of Unity LLC (Orleans Parish)." },
  { name: "Black Masking Indian Crafts & Traditions — Big Chief Victor Harris", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "1", category: "Craft Demonstration", description: "Spirit of Fi Yi Yi & the Mandingo Warriors (Orleans Parish)." },
  { name: "Mardi Gras Porch Floats — René Pierre", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "1", category: "Craft Demonstration", description: "Orleans Parish demonstrator." },
  { name: "Día de los Muertos Altar — Cynthia Ramirez", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "1", category: "Craft Demonstration", description: "Orleans Parish demonstrator." },

  // Tent G — Architectural Trades: Master Building Arts (W1)
  { name: "Restoration Carpentry — Dwayne Broussard", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "1", category: "Craft Demonstration", description: "St. Mary Parish demonstrator." },
  { name: "Lathe Woodturning — Marvin Hirsch & John Hartsock", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "1", category: "Craft Demonstration", description: "Orleans Parish demonstrators." },
  { name: "Plasterwork — Jeff Porée", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "1", category: "Craft Demonstration", description: "Orleans Parish demonstrator." },
  { name: "Architectural Iron Work — Darryl Reeves", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "1", category: "Craft Demonstration", description: "Orleans Parish demonstrator." },
  { name: "Slate and Copper Roofing — Lionel Smith, Jr.", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "1", category: "Craft Demonstration", description: "Jefferson Parish demonstrator." },

  // ---- Louisiana Folklife Village: Weekend 2 ----
  // Tent B — Made by Hand: Crafts of Everyday Life
  { name: "Net Making — Carl Parfait", area: "Louisiana Folklife Village", sub_area: "Tent B — Made by Hand: Crafts of Everyday Life", weekend: "2", category: "Craft Demonstration", description: "Terrebonne Parish demonstrator." },
  { name: "Cajun Accordions — Clarence 'Junior' Martin", area: "Louisiana Folklife Village", sub_area: "Tent B — Made by Hand: Crafts of Everyday Life", weekend: "2", category: "Craft Demonstration", description: "Lafayette Parish demonstrator." },
  { name: "Quilting — Cecelia Pedescleaux", area: "Louisiana Folklife Village", sub_area: "Tent B — Made by Hand: Crafts of Everyday Life", weekend: "2", category: "Craft Demonstration", description: "Jefferson Parish demonstrator." },
  { name: "Dulac Sewing Circle — Candice Chauvin", area: "Louisiana Folklife Village", sub_area: "Tent B — Made by Hand: Crafts of Everyday Life", weekend: "2", category: "Craft Demonstration", description: "Terrebonne Parish demonstrator." },

  // Tent C — Past Meets Pixel (W2)
  { name: "Digital Folklore — Ashlee Wilson, Prairie des Femmes", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "2", category: "Digital Folklife", description: "New Orleans demonstrator." },
  { name: "Language Lounge — Houma Language Project", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "2", category: "Digital Folklife", description: "Louisiana Gulf South." },
  { name: "Language & Culture Revitalization — Tunica-Biloxi Cultural Division", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "2", category: "Digital Folklife", description: "Avoyelles Parish." },
  { name: "Campfire Conversations (W2)", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "2", category: "Digital Folklife", description: "Local demonstrators." },
  { name: "Digital Loom — Weaving Folklife Traditions with Technology (W2)", area: "Louisiana Folklife Village", sub_area: "Tent C — Past Meets Pixel", weekend: "2", category: "Digital Folklife", description: "Immersive digital experience exploring folklife through new media." },

  // Tent D — Laissez Les Bons Temps Rouler (W2)
  { name: "Louisiana Mardi Gras Indian Crafts & Traditions — Tyrone Casby", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "2", category: "Craft Demonstration", description: "Mohawk Hunters (Orleans Parish)." },
  { name: "Social Aid & Pleasure Club Crafts & Traditions — Kevin Dunn", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "2", category: "Craft Demonstration", description: "Orleans Parish demonstrator." },
  { name: "Cartonería Mexicana — Krewe De Mayahuel", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "2", category: "Craft Demonstration", description: "Orleans Parish krewe." },
  { name: "Muses Glitter Shoes — Krewe of Muses", area: "Louisiana Folklife Village", sub_area: "Tent D — Laissez Les Bons Temps Rouler: Ritual and Celebration", weekend: "2", category: "Craft Demonstration", description: "Orleans Parish krewe." },

  // Tent G — Architectural Trades (W2)
  { name: "Preservation Trades — Karina Roca", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "2", category: "Craft Demonstration", description: "Preservation Resource Center of New Orleans, New Orleans Master Crafts Guild (Orleans Parish)." },
  { name: "Stained Glass — Attenhofer's Stained Glass", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "2", category: "Craft Demonstration", description: "Jefferson Parish." },
  { name: "Wooden Window Restoration — NOLA Wood Windows", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "2", category: "Craft Demonstration", description: "Orleans Parish." },
  { name: "Blacksmithing — Russ Forshag", area: "Louisiana Folklife Village", sub_area: "Tent G — Architectural Trades: Master Building Arts", weekend: "2", category: "Craft Demonstration", description: "Tangipahoa Parish." },

  // Special Folklife programming
  { name: "Mariachi Jalisco", area: "Louisiana Folklife Village", sub_area: "Heart of the village", weekend: "2", category: "Performance", description: "Mariachi performance. Sunday, May 3 at 1:20 PM." },
  { name: "Past Meets Pixel Tent (overview)", area: "Louisiana Folklife Village", sub_area: "Tent C", weekend: "both", category: "Digital Folklife", description: "Space where time-honored traditions meet the digital age. Cultural zines, digital heritage archives, online folklore platforms, campfire conversations, and a digital wall on social media's role in preserving traditions." },

  // ---- Cultural Exchange Pavilion — Jamaica Artist Demonstrations ----
  // Weekend 1 only
  { name: "Cleark 'Nurse' James — Sign Painter", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "1", category: "Artist Demonstration", description: "Negril, Jamaica. One of Jamaica's most celebrated hand-painted sign artists; three decades of work shown across Japan, the U.S., and Europe. 11 AM–6 PM." },
  { name: "Taj Francis — Muralist", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "1", category: "Artist Demonstration", description: "Kingston, Jamaica. Illustrator and graphic designer; large-scale murals exploring African Caribbean identity through a surrealist lens. Work featured in Vanity Fair, Vice; clients include HBO, Universal Studios, Samsung. 11 AM–6 PM." },
  { name: "Kokab Zohoori-Dossa — Visual Artist", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "1", category: "Artist Demonstration", description: "Kingston, Jamaica. Multidisciplinary artist focused on textiles using embroidery, crochet, fabric, and beadwork. 11 AM–6 PM." },

  // Both Weekends
  { name: "Omar 'Sheldon' Daley & Lavern Evans — Straw Weaving", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "both", category: "Artist Demonstration", description: "Leamington Division, Westmoreland, Jamaica. Founders of First Straw — hand-woven home décor, accessories, and functional items. 11 AM–6 PM." },
  { name: "Rushane 'Bug' Drummond — Sign Painter", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "both", category: "Artist Demonstration", description: "Withorn, Westmoreland, Jamaica. Hand-painted dancehall posters, party boards, commercial signs, and Ludi boards. 11 AM–6 PM." },
  { name: "Dana Baugh — Ceramic Artist", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "both", category: "Artist Demonstration", description: "Savanna-la-Mar, Westmoreland, Jamaica. Handcrafted, culturally-inspired ceramics and porcelain tableware inspired by Jamaica's culinary heritage. 11 AM–6 PM." },

  // Weekend 2 only
  { name: "Matthew McCarthy — Multimedia & Installation Artist", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", weekend: "2", category: "Artist Demonstration", description: "Kingston, Jamaica. Work influenced by the aesthetics of Jamaican music culture. BFA, Edna Manley College; 2019 Jamaica Prime Minister's Youth Award. 11 AM–6 PM." },

  // ---- Cultural Exchange Pavilion — Exhibits ----
  { name: "FACES OF HERITAGE — Patrick Planter", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", sub_area: "Exhibit", weekend: "both", category: "Exhibit", description: "Photography exhibition featuring 24 portraits by Jamaican photographer Patrick Planter (Kingston, now based in Switzerland). Simple, striking compositions capturing people and everyday scenes of Jamaican life. 11 AM–6 PM both weekends." },
  { name: "SERIOUS TINGS AGO HAPPEN — Maxine Walters & Matthew McCarthy", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", sub_area: "Exhibit", weekend: "both", category: "Exhibit", description: "Multimedia installation combining Walters' collection of 4,000+ hand-painted street posters for parties and concerts with McCarthy's original artwork. Explores Jamaica's dancehall visual culture through signage, typography, and street art." },
  { name: "STAGE BACKDROP — Natasha Cunningham", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", sub_area: "Exhibit", weekend: "both", category: "Exhibit", description: "Visual design for the pavilion stage by Kingston-based collage portrait artist. Work has appeared on Adobe's Photoshop splash screen and for Netflix and Apple." },
  { name: "THE SISTERS OF MERCY IN JAMAICA AND THE ALPHA BOYS SCHOOL COLLAGE", area: "Sandals Resorts Jamaica Cultural Exchange Pavilion", sub_area: "Exhibit", weekend: "both", category: "Exhibit", description: "Historical exhibition on the Alpha Boys School (founded 1880, managed by Sisters of Mercy since 1890). Produced generations of jazz, ska, and reggae musicians including The Skatalites and Yellowman." },
];
