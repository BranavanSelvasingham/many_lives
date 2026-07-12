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
  version: "0.1.11",
  build: "7c7d7e3",
  source: "Main release",
  features: [
    {
      title: "A more living first afternoon",
      body:
        "Rowan now chooses from current legal options while schedules, commitments, and neighborhood pressures keep changing around him.",
    },
    {
      title: "Brisk, honest watch mode",
      body:
        "The opening reaches visible decisions and consequences faster, without repeated advances, required viewer clicks, or overstated AI provenance.",
    },
    {
      title: "Clearer South Quay",
      body:
        "Landmarks, routes, responsive rails, and event cues now read more consistently across desktop, tablet, and phone layouts.",
    },
  ],
};
