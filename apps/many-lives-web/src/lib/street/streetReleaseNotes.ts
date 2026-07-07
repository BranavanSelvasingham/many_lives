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
  version: "0.1.9",
  build: "fe4bcf5",
  source: "Main release",
  features: [
    {
      title: "South Quay feels busier",
      body:
        "Kettle & Lamp, Quay Square, and the pier now show clearer event-backed street life as Rowan moves through town.",
    },
    {
      title: "Ada's lead is grounded",
      body:
        "Rowan now treats Mara's tip as unconfirmed until Ada answers directly, then records the lunch work terms as evidence.",
    },
    {
      title: "Cleaner decisions",
      body:
        "Closed or stale options stay out of the current decision card, keeping watch mode focused on what Rowan can do now.",
    },
  ],
};
