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
  version: "0.1.18",
  build: "8944f31",
  source: "Compact simulation rail review",
  features: [
    {
      title: "Complete context on compact screens",
      body:
        "The collapsed rail now keeps the Many Lives premise, district status, and Rowan's current thought complete on compact and high-DPR displays.",
    },
    {
      title: "A cleaner live status surface",
      body:
        "Refined spacing, hierarchy, contrast, and responsive sizing make the live simulation easier to scan without taking focus from the map.",
    },
    {
      title: "Regression checks for real text fit",
      body:
        "Visual smoke now checks rendered line bounds, clipping, ellipses, DPR, and collisions across every compact viewport profile.",
    },
  ],
};
