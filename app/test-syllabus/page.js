"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TestSyllabusRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/syllabus");
  }, [router]);

  return null;
}