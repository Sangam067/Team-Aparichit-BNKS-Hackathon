import { NextResponse } from "next/server";
import { generateWithFallback, cleanAndParseJSON } from "@/lib/gemini";
import db from "@/lib/db.js";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request) {
  try {
    // -----------------------------
    // 1. Get uploaded files
    // -----------------------------

    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files.length) {
      return NextResponse.json(
        {
          error: "No files uploaded.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------
    // 2. Validate files
    // -----------------------------

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          {
            error: "Invalid file received.",
          },
          {
            status: 400,
          }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${file.type}`,
            allowedTypes: ALLOWED_TYPES,
          },
          {
            status: 400,
          }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `${file.name} exceeds the 20 MB limit.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    // -----------------------------
    // 3. Convert files for Gemini
    // -----------------------------

    const fileParts = [];

    for (const file of files) {
      const buffer = Buffer.from(
        await file.arrayBuffer()
      );

      fileParts.push({
        inlineData: {
          mimeType: file.type,
          data: buffer.toString("base64"),
        },
      });
    }

    // -----------------------------
    // 4. Gemini prompt
    // -----------------------------

    const prompt = `
You are an expert educational curriculum extraction system.

The attached files contain textbook table-of-contents pages,
syllabus pages, or curriculum pages.

Extract the complete syllabus from ALL uploaded files.

Create this hierarchy:

Subject
→ Chapter
→ Topic

IMPORTANT RULES:

1. Preserve the original chapter names.
2. Preserve the original topic names.
3. Preserve the original ordering.
4. Combine information across multiple uploaded files.
5. Do not duplicate chapters or topics.
6. Do not invent chapters or topics.
7. Ignore page numbers.
8. Ignore advertisements and unrelated information.
9. If a chapter has no visible topics, return an empty topics array.
10. Return ONLY valid JSON.
11. Do not use markdown code fences.
12. Do not add explanations outside the JSON.

Return exactly:

{
  "subject": "Physics",
  "chapters": [
    {
      "chapterNumber": 1,
      "name": "Mechanics",
      "topics": [
        {
          "name": "Kinematics"
        },
        {
          "name": "Newton's Laws"
        }
      ]
    }
  ]
}
`;

    // -----------------------------
    // 5. Send files to Gemini
    // -----------------------------

    const response = await generateWithFallback({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            ...fileParts,
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
    // 6. Parse Gemini JSON
    // -----------------------------

    let syllabus;

    try {
      syllabus = cleanAndParseJSON(response.text);
    } catch (error) {
      console.error("Invalid Gemini JSON:", error.message);
      console.error(response.text);

      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
          details: error.message,
          raw: response.text,
        },
        {
          status: 502,
        }
      );
    }

    // -----------------------------
    // 7. Validate syllabus structure
    // -----------------------------

    if (
      !syllabus.subject ||
      !Array.isArray(syllabus.chapters)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid syllabus structure returned by Gemini.",
        },
        {
          status: 502,
        }
      );
    }

    // -----------------------------
    // 8. Prepare SQLite statements
    // -----------------------------

    const insertSubject = db.prepare(`
      INSERT INTO subjects (name)
      VALUES (?)
    `);

    const insertChapter = db.prepare(`
      INSERT INTO chapters (
        subject_id,
        name,
        chapter_number
      )
      VALUES (?, ?, ?)
    `);

    const insertTopic = db.prepare(`
      INSERT INTO topics (
        chapter_id,
        name,
        order_index
      )
      VALUES (?, ?, ?)
    `);

    // -----------------------------
    // 9. Save syllabus transaction
    // -----------------------------

    const saveSyllabus = db.transaction(() => {
      // -----------------------------
      // Insert subject
      // -----------------------------

      const subjectResult = insertSubject.run(
        syllabus.subject
      );

      const subjectId = Number(
        subjectResult.lastInsertRowid
      );

      // -----------------------------
      // Insert chapters
      // -----------------------------

      for (
        let chapterIndex = 0;
        chapterIndex < syllabus.chapters.length;
        chapterIndex++
      ) {
        const chapter =
          syllabus.chapters[chapterIndex];

        const chapterResult = insertChapter.run(
          subjectId,
          chapter.name,
          chapter.chapterNumber ||
            chapterIndex + 1
        );

        const chapterId = Number(
          chapterResult.lastInsertRowid
        );

        // -----------------------------
        // Insert topics
        // -----------------------------

        const topics = Array.isArray(
          chapter.topics
        )
          ? chapter.topics
          : [];

        if (topics.length === 0) {
          // If no specific subtopics, treat the chapter as the main topic
          insertTopic.run(
            chapterId,
            chapter.name,
            1
          );
        } else {
          for (
            let topicIndex = 0;
            topicIndex < topics.length;
            topicIndex++
          ) {
            const topic = topics[topicIndex];

            const topicName =
              typeof topic === "string"
                ? topic
                : topic?.name;

            if (!topicName) {
              continue;
            }

            insertTopic.run(
              chapterId,
              topicName,
              topicIndex + 1
            );
          }
        }
      }

      return subjectId;
    });

    // -----------------------------
    // 10. Execute transaction
    // -----------------------------

    const subjectId = saveSyllabus();

    // -----------------------------
    // 11. Return response
    // -----------------------------

    return NextResponse.json({
      success: true,
      message:
        "Syllabus extracted and saved successfully.",
      filesProcessed: files.length,
      subjectId,
      syllabus,
    });
  } catch (error) {
    console.error(
      "Syllabus upload error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to process syllabus.",
        details: error.message,
      },
      {
        status: 500,
      }
    );
  }
}