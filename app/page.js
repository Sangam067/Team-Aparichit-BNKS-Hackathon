"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      if (!parsedUser?.id) {
        router.replace("/login");
        return;
      }

      fetch(`/api/dashboard?userId=${parsedUser.id}`)
        .then(async (response) => {
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to load dashboard.");
          }

          setDashboard(data);
        })
        .catch((error) => {
          console.error("Dashboard load error:", error);
          router.replace("/login");
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.error("User storage parse error:", error);
      router.replace("/login");
    }
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600">
            <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
            Loading dashboard...
          </div>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { user, summary, continueLearning, subjects, recentActivities } = dashboard;
  const learningSummary =
    summary.completedLevels > 0
      ? `${summary.completedLevels} completed levels across ${summary.startedSubjects} subjects`
      : "Start your first learning streak today";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[28px] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-blue-900/20 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-100">
                Student dashboard
              </p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                {greeting}, {user.name} 👋
              </h1>
              <p className="mt-2 max-w-xl text-base text-blue-50/90">
                Keep your learning streak going!
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-blue-100">
                Current learning summary
              </p>
              <p className="mt-2 text-lg font-semibold">{learningSummary}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Continue learning
                </p>
                <h2 className="mt-2 text-2xl font-bold">Next up</h2>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {continueLearning ? `${continueLearning.progress}%` : "Ready"}
              </span>
            </div>

            {continueLearning ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {continueLearning.subject.name}
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {continueLearning.topic.name}
                    </h3>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Level {continueLearning.currentLevel}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-medium text-slate-700">Chapter:</span>{" "}
                    {continueLearning.chapter.name}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">Progress:</span>{" "}
                    {continueLearning.progress}%
                  </p>
                </div>

                <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    style={{ width: `${continueLearning.progress}%` }}
                  />
                </div>

                <div className="mt-5 flex justify-end">
                  <Link
                    href={`/test-learning/battle/levels?topicId=${continueLearning.topicId}`}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
                  >
                    Continue →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-2xl font-bold text-slate-900">Ready to start learning?</p>
                <p className="mt-2 text-slate-600">
                  Choose a subject and begin your first level.
                </p>
                <Link
                  href="/test-learning"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Browse subjects
                </Link>
              </div>
            )}
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Quick stats
            </p>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Subjects</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {summary.totalSubjects}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Started</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {summary.startedSubjects}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Completed levels</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {summary.completedLevels}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Subjects
              </p>
              <h2 className="mt-2 text-2xl font-bold">Your learning path</h2>
            </div>
            <Link
              href="/test-learning"
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Browse all
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                href="/test-learning"
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Subject
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      {subject.name}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                    {subject.progress}%
                  </span>
                </div>

                <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-blue-500"
                    style={{ width: `${subject.progress}%` }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <span>
                    {subject.currentLevel ? `Level ${subject.currentLevel}` : "Not started"}
                  </span>
                  <span>{subject.completedLevels} completed</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Recent activity
          </p>
          <h2 className="mt-2 text-2xl font-bold">Latest learning</h2>

          {recentActivities.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {recentActivities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                      activity.type === "battle"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {activity.type === "battle" ? "B" : "P"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{activity.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{activity.subtitle}</p>
                  </div>
                  <time className="whitespace-nowrap text-xs font-medium text-slate-500">
                    {new Date(activity.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
              No learning activity yet. Start your first topic to see progress here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
