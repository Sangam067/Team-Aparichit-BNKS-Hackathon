"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function TestBattleRedirectWrapper() {
  return (
    <Suspense fallback={null}>
      <TestBattleRedirect />
    </Suspense>
  );
}

function TestBattleRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");

  useEffect(() => {
    router.replace(topicId ? `/battle?topicId=${topicId}` : "/learning");
  }, [router, topicId]);

  return null;
}