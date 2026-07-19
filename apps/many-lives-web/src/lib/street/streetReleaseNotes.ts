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
  version: "0.1.15",
  build: "7966456",
  source: "Release 0.1.15",
  features: [
    {
      title: "Rowan is clearly the agent under observation",
      body:
        "The persistent rail now identifies Rowan as the autonomous agent, so watching the city never casts the viewer as the character making the decisions.",
    },
    {
      title: "Progress and reasoning have distinct homes",
      body:
        "Progress holds outcomes, evidence, and accomplishments, while Reasoning holds Rowan's beliefs, plans, confidence, memories, and next uncertainty.",
    },
    {
      title: "Opening walks keep their own story",
      body:
        "Kettle & Lamp and Mercer Repairs openings preserve distinct, continuous routes tied to the current world state from first decision through consequence.",
    },
  ],
};
