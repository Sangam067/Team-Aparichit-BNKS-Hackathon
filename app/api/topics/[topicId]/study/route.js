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

Generate study material for this topic:

Subject:
${topic.subject_name}

Chapter:
${topic.chapter_name}

Topic:
${topic.name}

The goal is quick revision, not a textbook-length explanation.

Return ONLY valid JSON.

Use exactly this structure:

{
  "topic": "${topic.name}",

  "theory": {
    "summary": "A clear and concise explanation of the topic.",
    "keyPoints": [
      "Important point 1",
      "Important point 2",
      "Important point 3"
    ]
  },

  "formulas": [
    {
      "formula": "formula here",
      "meaning": "what it represents"
    }
  ],

  "examples": [
    {
      "question": "Short example question",
      "solution": "Concise solution"
    }
  ],

  "youtubeResources": [
    {
      "level": "beginner",
      "title": "What the student should learn",
      "searchQuery": "YouTube search query",
      "recommendedLength": "5-10 minutes"
    },
    {
      "level": "intermediate",
      "title": "What the student should learn",
      "searchQuery": "YouTube search query",
      "recommendedLength": "10-20 minutes"
    },
    {
      "level": "advanced",
      "title": "What the student should learn",
      "searchQuery": "YouTube search query",
      "recommendedLength": "20-40 minutes"
    }
  ]
}

RULES:

1. Keep the theory concise.
2. Focus on exam-relevant concepts.
3. Include only important formulas.
4. Do not invent formulas.
5. Include 1-3 useful examples.
6. YouTube resources must be relevant to this exact topic.
7. Do NOT invent YouTube URLs.
8. Return YouTube search queries instead of URLs.
9. Recommend different video lengths for different learning levels.
10. If formulas do not apply, return an empty array.
11. If examples do not apply, return an empty array.
12. Return ONLY JSON.
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
      
      !Array.isArray(studyPack.youtubeResources)

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