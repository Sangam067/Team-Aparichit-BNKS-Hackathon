import { NextResponse } from "next/server";
import { generateWithFallback, cleanAndParseJSON } from "@/lib/gemini";
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

   // 3. CHECK SQLITE CACHE
    // -----------------------------

    const existingTheory = db
      .prepare(`
        SELECT content
        FROM theories
        WHERE topic_id = ?
        LIMIT 1
      `)
      .get(id);

    if (existingTheory) {
      console.log(
        `Returning cached study pack for topic ${id}`
      );

      let studyPack;

      try {
        studyPack = JSON.parse(existingTheory.content);
      } catch (error) {
        console.error(
          "Failed to parse cached study pack:",
          error
        );

        return NextResponse.json(
          {
            error: "Stored study pack is corrupted.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        cached: true,

        topic: {
          id: topic.id,
          name: topic.name,
        },

        studyPack,
      });
    }

    // -----------------------------
    // 4. Gemini prompt
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
- Explain concepts clearly but concisely.
- Assume the student is learning this topic for the first time.
- Focus only on the requested topic.
- Do not unnecessarily discuss unrelated topics.
- Do not invent formulas.
- Examples should help the student understand how the concept is applied.
- Return ONLY valid JSON.
- Do not use markdown code fences.
- Do not include any text outside the JSON.

==================================================
MATHEMATICAL / SCIENTIFIC FORMATTING
==================================================

Use LaTeX for mathematical, scientific, and chemical notation whenever appropriate.

IMPORTANT LaTeX rules:

- Return mathematical expressions as LaTeX strings inside the JSON.
- Use inline LaTeX with \\(...\\).
- Use display/block LaTeX with \\[...\\].
- DO NOT use HTML such as <sup>, <sub>, <math>, or <span>.
- DO NOT use Markdown code fences for mathematical expressions.
- DO NOT use Unicode mathematical formatting when LaTeX is more appropriate.
- Use ^ for powers.
- Use _ for subscripts.
- Use \\\\sqrt{} for square roots.
- Use Greek-letter commands such as \\\\alpha, \\\\beta, \\\\theta.
- Use \\\\sum, \\\\int, \\\\Delta, etc. where appropriate.
- Use \\\\mathrm{} for units when appropriate.
- Use parentheses to make expressions unambiguous.

FRACTION RULE:

- NEVER use \\\\frac{}{}.
- NEVER use \\\\dfrac{}{}.
- NEVER use any fraction command.
- Write fractions using / instead.

Examples:

Correct:
"\\\\(v = d/t\\\\)"

Correct:
"\\\\(a = (v-u)/t\\\\)"

Correct:
"\\\\(x = (a+b)/(c+d)\\\\)"

Incorrect:
"\\\\(v = \\\\frac{d}{t}\\\\)"

Incorrect:
"\\\\(x = \\\\frac{a+b}{c+d}\\\\)"

Make sure all backslashes are properly escaped so that the response remains valid JSON.

For example:

{
  "formula": "\\\\(F = ma\\\\)"
}

==================================================
THEORY SECTION STYLE
==================================================

Keep theory SHORT AND SWEET.

- "overview" must be 1-2 sentences maximum.
- "concepts" should contain ONLY the most important definitions, principles, and formulas the student must know.
- Each concept explanation should be 1-2 crisp sentences.
- "keyPoints" should be short, punchy bullet points.
- No fluff.
- No unnecessary history.
- No long derivations.
- Save deeper explanation and step-by-step reasoning for EXAMPLES.

==================================================
EXAMPLES SECTION
==================================================

Include useful exam-oriented examples.

For numerical/scientific topics:

- Show the important steps.
- Keep solutions concise but understandable.
- Use LaTeX for equations and calculations.
- Explain why each important step is performed.

For conceptual topics:

- Use short real-world or exam-style examples.
- Explain the reasoning clearly.

==================================================
FORMULAS SECTION
==================================================

Include ONLY formulas genuinely relevant to the topic.

For each formula:

- "name" = name of the formula.
- "formula" = properly formatted LaTeX expression.
- "meaning" = what the formula represents.
- "variables" = explain every important symbol.

If the topic has no formulas, return an empty array.

Remember:

NEVER use \\\\frac.
Always use / for fractions.

==================================================
AI RESOURCES / YOUTUBE
==================================================

Provide useful learning resources related to the EXACT topic.

Include a mixture of:

- Concepts to search for.
- Reputable educational YouTube channels.
- Useful video types.
- YouTube search links.

Prefer well-known educational channels such as:

- Khan Academy
- 3Blue1Brown
- The Organic Chemistry Tutor
- Physics Wallah
- CrashCourse
- MIT OpenCourseWare

Only recommend a channel when it is genuinely relevant to the topic.

DO NOT invent individual YouTube video URLs.

Instead, generate a YouTube SEARCH URL using the topic/search query.

Example:

{
  "title": "Newton's Laws — Khan Academy",
  "description": "Search Khan Academy for an introduction to Newton's Laws.",
  "searchQuery": "Newton's Laws Khan Academy",
  "youtubeUrl": "https://www.youtube.com/results?search_query=Newton%27s+Laws+Khan+Academy"
}

The youtubeUrl must be a YouTube search-results URL, NOT an invented individual video URL.

The searchQuery should be concise and directly related to the topic.

Include approximately 3-5 useful resources.

==================================================
OUTPUT
==================================================

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
      "description": "...",
      "searchQuery": "...",
      "youtubeUrl": "..."
    }
  ]
}

Return ONLY valid JSON.
`;
    // -----------------------------
    // 4. Call Gemini
    // -----------------------------

    const response = await generateWithFallback({
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
      studyPack = cleanAndParseJSON(response.text);
    } catch (error) {
      console.error(
        "Invalid Gemini study pack JSON:",
        error.message
      );

      console.error(response.text);

      return NextResponse.json(
        {
          error:
            "Gemini returned invalid study pack JSON.",
          details: error.message,
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

    // 8. SAVE TO SQLITE
    // -----------------------------

    try {
      db.prepare(`
        INSERT INTO theories (
          topic_id,
          content
        )
        VALUES (?, ?)
        ON CONFLICT(topic_id) DO UPDATE SET content = excluded.content
      `).run(
        id,
        JSON.stringify(studyPack)
      );

      console.log(
        `Study pack saved to database for topic ${id}`
      );
    } catch (dbErr) {
      console.warn("Theory cache save warning:", dbErr.message);
    }


    return NextResponse.json({
      success: true,
      cached: false,

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