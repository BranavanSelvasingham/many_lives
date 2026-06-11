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
  version: "0.1.4",
  build: "draft",
  source: "PR TBD",
  features: [
    {
      title: "Independent city beats",
      body:
        "The watch rail now shows when locals like Mara or Nia solve live pressure before Rowan can get there.",
    },
    {
      title: "Independent local action evidence",
      body:
        "Release checks now prove locals like Mara and Nia can resolve live city pressure without Rowan taking the work.",
    },
    {
      title: "Stale-action guardrails",
      body:
        "The planner report now catches and rejects stale solve routes after an NPC-owned resolution changes the city state.",
    },
  ],
};
