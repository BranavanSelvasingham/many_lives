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
  version: "0.1.13",
  build: "dfd0148",
  source: "Whole-game pacing review",
  features: [
    {
      title: "A human-paced first afternoon",
      body:
        "Watch mode now gives real decisions, walks, conversations, work, and consequences enough time to read across a three-to-five-minute opening.",
    },
    {
      title: "Manual play stays brisk",
      body:
        "The slower presentation applies only while watching; manual movement and playback keep their existing timing.",
    },
    {
      title: "Measured from load to consequence",
      body:
        "Browser checks now enforce the full opening duration, quick follow-through, zero clicks, and a maximum visible progress gap.",
    },
  ],
};
