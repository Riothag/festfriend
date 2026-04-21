import type { Artist } from "@/types";

// Food Heritage Stage — cooking demonstrations at Jazz Fest 2026.
// Sourced from https://www.nojazzfest.com/food-heritage-stage/.
// Reuses the Artist shape: chef name as artist_name, dish + affiliation in bio,
// "Cooking Demo" as genre. Gets pulled in alongside the music schedule so
// stage/day/time intents surface these for free.
export const foodHeritageDemos: Artist[] = [
  // Thursday, April 23
  { artist_name: "Jordan Entwisle — Duck & Dumplings", stage: "Food Heritage Stage", day: "Thu Apr 23", start_time: "11:30", end_time: "12:30", bio: "Duck & Dumplings — Audubon Clubhouse by Dickie Brennan & Co.", genre: "Cooking Demo" },
  { artist_name: "Nicole Mills — Marinated Shrimp with Citrus, Peanuts & Mint", stage: "Food Heritage Stage", day: "Thu Apr 23", start_time: "12:30", end_time: "13:30", bio: "Marinated Shrimp with Citrus, Peanuts & Mint — Peche Seafood Grill", genre: "Cooking Demo" },
  { artist_name: "Ausettua Amor Amenkum — BBQ Tofu", stage: "Food Heritage Stage", day: "Thu Apr 23", start_time: "13:30", end_time: "14:30", bio: "BBQ Tofu — Soul Sisters Creole Vegan Cuisine", genre: "Cooking Demo" },
  { artist_name: "David Hargrove & Teon Reid — Brown Stew Chicken", stage: "Food Heritage Stage", day: "Thu Apr 23", start_time: "14:30", end_time: "15:30", bio: "Brown Stew Chicken — 2brothers1love", genre: "Cooking Demo" },

  // Friday, April 24
  { artist_name: "Devan Giddix — Alligator & Crawfish Rigatoni", stage: "Food Heritage Stage", day: "Fri Apr 24", start_time: "11:30", end_time: "12:30", bio: "Alligator & Crawfish Rigatoni — Dickie Brennan's Bourbon House", genre: "Cooking Demo" },
  { artist_name: "Carla Briggs — Creole Corn Dogs", stage: "Food Heritage Stage", day: "Fri Apr 24", start_time: "12:30", end_time: "13:30", bio: "Creole Corn Dogs — Viola's Heritage Breads", genre: "Cooking Demo" },
  { artist_name: "Farrell Harrison & Christian Hurst — Garlic Shrimp", stage: "Food Heritage Stage", day: "Fri Apr 24", start_time: "13:30", end_time: "14:30", bio: "Garlic Shrimp — Plates Restaurant & Le Moyne Bistro", genre: "Cooking Demo" },
  { artist_name: "John Malone — Louisiana Crawfish & Spring Vegetable with Spoon Bread", stage: "Food Heritage Stage", day: "Fri Apr 24", start_time: "14:30", end_time: "15:30", bio: "Louisiana Crawfish & Spring Vegetable with Spoon Bread — Cochon Restaurant", genre: "Cooking Demo" },

  // Saturday, April 25
  { artist_name: "Anne Churchill — Turtle Soup", stage: "Food Heritage Stage", day: "Sat Apr 25", start_time: "11:30", end_time: "12:30", bio: "Turtle Soup — Mosquito Supper Club", genre: "Cooking Demo" },
  { artist_name: "Poppy Tooker & Sal Sunseri — Creole Oyster Bisque (Celebrating 150 Years of P&J Oyster Co)", stage: "Food Heritage Stage", day: "Sat Apr 25", start_time: "12:30", end_time: "13:30", bio: "Creole Oyster Bisque (Celebrating 150 Years of P&J Oyster Co) — Louisiana Eats! / P&J Oyster Co", genre: "Cooking Demo" },
  { artist_name: "Anh Luu — Viet-Cajun Crawfish Étouffé with Rice", stage: "Food Heritage Stage", day: "Sat Apr 25", start_time: "13:30", end_time: "14:30", bio: "Viet-Cajun Crawfish Étouffé with Rice — Xanh Nola", genre: "Cooking Demo" },
  { artist_name: "Susan Spicer & Eason Barksdale — Fried Eggplant with Shrimp Creole & Sicilian Pasta alla Norma", stage: "Food Heritage Stage", day: "Sat Apr 25", start_time: "14:30", end_time: "15:30", bio: "Fried Eggplant with Shrimp Creole & Sicilian Pasta alla Norma — Rosedale & Common House", genre: "Cooking Demo" },

  // Sunday, April 26
  { artist_name: "Lora Ann Chaisson — Three Sisters", stage: "Food Heritage Stage", day: "Sun Apr 26", start_time: "11:30", end_time: "12:30", bio: "Three Sisters — United Houma Nation", genre: "Cooking Demo" },
  { artist_name: "Sophina Uong — Khmer Pounded Fish Curry", stage: "Food Heritage Stage", day: "Sun Apr 26", start_time: "12:30", end_time: "13:30", bio: "Khmer Pounded Fish Curry — Mister Mao", genre: "Cooking Demo" },
  { artist_name: "Anne Lloyd — Boudin Balls with Potato Chip Crust & Creole Mustard Sauce", stage: "Food Heritage Stage", day: "Sun Apr 26", start_time: "13:30", end_time: "14:30", bio: "Boudin Balls with Potato Chip Crust & Creole Mustard Sauce — Nolavore Catering", genre: "Cooking Demo" },
  { artist_name: "Michael Gulotta — Shrimp Paccheri Pasta with Pistachios, Tomato & Cream", stage: "Food Heritage Stage", day: "Sun Apr 26", start_time: "14:30", end_time: "15:30", bio: "Shrimp Paccheri Pasta with Pistachios, Tomato & Cream — Tana", genre: "Cooking Demo" },

  // Thursday, April 30
  { artist_name: "Michael Friedman & Greg Augarten — Spicy Crab Spaghetti", stage: "Food Heritage Stage", day: "Thu Apr 30", start_time: "11:30", end_time: "12:30", bio: "Spicy Crab Spaghetti — Pizza Delicious", genre: "Cooking Demo" },
  { artist_name: "Jordan Herndon & Amarys Koenig Herndon — Red Bean Chaat", stage: "Food Heritage Stage", day: "Thu Apr 30", start_time: "12:30", end_time: "13:30", bio: "Red Bean Chaat — Palm&Pine", genre: "Cooking Demo" },
  { artist_name: "Chris Borges — Croque Madame", stage: "Food Heritage Stage", day: "Thu Apr 30", start_time: "13:30", end_time: "14:30", bio: "Croque Madame — Charmant", genre: "Cooking Demo" },
  { artist_name: "Lauren Johnson — Curry Oxtails", stage: "Food Heritage Stage", day: "Thu Apr 30", start_time: "14:30", end_time: "15:30", bio: "Curry Oxtails — 14 Parishes Jamaican Restaurant", genre: "Cooking Demo" },

  // Friday, May 1
  { artist_name: "Michael Nelson — Sicilian Tuna Meatballs & Seacuterie Cold Cuts", stage: "Food Heritage Stage", day: "Fri May 1", start_time: "11:30", end_time: "12:30", bio: "Sicilian Tuna Meatballs & Seacuterie Cold Cuts — GW Fins", genre: "Cooking Demo" },
  { artist_name: "Jared Heider — Shrimp & Avocado Salad", stage: "Food Heritage Stage", day: "Fri May 1", start_time: "12:30", end_time: "13:30", bio: "Shrimp & Avocado Salad — Juniors on Harrison", genre: "Cooking Demo" },
  { artist_name: "Keyala Marshall — Original Pecan Pralines", stage: "Food Heritage Stage", day: "Fri May 1", start_time: "13:30", end_time: "14:30", bio: "Original Pecan Pralines — Keyala's Pralines", genre: "Cooking Demo" },
  { artist_name: "Kaala Lawla — Roasted Seafood with Pumpkin & Vegetable Stew", stage: "Food Heritage Stage", day: "Fri May 1", start_time: "14:30", end_time: "15:30", bio: "Roasted Seafood with Pumpkin & Vegetable Stew — Boswell's Jamaican Grill", genre: "Cooking Demo" },

  // Saturday, May 2
  { artist_name: "Chris Montero — Creole Jambalaya", stage: "Food Heritage Stage", day: "Sat May 2", start_time: "11:30", end_time: "12:20", bio: "Creole Jambalaya — The Napoleon House", genre: "Cooking Demo" },
  { artist_name: "Christopher Vazquez — Louisiana Crab & Watermelon Gazpacho", stage: "Food Heritage Stage", day: "Sat May 2", start_time: "12:20", end_time: "13:30", bio: "Louisiana Crab & Watermelon Gazpacho — Ralph's on the Park", genre: "Cooking Demo" },
  { artist_name: "Greta Reid — Gulf Seafood Maki Roll", stage: "Food Heritage Stage", day: "Sat May 2", start_time: "13:30", end_time: "14:30", bio: "Gulf Seafood Maki Roll — Greta's Sushi", genre: "Cooking Demo" },
  { artist_name: "Todd Pulsinelli — Shrimp Creole", stage: "Food Heritage Stage", day: "Sat May 2", start_time: "14:30", end_time: "15:30", bio: "Shrimp Creole — LeBlanc + Smith", genre: "Cooking Demo" },

  // Sunday, May 3
  { artist_name: "Tyler Spreen — Bluefin Tartare with Yuzu Aioli, Tare, and Togarashi on White Bread", stage: "Food Heritage Stage", day: "Sun May 3", start_time: "11:30", end_time: "12:20", bio: "Bluefin Tartare with Yuzu Aioli, Tare, and Togarashi on White Bread — Herbsaint", genre: "Cooking Demo" },
  { artist_name: "Greg Sonnier — Blue Crab Bisque", stage: "Food Heritage Stage", day: "Sun May 3", start_time: "12:20", end_time: "13:30", bio: "Blue Crab Bisque — Gabrielle Restaurant", genre: "Cooking Demo" },
  { artist_name: "Eric Cook — Redfish Courtbouillon", stage: "Food Heritage Stage", day: "Sun May 3", start_time: "13:30", end_time: "14:30", bio: "Redfish Courtbouillon — Gris-Gris", genre: "Cooking Demo" },
  { artist_name: "Justin Kennedy — Roast Beef Po Boy", stage: "Food Heritage Stage", day: "Sun May 3", start_time: "14:30", end_time: "15:30", bio: "Roast Beef Po Boy — Parkway Bakery", genre: "Cooking Demo" },
];
