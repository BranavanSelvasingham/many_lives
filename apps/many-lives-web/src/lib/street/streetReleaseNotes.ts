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
  version: "0.1.5",
  build: "8516035",
  source: "PR #122",
  features: [
    {
      title: "Landmark clarity",
      body:
        "Rowan's nearby lead lines up with the map, so Morrow House no longer reads like Kettle & Lamp.",
    },
    {
      title: "South Quay detail",
      body:
        "The cafe terrace, square planters, benches, dock edge, and water carry more ambient life.",
    },
  ],
};
