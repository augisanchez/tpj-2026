export type Theme = {
  slug: string;
  name: string;
  prompt: string;
};

export const THEMES: Theme[] = [
  {
    slug: "identity",
    name: "Identity",
    prompt: "What does a face show, and what does it refuse to give away?",
  },
  {
    slug: "intimacy",
    name: "Intimacy",
    prompt: "How close can a camera get before the moment turns its head?",
  },
  {
    slug: "memory",
    name: "Memory",
    prompt:
      "What do the photographs we keep say about who we were, and who we are afraid to forget?",
  },
  {
    slug: "youth",
    name: "Youth",
    prompt:
      "What does it mean to be photographed while you are still becoming?",
  },
  {
    slug: "isolation",
    name: "Isolation",
    prompt: "What is found in standing apart, and what is lost?",
  },
  {
    slug: "place",
    name: "Place",
    prompt: "How does a place make the people who live in it?",
  },
  {
    slug: "performance",
    name: "Performance",
    prompt: "Where does the role end and the person begin?",
  },
  {
    slug: "night",
    name: "Night",
    prompt: "What only shows itself after the lights go out?",
  },
  {
    slug: "desire",
    name: "Desire",
    prompt: "What does the body say that hasn't been said yet?",
  },
  {
    slug: "labor",
    name: "Labor",
    prompt: "What is the cost of the work we do, and the work that does us?",
  },
  {
    slug: "family",
    name: "Family",
    prompt: "Who do we belong to, and who do we become in their gaze?",
  },
];

export const DEFAULT_THEME_SLUG = "memory";
