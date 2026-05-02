import { Suspense } from "react";
import { PhaserStreetGameApp } from "@/components/street/PhaserStreetGameApp";

function StreetGameFallback() {
  return (
    <main
      style={{
        alignItems: "center",
        background: "#0f172a",
        color: "#f8fafc",
        display: "flex",
        minHeight: "100vh",
        justifyContent: "center",
      }}
    >
      Opening South Quay...
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<StreetGameFallback />}>
      <PhaserStreetGameApp />
    </Suspense>
  );
}
