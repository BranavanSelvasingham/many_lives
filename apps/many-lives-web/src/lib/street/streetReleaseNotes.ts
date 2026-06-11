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
  version: "0.1.2",
  build: "visual-coherence",
  source: "PR #90",
  features: [
    {
      title: "Cleaner landmark guidance",
      body:
        "Rowan's route guidance now uses soft lanes and arrows instead of breadcrumb dots, so interiors and street paths read as intentional movement.",
    },
    {
      title: "Authored harbor details",
      body:
        "The east-water cue now renders as a small buoy with mooring linework rather than a stray bright speck near the quay.",
    },
  ],
};
