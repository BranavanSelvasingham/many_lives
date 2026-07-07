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
  version: "0.1.10",
  build: "604b574",
  source: "Main release",
  features: [
    {
      title: "Named landmark signs",
      body:
        "South Quay's first map read now uses in-world place names for Morrow House, Kettle & Lamp, and North Crane Yard instead of generic category signs.",
    },
  ],
};
