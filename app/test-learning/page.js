"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function getTopicStatus(index, total) {
  if (!total) return "locked";
  return index === 0 ? "unlocked" : "locked";
}

export default function TestLearningPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [studyPack, setStudyPack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const lessonRef = useRef(null);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();

        if (data.success) {
          setSubjects(data.subjects);

          if (data.subjects[0]) {
            setSelectedSubjectId(String(data.subjects[0].id));
          }
        }
      } catch (error) {
        console.error("Failed to load subjects:", error);
      }
    }

    loadSubjects();
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) {
      return;
    }

    async function loadCurriculum() {
      setCurriculumLoading(true);
      setSelectedChapterId("");
      setSelectedTopicId("");
      setStudyPack(null);

      try {
        const response = await fetch(`/api/curriculum/${selectedSubjectId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load subject curriculum.");
        }

        if (data.success) {
          const subjectChapters = (data.subject?.chapters || []).map((chapter) => ({
            ...chapter,
            topics: (chapter.topics || []).map((topic, topicIndex) => ({
              ...topic,
              status: getTopicStatus(topicIndex, (chapter.topics || []).length),
              unlocked: topicIndex === 0,
            })),
          }));

          setCurriculum(subjectChapters);

          if (subjectChapters[0]?.topics?.[0]) {
            const firstChapter = subjectChapters[0];
            const firstTopic = firstChapter.topics[0];
            setSelectedChapterId(String(firstChapter.id));
            setSelectedTopicId(String(firstTopic.id));
          }
        }
      } catch (error) {
        console.error("Failed to load curriculum:", error);
      } finally {
        setCurriculumLoading(false);
      }
    }

    loadCurriculum();
  }, [selectedSubjectId]);

  const selectedSubject = subjects.find(
    (subject) => String(subject.id) === selectedSubjectId
  );

  const selectedChapter = curriculum.find(
    (chapter) => String(chapter.id) === selectedChapterId
  );

  const selectedTopic = (selectedChapter?.topics || []).find(
    (topic) => String(topic.id) === selectedTopicId
  );

  useEffect(() => {
    if (studyPack && lessonRef.current) {
      lessonRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [studyPack]);

  async function generateStudyPack() {
    if (!selectedTopicId) return;

    setLoading(true);
    setStudyPack(null);

    try {
      const response = await fetch(`/api/topics/${selectedTopicId}/study`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate study pack.");
      }

      setStudyPack(data.studyPack);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[28px] bg-gradient-to-br from-emerald-500 via-lime-500 to-amber-400 p-6 text-white shadow-lg shadow-emerald-500/20 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-50">
                Learn
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Choose your path</h1>
            </div>

            <div className="rounded-2xl border border-white/25 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-50">Current subject</p>
              <p className="mt-2 text-lg font-bold">
                {selectedSubject ? selectedSubject.name : "Select a subject"}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-6 xl:self-start">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Subjects</p>
              <h2 className="mt-2 text-2xl font-bold">Explore</h2>
            </div>

            <div className="space-y-3">
              {subjects.map((subject) => {
                const isSelected = String(subject.id) === selectedSubjectId;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setSelectedSubjectId(String(subject.id))}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50 shadow-sm ring-2 ring-emerald-100"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                          Subject
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{subject.name}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                        {isSelected ? "Open" : "View"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Roadmap</p>
                <h2 className="mt-2 text-2xl font-bold">{selectedSubject ? selectedSubject.name : "Select a subject"}</h2>
              </div>
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Dashboard
              </Link>
            </div>

            {curriculumLoading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
                Loading chapters and topics...
              </div>
            ) : !curriculum.length ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
                No syllabus loaded for this subject yet.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {curriculum.map((chapter) => (
                  <div key={chapter.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-slate-900">
                        Chapter {chapter.chapterNumber || 1} — {chapter.name}
                      </h3>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                        {chapter.topics?.length || 0} topics
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {chapter.topics.map((topic, topicIndex) => {
                        const isSelected = String(topic.id) === selectedTopicId;
                        const isUnlocked = topic.status === "unlocked" || topic.unlocked;

                        return (
                          <button
                            key={topic.id}
                            type="button"
                            disabled={!isUnlocked}
                            onClick={() => {
                              if (!isUnlocked) return;
                              setSelectedChapterId(String(chapter.id));
                              setSelectedTopicId(String(topic.id));
                              setStudyPack(null);
                            }}
                            className={`group relative rounded-2xl border p-3 text-left transition ${
                              isSelected
                                ? "border-emerald-300 bg-emerald-50 shadow-sm"
                                : isUnlocked
                                  ? "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30"
                                  : "border-slate-200 bg-slate-200/70 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-lg" aria-label={isUnlocked ? "Unlocked" : "Locked"}>
                                {isUnlocked ? "✅" : "🔒"}
                              </span>
                              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                                {isUnlocked ? "Learn" : "Locked"}
                              </span>
                            </div>

                            <p className="mt-3 text-base font-semibold leading-snug text-slate-900">
                              {topic.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {topicIndex === 0 ? "Start here" : "Continue when ready"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTopic && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Selected Topic</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedTopic.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedChapter ? `${selectedChapter.name}` : "Chapter"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generateStudyPack}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {loading ? "Loading..." : "Open lesson"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {studyPack && (
          <section ref={lessonRef} className="mt-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lesson</p>
                <h2 className="mt-2 text-2xl font-bold">{selectedTopic?.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  router.push(`/test-learning/battle/levels?topicId=${selectedTopicId}`);
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Battle mode
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">Theory</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{studyPack.theory.summary}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {studyPack.theory.keyPoints.map((point, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-1 text-emerald-600">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">Examples</h3>
                <div className="mt-3 space-y-4 text-sm text-slate-700">
                  {studyPack.examples.map((example, index) => (
                    <div key={index} className="rounded-xl bg-white p-3">
                      <p className="font-semibold text-slate-900">Question</p>
                      <p className="mt-1">{example.question}</p>
                      <p className="mt-3 font-semibold text-slate-900">Solution</p>
                      <p className="mt-1">{example.solution}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {studyPack.formulas?.length > 0 && (
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">Formulas</h3>
                <div className="mt-4 space-y-3">
                  {studyPack.formulas.map((formula, index) => (
                    <div key={index} className="rounded-xl bg-white p-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap text-sm font-mono text-slate-900">
                        {formula.formula}
                      </pre>
                      <p className="mt-2 text-sm text-slate-700">{formula.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {studyPack.youtubeResources?.length > 0 && (
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">Helpful videos</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {studyPack.youtubeResources.map((resource, index) => (
                    <div key={index} className="rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {resource.level}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">{resource.title}</p>
                      <p className="mt-2 text-xs text-slate-500">{resource.recommendedLength}</p>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(resource.searchQuery)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                      >
                        Search YouTube →
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}