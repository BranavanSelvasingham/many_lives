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
  version: "0.1.8",
  build: "c31420e",
  source: "PR #161",
  features: [
    {
      title: "Grounded yard choices",
      body:
        "After resting, Rowan now weighs Morrow Yard against the room, his energy, and what the house needs next.",
    },
    {
      title: "The city acts too",
      body:
        "Mara can steady Morrow House and the leaking pump while Rowan is elsewhere, with the change shown as a city beat.",
    },
    {
      title: "Fresh and saved runs",
      body:
        "Browser checks now guard saved runs, autoplay, and visible clues so the opening stays readable after reloads.",
    },
  ],
};
