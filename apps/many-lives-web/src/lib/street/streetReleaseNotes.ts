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
  version: "0.1.1",
  build: "cue-polish",
  source: "PR #84",
  features: [
    {
      title: "Cleaner NPC routine cues",
      body:
        "Scheduled NPC movement now uses subtle footfall traces instead of route-dot breadcrumbs, keeping independent routines visible without visual noise.",
    },
    {
      title: "Release notes kept current",
      body:
        "The bottom release icon now reflects this release's visible changes, so the deployed popup is not left one PR behind.",
    },
  ],
};
