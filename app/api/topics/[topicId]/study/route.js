import { NextResponse } from "next/server";
import ai from "@/lib/gemini";
import db from "@/lib/db.js";

export async function POST(request, { params }) {
  try {
    // -----------------------------
    // 1. Get topic ID
    // -----------------------------

    const { topicId } = await params;
    const id = Number(topicId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          error: "Invalid topic ID.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------
    // 2. Get topic from database
    // -----------------------------

    const topic = db
      .prepare(`
        SELECT
          t.id,
          t.name,
          c.name AS chapter_name,
          s.name AS subject_name
        FROM topics t
        JOIN chapters c
          ON t.chapter_id = c.id
        JOIN subjects s
          ON c.subject_id = s.id
        WHERE t.id = ?
      `)
      .get(id);

    if (!topic) {
      return NextResponse.json(
        {
          error: "Topic not found.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------
    // 3. Gemini prompt
    // -----------------------------

    const prompt = `
You are an expert educational tutor.

Create a complete study pack for the following topic.

Subject:
${topic.subject_name}

Chapter:
${topic.chapter_name}

Topic:
${topic.name}

The student is preparing for an academic examination.

Generate the study material in four sections:

1. THEORY
2. EXAMPLES
3. FORMULAS
4. AI RESOURCES

IMPORTANT:

- Be academically accurate.
- Explain concepts clearly.
- Assume the student is learning this topic for the first time.
- Focus only on the requested topic.
- Do not unnecessarily discuss unrelated topics.
- Do not invent formulas.
- For physics and mathematics, use LaTeX notation where appropriate.
- Examples should help the student understand how the concept is applied.
- AI resources should be useful concepts/resources to explore, not fabricated URLs.
- Return ONLY valid JSON.
- Do not use markdown code fences.
- Do not include any text outside the JSON.

Return exactly this structure:

{
  "topic": "${topic.name}",

  "theory": {
    "overview": "...",
    "concepts": [
      {
        "title": "...",
        "explanation": "..."
      }
    ],
    "keyPoints": [
      "..."
    ]
  },

  "examples": [
    {
      "title": "...",
      "question": "...",
      "solution": "...",
      "explanation": "..."
    }
  ],

  "formulas": [
    {
      "name": "...",
      "formula": "...",
      "meaning": "...",
      "variables": [
        {
          "symbol": "...",
          "meaning": "..."
        }
      ]
    }
  ],

  "aiResources": [
    {
      "title": "...",
      "description": "..."
    }
  ]
}
`;

    // -----------------------------
    // 4. Call Gemini
    // -----------------------------

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",

      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],

      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    // -----------------------------
    // 5. Parse Gemini response
    // -----------------------------

    let studyPack;

    try {
      studyPack = JSON.parse(response.text);
    } catch (error) {
      console.error(
        "Invalid Gemini study pack JSON:"
      );

      console.error(response.text);

      return NextResponse.json(
        {
          error:
            "Gemini returned invalid study pack JSON.",
          raw: response.text,
        },
        {
          status: 502,
        }
      );
    }

    // -----------------------------
    // 6. Basic validation
    // -----------------------------

    if (
      !studyPack ||
      typeof studyPack !== "object"
    ) {
      return NextResponse.json(
        {
          error: "Invalid study pack.",
        },
        {
          status: 502,
        }
      );
    }

    if (
      !studyPack.theory ||
      !Array.isArray(studyPack.examples) ||
      !Array.isArray(studyPack.formulas) ||
      !Array.isArray(studyPack.aiResources)
    ) {
      return NextResponse.json(
        {
          error:
            "Study pack is missing required sections.",
        },
        {
          status: 502,
        }
      );
    }

    // -----------------------------
    // 7. Return study pack
    // -----------------------------

    return NextResponse.json({
      success: true,

      topic: {
        id: topic.id,
        name: topic.name,
      },

      studyPack,
    });
  } catch (error) {
    console.error(
      "Study pack generation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate study pack.",
        details: error.message,
      },
      {
        status: 500,
      }
    );
  }
}