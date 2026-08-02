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
  version: "0.1.16",
  build: "dd03d2c",
  source: "South Quay visual review",
  features: [
    {
      title: "A grounded northern edge",
      body:
        "The neighboring row now meets South Quay through a darker service street, curb, drains, loading strips, and more varied building fronts.",
    },
    {
      title: "A working western fringe",
      body:
        "The open ground around Morrow Yard now reads as a compacted working approach with planting, timber boundaries, stone edges, and drainage.",
    },
    {
      title: "Visual checks cover the whole composition",
      body:
        "High-DPR regressions now sample the broad north and west transition areas, not only their already detailed landmark interiors.",
    },
  ],
};
