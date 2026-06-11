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
  version: "0.1.0",
  build: "9313de6",
  source: "PR #82",
  features: [
    {
      title: "Scheduled NPC continuity cues",
      body:
        "Offscreen and indoor NPC movement now leaves restrained route cues, so scheduled stop changes are visible and auditable.",
    },
    {
      title: "Regression guard",
      body:
        "The browser regression now fails if a scheduled NPC changes stops without visible continuity evidence.",
    },
  ],
};
