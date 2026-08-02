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
  version: "0.1.17",
  build: "da5d68f",
  source: "Morrow House visual review",
  features: [
    {
      title: "A warmer Morrow House welcome",
      body:
        "The first interior now opens through a woven runner into a defined reception area, making Rowan's temporary home feel inhabited before any label is read.",
    },
    {
      title: "Guest rooms have a clearer place",
      body:
        "Keys, guest cubbies, desk details, and the side-hall runner separate the house's service desk from its private room corridor.",
    },
    {
      title: "The arrival stays readable",
      body:
        "Desktop and phone checks now protect the entry signature while keeping Rowan, Mara, the exit, and the watch controls unobscured.",
    },
  ],
};
