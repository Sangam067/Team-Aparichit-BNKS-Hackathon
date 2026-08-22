"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TestLearningRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/learning");
  }, [router]);

  return null;
}
