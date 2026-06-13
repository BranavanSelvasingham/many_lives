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
  version: "0.1.6",
  build: "2fd7ef9",
  source: "Pending PR",
  features: [
    {
      title: "Morrow House interior",
      body:
        "The opening boarding-house room now reads warmer and keeps its room label legible in the interior camera smoke.",
    },
    {
      title: "First-screen readability",
      body:
        "Mara, Rowan, and the decision callback remain visible while the first room gets clearer parlor cues.",
    },
  ],
};
