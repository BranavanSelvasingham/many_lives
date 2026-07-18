export type StreetReleaseFeatureNote = {
  title: string;
  body: string;
};

export type StreetReleaseInfo = {
  version: string;
  build: string;
  source: string;
  features: StreetReleaseFeatureNote[];
};

export const STREET_RELEASE_INFO: StreetReleaseInfo = {
  version: "0.1.14",
  build: "f3bcdb5",
  source: "Opening trajectory review",
  features: [
    {
      title: "The first afternoon can genuinely differ",
      body:
        "What Rowan already knows can now lead to either Kettle & Lamp work or the leaking Morrow Yard pump, with different routes and lasting consequences.",
    },
    {
      title: "Every run still opens on the city",
      body:
        "Both openings begin map-first outside Morrow House, carry on with zero clicks, and preserve a clear first decision and walkable route.",
    },
    {
      title: "Reasoning reads like Rowan, not the engine",
      body:
        "Decision cards now translate planner and simulator terminology into concise player-facing choices, checks, and rationale.",
    },
  ],
};
