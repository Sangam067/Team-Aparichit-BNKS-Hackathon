export const BATTLE_LEVELS = [
  {
    level: 1,
    title: "Basics",
    subtitle: "Definitions, fundamental concepts, simple recall",
    difficulties: ["easy"],
    distribution: "All 10 questions must be easy.",
  },
  {
    level: 2,
    title: "Understanding",
    subtitle: "Relationships, interpretation, simple application",
    difficulties: ["easy", "medium"],
    distribution:
      "Questions 1-5 must be easy. Questions 6-10 must be medium.",
  },
  {
    level: 3,
    title: "Application",
    subtitle: "Standard calculations, applying concepts, reasoning",
    difficulties: ["medium"],
    distribution: "All 10 questions must be medium.",
  },
  {
    level: 4,
    title: "Problem Solving",
    subtitle: "Multi-step problems and deeper reasoning",
    difficulties: ["medium", "hard"],
    distribution:
      "Questions 1-5 must be medium. Questions 6-10 must be hard.",
  },
  {
    level: 5,
    title: "Mastery",
    subtitle: "Challenging application, reasoning and calculations",
    difficulties: ["hard"],
    distribution: "All 10 questions must be hard.",
  },
];

export function isValidBattleLevel(level) {
  return Number.isInteger(level) && level >= 1 && level <= 5;
}

export function getBattleLevelConfig(level) {
  return BATTLE_LEVELS.find((entry) => entry.level === level) ?? null;
}

export function validateQuestionDifficulty(level, index, difficulty) {
  if (level === 1) {
    return difficulty === "easy";
  }

  if (level === 2) {
    return index < 5
      ? difficulty === "easy"
      : difficulty === "medium";
  }

  if (level === 3) {
    return difficulty === "medium";
  }

  if (level === 4) {
    return index < 5
      ? difficulty === "medium"
      : difficulty === "hard";
  }

  if (level === 5) {
    return difficulty === "hard";
  }

  return false;
}

export function buildBattlePrompt(topic, levelConfig) {
  const levelInstructions = {
    1: "Focus on basic concepts and definitions.",
    2: "Focus on understanding and simple application.",
    3: "Focus on standard application and reasoning.",
    4: "Focus on multi-step problem solving and harder reasoning.",
    5: "Focus on mastery-level challenging problems.",
  };

  return `
You are an expert examination question generator.

Create exactly 10 questions for:

Subject:
${topic.subject_name}

Chapter:
${topic.chapter_name}

Topic:
${topic.name}

Level:
${levelConfig.level} — ${levelConfig.title}

Level focus:
${levelInstructions[levelConfig.level]}

Level description:
${levelConfig.subtitle}

These questions will be used in a student "Boss Battle" at Level ${levelConfig.level}.

QUESTION DISTRIBUTION:

${levelConfig.distribution}

IMPORTANT RULES:

1. Exactly 10 questions.
2. Exactly 4 options per question.
3. Only one option is correct.
4. Questions must be unambiguous.
5. Do not repeat essentially the same question.
6. Questions must stay within the selected topic.
7. Include the underlying concept being tested.
8. Include a concise explanation.
9. Difficulty must be exactly:
   "easy", "medium", or "hard".
10. Follow the level difficulty distribution exactly.
11. Return ONLY valid JSON.
12. Do not use markdown code fences.

Return exactly:

{
  "questions": [
    {
      "question": "...",
      "options": [
        "...",
        "...",
        "...",
        "..."
      ],
      "correctAnswer": 0,
      "explanation": "...",
      "concept": "...",
      "difficulty": "easy"
    }
  ]
}

correctAnswer is the zero-based index of the correct option.
`;
}

export function calculateStars(score) {
  if (score >= 10) {
    return 3;
  }

  if (score >= 7) {
    return 2;
  }

  if (score >= 5) {
    return 1;
  }

  return 0;
}

export function isLevelCompleted(score) {
  return score >= 5;
}

export function isLevelUnlocked(level, progressByLevel) {
  if (level === 1) {
    return true;
  }

  const previousLevel = progressByLevel.get(level - 1);
  return Boolean(previousLevel?.completed);
}
