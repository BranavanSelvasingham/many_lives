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
  version: "0.1.12",
  build: "8c0014a",
  source: "Scheduled review resolution",
  features: [
    {
      title: "A readable first stopping point",
      body:
        "The first-afternoon completion and the next objective now remain visible long enough to understand before watch mode continues.",
    },
    {
      title: "Advice stays current",
      body:
        "Conversations no longer present completed work or resolved neighborhood trouble as live choices.",
    },
    {
      title: "Stronger pacing regression coverage",
      body:
        "Browser checks now verify readable chapter handoffs, zero-click continuity, and state-correct visible advice.",
    },
  ],
};
