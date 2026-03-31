import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VisualSceneBuilder } from "@/components/street/VisualSceneBuilder";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "South Quay Builder",
};

export default function BuilderPage() {
  const builderEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SCENE_BUILDER === "true";

  if (!builderEnabled) {
    notFound();
  }

  return <VisualSceneBuilder />;
}
