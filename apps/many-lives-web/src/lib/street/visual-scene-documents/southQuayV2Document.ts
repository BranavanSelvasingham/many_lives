import type { VisualSceneDocument } from "@/lib/street/visualScenes";

const SOUTH_QUAY_V2_DOCUMENT = {
  "backgroundColor": "#111d23",
  "fringeZones": [],
  "id": "south-quay-v2",
  "labels": [],
  "landmarkModules": [
    {
      "id": "tea-house-roof_cap-1",
      "kind": "roof_cap",
      "locationId": "tea-house",
      "rect": {
        "x": 1180,
        "y": 336,
        "width": 328,
        "height": 34,
        "radius": 16
      },
      "variant": "verdigris"
    },
    {
      "id": "tea-house-wall_band-2",
      "kind": "wall_band",
      "locationId": "tea-house",
      "rect": {
        "x": 1152,
        "y": 360,
        "width": 384,
        "height": 102,
        "radius": 24
      },
      "variant": "cafe-ivory"
    },
    {
      "id": "tea-house-awning-3",
      "kind": "awning",
      "locationId": "tea-house",
      "rect": {
        "x": 1184,
        "y": 440,
        "width": 316,
        "height": 42
      },
      "variant": "green-cream"
    },
    {
      "id": "tea-house-wall_band-4",
      "kind": "wall_band",
      "locationId": "tea-house",
      "rect": {
        "x": 1172,
        "y": 480,
        "width": 340,
        "height": 96,
        "radius": 18
      },
      "variant": "walnut"
    },
    {
      "count": 2,
      "id": "tea-house-window_row-5",
      "kind": "window_row",
      "locationId": "tea-house",
      "rect": {
        "x": 1168,
        "y": 488,
        "width": 348,
        "height": 66,
        "radius": 12
      },
      "variant": "cafe-large"
    },
    {
      "id": "tea-house-entry-6",
      "kind": "entry",
      "locationId": "tea-house",
      "rect": {
        "x": 1308,
        "y": 484,
        "width": 68,
        "height": 90,
        "radius": 14
      },
      "variant": "arched"
    },
    {
      "id": "tea-house-terrace_rail-7",
      "kind": "terrace_rail",
      "locationId": "tea-house",
      "rect": {
        "x": 1184,
        "y": 556,
        "width": 316,
        "height": 24,
        "radius": 8
      },
      "variant": "cafe"
    },
    {
      "id": "tea-house-sign-8",
      "kind": "sign",
      "locationId": "tea-house",
      "rect": {
        "x": 1232,
        "y": 360,
        "width": 220,
        "height": 34,
        "radius": 12
      },
      "variant": "cafe"
    },
    {
      "id": "tea-house-trim-9",
      "kind": "trim",
      "locationId": "tea-house",
      "rect": {
        "x": 1168,
        "y": 412,
        "width": 348,
        "height": 18,
        "radius": 8
      },
      "variant": "warm-trim"
    },
    {
      "id": "boarding-house-roof_cap-1",
      "kind": "roof_cap",
      "locationId": "boarding-house",
      "rect": {
        "x": 36,
        "y": 292,
        "width": 376,
        "height": 36,
        "radius": 20
      },
      "variant": "slate"
    },
    {
      "id": "boarding-house-wall_band-2",
      "kind": "wall_band",
      "locationId": "boarding-house",
      "rect": {
        "x": 48,
        "y": 336,
        "width": 348,
        "height": 126,
        "radius": 20
      },
      "variant": "boarding-upper"
    },
    {
      "id": "boarding-house-wall_band-3",
      "kind": "wall_band",
      "locationId": "boarding-house",
      "rect": {
        "x": 56,
        "y": 464,
        "width": 336,
        "height": 90,
        "radius": 18
      },
      "variant": "boarding-lower"
    },
    {
      "count": 5,
      "id": "boarding-house-window_row-4",
      "kind": "window_row",
      "locationId": "boarding-house",
      "rect": {
        "x": 72,
        "y": 352,
        "width": 300,
        "height": 64,
        "radius": 10
      },
      "variant": "boarding-upper"
    },
    {
      "count": 4,
      "id": "boarding-house-window_row-5",
      "kind": "window_row",
      "locationId": "boarding-house",
      "rect": {
        "x": 84,
        "y": 436,
        "width": 280,
        "height": 58,
        "radius": 10
      },
      "variant": "boarding-lower"
    },
    {
      "id": "boarding-house-entry-6",
      "kind": "entry",
      "locationId": "boarding-house",
      "rect": {
        "x": 192,
        "y": 496,
        "width": 60,
        "height": 86,
        "radius": 12
      },
      "variant": "house-door"
    },
    {
      "id": "boarding-house-stoop-7",
      "kind": "stoop",
      "locationId": "boarding-house",
      "rect": {
        "x": 176,
        "y": 568,
        "width": 92,
        "height": 28,
        "radius": 10
      },
      "variant": "boarding"
    },
    {
      "id": "boarding-house-downspout-8",
      "kind": "downspout",
      "locationId": "boarding-house",
      "rect": {
        "x": 376,
        "y": 352,
        "width": 10,
        "height": 176,
        "radius": 4
      },
      "variant": "slate"
    },
    {
      "id": "boarding-house-trim-9",
      "kind": "trim",
      "locationId": "boarding-house",
      "rect": {
        "x": 56,
        "y": 420,
        "width": 336,
        "height": 18,
        "radius": 8
      },
      "variant": "house-band"
    },
    {
      "id": "freight-yard-roof_cap-1",
      "kind": "roof_cap",
      "locationId": "freight-yard",
      "rect": {
        "x": 568,
        "y": 720,
        "width": 264,
        "height": 34,
        "radius": 12
      },
      "variant": "timber"
    },
    {
      "id": "freight-yard-wall_band-2",
      "kind": "wall_band",
      "locationId": "freight-yard",
      "rect": {
        "x": 568,
        "y": 764,
        "width": 260,
        "height": 84,
        "radius": 16
      },
      "variant": "yard-gatehouse"
    },
    {
      "id": "freight-yard-service_bay-3",
      "kind": "service_bay",
      "locationId": "freight-yard",
      "rect": {
        "x": 584,
        "y": 856,
        "width": 228,
        "height": 86,
        "radius": 12
      },
      "variant": "yard-gate"
    },
    {
      "count": 3,
      "id": "freight-yard-shutters-4",
      "kind": "shutters",
      "locationId": "freight-yard",
      "rect": {
        "x": 592,
        "y": 784,
        "width": 212,
        "height": 34,
        "radius": 8
      },
      "variant": "yard"
    },
    {
      "id": "freight-yard-sign-5",
      "kind": "sign",
      "locationId": "freight-yard",
      "rect": {
        "x": 624,
        "y": 736,
        "width": 148,
        "height": 30,
        "radius": 10
      },
      "variant": "yard"
    },
    {
      "id": "freight-yard-trim-6",
      "kind": "trim",
      "locationId": "freight-yard",
      "rect": {
        "x": 572,
        "y": 824,
        "width": 252,
        "height": 18,
        "radius": 8
      },
      "variant": "yard-band"
    }
  ],
  "landmarks": [
    {
      "accentColor": 14138489,
      "id": "landmark-v2-tea-house",
      "locationId": "tea-house",
      "rect": {
        "height": 252,
        "radius": 26,
        "width": 382,
        "x": 1152,
        "y": 332
      },
      "style": "cafe"
    },
    {
      "accentColor": 11059404,
      "id": "landmark-v2-boarding-house",
      "locationId": "boarding-house",
      "rect": {
        "height": 304,
        "radius": 28,
        "width": 376,
        "x": 36,
        "y": 292
      },
      "style": "boarding-house"
    },
    {
      "accentColor": 13077593,
      "id": "landmark-v2-freight-yard",
      "locationId": "freight-yard",
      "rect": {
        "height": 252,
        "radius": 24,
        "width": 300,
        "x": 548,
        "y": 712
      },
      "style": "yard"
    },
    {
      "accentColor": 13672816,
      "id": "landmark-v2-moss-pier",
      "locationId": "moss-pier",
      "rect": {
        "height": 180,
        "radius": 16,
        "width": 450,
        "x": 688,
        "y": 1060
      },
      "style": "dock"
    },
    {
      "accentColor": 14931123,
      "id": "landmark-v2-market-square",
      "locationId": "market-square",
      "rect": {
        "height": 180,
        "radius": 30,
        "width": 300,
        "x": 668,
        "y": 364
      },
      "style": "square"
    },
    {
      "accentColor": 14130277,
      "id": "landmark-v2-repair-stall",
      "locationId": "repair-stall",
      "rect": {
        "x": 1188,
        "y": 366,
        "width": 282,
        "height": 226,
        "radius": 24
      },
      "style": "workshop"
    },
    {
      "accentColor": 10993302,
      "id": "landmark-v2-courtyard",
      "locationId": "courtyard",
      "rect": {
        "x": 146,
        "y": 858,
        "width": 360,
        "height": 246,
        "radius": 26
      },
      "style": "courtyard"
    }
  ],
  "layers": {
    "ground": {
      "height": 1320,
      "id": "ground",
      "kind": "solid",
      "width": 1872,
      "x": 0,
      "y": 0
    },
    "labels": {
      "id": "labels",
      "kind": "objects"
    },
    "props": {
      "id": "props",
      "kind": "objects"
    },
    "structures": {
      "id": "structures",
      "kind": "objects"
    },
    "weather": {
      "id": "weather",
      "kind": "objects"
    }
  },
  "locationAnchors": {
    "tea-house": {
      "door": {
        "x": 440,
        "y": 354
      },
      "frontage": {
        "x": 440,
        "y": 340
      },
      "highlight": {
        "x": 243,
        "y": 91,
        "width": 394,
        "height": 262,
        "radius": 26
      },
      "label": {
        "x": 440,
        "y": 118
      },
      "npcStands": [
        {
          "x": 388,
          "y": 356
        },
        {
          "x": 440,
          "y": 352
        },
        {
          "x": 494,
          "y": 356
        }
      ]
    },
    "boarding-house": {
      "door": {
        "x": 344,
        "y": 744
      },
      "frontage": {
        "x": 344,
        "y": 724
      },
      "highlight": {
        "x": 151,
        "y": 423,
        "width": 386,
        "height": 314,
        "radius": 28
      },
      "label": {
        "x": 344,
        "y": 456
      },
      "npcStands": [
        {
          "x": 292,
          "y": 788
        },
        {
          "x": 404,
          "y": 786
        }
      ]
    },
    "repair-stall": {
      "door": {
        "x": 1328,
        "y": 608
      },
      "frontage": {
        "x": 1320,
        "y": 594
      },
      "highlight": {
        "x": 1183,
        "y": 361,
        "width": 292,
        "height": 236,
        "radius": 24
      },
      "label": {
        "x": 1328,
        "y": 392
      },
      "npcStands": [
        {
          "x": 1306,
          "y": 634
        },
        {
          "x": 1360,
          "y": 628
        }
      ]
    },
    "market-square": {
      "door": {
        "x": 856,
        "y": 744
      },
      "frontage": {
        "x": 856,
        "y": 744
      },
      "highlight": {
        "x": 635,
        "y": 557,
        "width": 440,
        "height": 362,
        "radius": 30
      },
      "label": {
        "x": 856,
        "y": 738
      },
      "npcStands": [
        {
          "x": 768,
          "y": 742
        },
        {
          "x": 944,
          "y": 742
        },
        {
          "x": 856,
          "y": 806
        }
      ]
    },
    "freight-yard": {
      "door": {
        "x": 1286,
        "y": 828
      },
      "frontage": {
        "x": 1254,
        "y": 842
      },
      "highlight": {
        "x": 1265,
        "y": 659,
        "width": 310,
        "height": 262,
        "radius": 24
      },
      "label": {
        "x": 1420,
        "y": 800
      },
      "npcStands": [
        {
          "x": 1346,
          "y": 860
        },
        {
          "x": 1496,
          "y": 888
        }
      ]
    },
    "moss-pier": {
      "door": {
        "x": 1306,
        "y": 1012
      },
      "frontage": {
        "x": 1306,
        "y": 1070
      },
      "highlight": {
        "x": 1013,
        "y": 1007,
        "width": 660,
        "height": 220,
        "radius": 16
      },
      "label": {
        "x": 1354,
        "y": 1078
      },
      "npcStands": [
        {
          "x": 1448,
          "y": 1080
        },
        {
          "x": 1542,
          "y": 1096
        }
      ]
    },
    "courtyard": {
      "door": {
        "x": 332,
        "y": 904
      },
      "frontage": {
        "x": 332,
        "y": 916
      },
      "highlight": {
        "x": 141,
        "y": 853,
        "width": 370,
        "height": 256,
        "radius": 26
      },
      "label": {
        "x": 338,
        "y": 1008
      },
      "npcStands": [
        {
          "x": 286,
          "y": 962
        },
        {
          "x": 382,
          "y": 966
        }
      ]
    }
  },
  "npcAnchors": {
    "npc-ada": {
      "x": 440,
      "y": 352
    },
    "npc-jo": {
      "x": 1240,
      "y": 676
    },
    "npc-mara": {
      "x": 292,
      "y": 788
    },
    "npc-nia": {
      "x": 1408,
      "y": 952
    },
    "npc-tomas": {
      "x": 1496,
      "y": 888
    }
  },
  "playerSpawn": {
    "x": 304,
    "y": 740
  },
  "projection": {
    "columnCenters": [
      126,
      182,
      240,
      298,
      364,
      432,
      500,
      568,
      636,
      704,
      776,
      848,
      920,
      992,
      1064,
      1140,
      1216,
      1292,
      1368,
      1444,
      1520,
      1596,
      1672,
      1748
    ],
    "rowCenters": [
      116,
      166,
      218,
      270,
      330,
      392,
      456,
      520,
      586,
      654,
      722,
      790,
      860,
      930,
      1002,
      1074,
      1146,
      1218
    ]
  },
  "propClusters": [],
  "props": [],
  "referencePlate": {
    "alpha": 0,
    "height": 1024,
    "src": "/assets/visual-scenes/south-quay-v1/reference-citymap.png",
    "width": 1536,
    "x": 184,
    "y": 120
  },
  "skyLayers": [
    {
      "cloudKind": "harbor-bank",
      "density": 4.8,
      "id": "sea-mist-1",
      "opacity": 0.34,
      "rect": {
        "x": 0,
        "y": 0,
        "width": 1870,
        "height": 211,
        "radius": 0
      },
      "scale": 1.1,
      "speed": 11,
      "weather": "mist"
    }
  ],
  "surfaceZones": [],
  "waterRegions": [],
  "width": 1872,
  "height": 1320,
  "terrainDraft": {
    "baseKind": "land",
    "cellSize": 48,
    "overrides": [
      {
        "col": 15,
        "kind": "water",
        "row": 0
      },
      {
        "col": 16,
        "kind": "water",
        "row": 0
      },
      {
        "col": 17,
        "kind": "water",
        "row": 0
      },
      {
        "col": 18,
        "kind": "water",
        "row": 0
      },
      {
        "col": 19,
        "kind": "water",
        "row": 0
      },
      {
        "col": 20,
        "kind": "water",
        "row": 0
      },
      {
        "col": 21,
        "kind": "water",
        "row": 0
      },
      {
        "col": 22,
        "kind": "water",
        "row": 0
      },
      {
        "col": 23,
        "kind": "water",
        "row": 0
      },
      {
        "col": 24,
        "kind": "water",
        "row": 0
      },
      {
        "col": 25,
        "kind": "water",
        "row": 0
      },
      {
        "col": 26,
        "kind": "water",
        "row": 0
      },
      {
        "col": 27,
        "kind": "water",
        "row": 0
      },
      {
        "col": 28,
        "kind": "water",
        "row": 0
      },
      {
        "col": 29,
        "kind": "water",
        "row": 0
      },
      {
        "col": 30,
        "kind": "water",
        "row": 0
      },
      {
        "col": 31,
        "kind": "water",
        "row": 0
      },
      {
        "col": 32,
        "kind": "water",
        "row": 0
      },
      {
        "col": 33,
        "kind": "water",
        "row": 0
      },
      {
        "col": 34,
        "kind": "water",
        "row": 0
      },
      {
        "col": 35,
        "kind": "water",
        "row": 0
      },
      {
        "col": 36,
        "kind": "water",
        "row": 0
      },
      {
        "col": 37,
        "kind": "water",
        "row": 0
      },
      {
        "col": 38,
        "kind": "water",
        "row": 0
      },
      {
        "col": 15,
        "kind": "water",
        "row": 1
      },
      {
        "col": 16,
        "kind": "water",
        "row": 1
      },
      {
        "col": 17,
        "kind": "water",
        "row": 1
      },
      {
        "col": 18,
        "kind": "water",
        "row": 1
      },
      {
        "col": 19,
        "kind": "water",
        "row": 1
      },
      {
        "col": 20,
        "kind": "water",
        "row": 1
      },
      {
        "col": 21,
        "kind": "water",
        "row": 1
      },
      {
        "col": 22,
        "kind": "water",
        "row": 1
      },
      {
        "col": 23,
        "kind": "water",
        "row": 1
      },
      {
        "col": 24,
        "kind": "water",
        "row": 1
      },
      {
        "col": 25,
        "kind": "water",
        "row": 1
      },
      {
        "col": 26,
        "kind": "water",
        "row": 1
      },
      {
        "col": 27,
        "kind": "water",
        "row": 1
      },
      {
        "col": 28,
        "kind": "water",
        "row": 1
      },
      {
        "col": 29,
        "kind": "water",
        "row": 1
      },
      {
        "col": 30,
        "kind": "water",
        "row": 1
      },
      {
        "col": 31,
        "kind": "water",
        "row": 1
      },
      {
        "col": 32,
        "kind": "water",
        "row": 1
      },
      {
        "col": 33,
        "kind": "water",
        "row": 1
      },
      {
        "col": 34,
        "kind": "water",
        "row": 1
      },
      {
        "col": 35,
        "kind": "water",
        "row": 1
      },
      {
        "col": 36,
        "kind": "water",
        "row": 1
      },
      {
        "col": 37,
        "kind": "water",
        "row": 1
      },
      {
        "col": 38,
        "kind": "water",
        "row": 1
      },
      {
        "col": 37,
        "kind": "water",
        "row": 2
      },
      {
        "col": 38,
        "kind": "water",
        "row": 2
      },
      {
        "col": 37,
        "kind": "water",
        "row": 3
      },
      {
        "col": 38,
        "kind": "water",
        "row": 3
      },
      {
        "col": 37,
        "kind": "water",
        "row": 4
      },
      {
        "col": 38,
        "kind": "water",
        "row": 4
      },
      {
        "col": 37,
        "kind": "water",
        "row": 5
      },
      {
        "col": 38,
        "kind": "water",
        "row": 5
      },
      {
        "col": 37,
        "kind": "water",
        "row": 6
      },
      {
        "col": 38,
        "kind": "water",
        "row": 6
      },
      {
        "col": 37,
        "kind": "water",
        "row": 7
      },
      {
        "col": 38,
        "kind": "water",
        "row": 7
      },
      {
        "col": 37,
        "kind": "water",
        "row": 8
      },
      {
        "col": 38,
        "kind": "water",
        "row": 8
      },
      {
        "col": 37,
        "kind": "water",
        "row": 9
      },
      {
        "col": 38,
        "kind": "water",
        "row": 9
      },
      {
        "col": 37,
        "kind": "water",
        "row": 10
      },
      {
        "col": 38,
        "kind": "water",
        "row": 10
      },
      {
        "col": 37,
        "kind": "water",
        "row": 11
      },
      {
        "col": 38,
        "kind": "water",
        "row": 11
      },
      {
        "col": 37,
        "kind": "water",
        "row": 12
      },
      {
        "col": 38,
        "kind": "water",
        "row": 12
      },
      {
        "col": 37,
        "kind": "water",
        "row": 13
      },
      {
        "col": 38,
        "kind": "water",
        "row": 13
      },
      {
        "col": 37,
        "kind": "water",
        "row": 14
      },
      {
        "col": 38,
        "kind": "water",
        "row": 14
      },
      {
        "col": 37,
        "kind": "water",
        "row": 15
      },
      {
        "col": 38,
        "kind": "water",
        "row": 15
      },
      {
        "col": 37,
        "kind": "water",
        "row": 16
      },
      {
        "col": 38,
        "kind": "water",
        "row": 16
      },
      {
        "col": 37,
        "kind": "water",
        "row": 17
      },
      {
        "col": 38,
        "kind": "water",
        "row": 17
      },
      {
        "col": 37,
        "kind": "water",
        "row": 18
      },
      {
        "col": 38,
        "kind": "water",
        "row": 18
      },
      {
        "col": 37,
        "kind": "water",
        "row": 19
      },
      {
        "col": 38,
        "kind": "water",
        "row": 19
      },
      {
        "col": 37,
        "kind": "water",
        "row": 20
      },
      {
        "col": 38,
        "kind": "water",
        "row": 20
      },
      {
        "col": 37,
        "kind": "water",
        "row": 21
      },
      {
        "col": 38,
        "kind": "water",
        "row": 21
      },
      {
        "col": 37,
        "kind": "water",
        "row": 22
      },
      {
        "col": 38,
        "kind": "water",
        "row": 22
      },
      {
        "col": 37,
        "kind": "water",
        "row": 23
      },
      {
        "col": 38,
        "kind": "water",
        "row": 23
      },
      {
        "col": 0,
        "kind": "water",
        "row": 24
      },
      {
        "col": 1,
        "kind": "water",
        "row": 24
      },
      {
        "col": 2,
        "kind": "water",
        "row": 24
      },
      {
        "col": 3,
        "kind": "water",
        "row": 24
      },
      {
        "col": 4,
        "kind": "water",
        "row": 24
      },
      {
        "col": 5,
        "kind": "water",
        "row": 24
      },
      {
        "col": 6,
        "kind": "water",
        "row": 24
      },
      {
        "col": 7,
        "kind": "water",
        "row": 24
      },
      {
        "col": 8,
        "kind": "water",
        "row": 24
      },
      {
        "col": 9,
        "kind": "water",
        "row": 24
      },
      {
        "col": 10,
        "kind": "water",
        "row": 24
      },
      {
        "col": 11,
        "kind": "water",
        "row": 24
      },
      {
        "col": 12,
        "kind": "water",
        "row": 24
      },
      {
        "col": 13,
        "kind": "water",
        "row": 24
      },
      {
        "col": 24,
        "kind": "water",
        "row": 24
      },
      {
        "col": 25,
        "kind": "water",
        "row": 24
      },
      {
        "col": 26,
        "kind": "water",
        "row": 24
      },
      {
        "col": 27,
        "kind": "water",
        "row": 24
      },
      {
        "col": 28,
        "kind": "water",
        "row": 24
      },
      {
        "col": 29,
        "kind": "water",
        "row": 24
      },
      {
        "col": 30,
        "kind": "water",
        "row": 24
      },
      {
        "col": 31,
        "kind": "water",
        "row": 24
      },
      {
        "col": 32,
        "kind": "water",
        "row": 24
      },
      {
        "col": 33,
        "kind": "water",
        "row": 24
      },
      {
        "col": 34,
        "kind": "water",
        "row": 24
      },
      {
        "col": 35,
        "kind": "water",
        "row": 24
      },
      {
        "col": 36,
        "kind": "water",
        "row": 24
      },
      {
        "col": 37,
        "kind": "water",
        "row": 24
      },
      {
        "col": 38,
        "kind": "water",
        "row": 24
      },
      {
        "col": 0,
        "kind": "water",
        "row": 25
      },
      {
        "col": 1,
        "kind": "water",
        "row": 25
      },
      {
        "col": 2,
        "kind": "water",
        "row": 25
      },
      {
        "col": 3,
        "kind": "water",
        "row": 25
      },
      {
        "col": 4,
        "kind": "water",
        "row": 25
      },
      {
        "col": 5,
        "kind": "water",
        "row": 25
      },
      {
        "col": 6,
        "kind": "water",
        "row": 25
      },
      {
        "col": 7,
        "kind": "water",
        "row": 25
      },
      {
        "col": 8,
        "kind": "water",
        "row": 25
      },
      {
        "col": 9,
        "kind": "water",
        "row": 25
      },
      {
        "col": 10,
        "kind": "water",
        "row": 25
      },
      {
        "col": 11,
        "kind": "water",
        "row": 25
      },
      {
        "col": 12,
        "kind": "water",
        "row": 25
      },
      {
        "col": 13,
        "kind": "water",
        "row": 25
      },
      {
        "col": 24,
        "kind": "water",
        "row": 25
      },
      {
        "col": 25,
        "kind": "water",
        "row": 25
      },
      {
        "col": 26,
        "kind": "water",
        "row": 25
      },
      {
        "col": 27,
        "kind": "water",
        "row": 25
      },
      {
        "col": 28,
        "kind": "water",
        "row": 25
      },
      {
        "col": 29,
        "kind": "water",
        "row": 25
      },
      {
        "col": 30,
        "kind": "water",
        "row": 25
      },
      {
        "col": 31,
        "kind": "water",
        "row": 25
      },
      {
        "col": 32,
        "kind": "water",
        "row": 25
      },
      {
        "col": 33,
        "kind": "water",
        "row": 25
      },
      {
        "col": 34,
        "kind": "water",
        "row": 25
      },
      {
        "col": 35,
        "kind": "water",
        "row": 25
      },
      {
        "col": 36,
        "kind": "water",
        "row": 25
      },
      {
        "col": 37,
        "kind": "water",
        "row": 25
      },
      {
        "col": 38,
        "kind": "water",
        "row": 25
      },
      {
        "col": 0,
        "kind": "water",
        "row": 26
      },
      {
        "col": 1,
        "kind": "water",
        "row": 26
      },
      {
        "col": 2,
        "kind": "water",
        "row": 26
      },
      {
        "col": 3,
        "kind": "water",
        "row": 26
      },
      {
        "col": 4,
        "kind": "water",
        "row": 26
      },
      {
        "col": 5,
        "kind": "water",
        "row": 26
      },
      {
        "col": 6,
        "kind": "water",
        "row": 26
      },
      {
        "col": 7,
        "kind": "water",
        "row": 26
      },
      {
        "col": 8,
        "kind": "water",
        "row": 26
      },
      {
        "col": 9,
        "kind": "water",
        "row": 26
      },
      {
        "col": 10,
        "kind": "water",
        "row": 26
      },
      {
        "col": 11,
        "kind": "water",
        "row": 26
      },
      {
        "col": 12,
        "kind": "water",
        "row": 26
      },
      {
        "col": 13,
        "kind": "water",
        "row": 26
      },
      {
        "col": 14,
        "kind": "water",
        "row": 26
      },
      {
        "col": 15,
        "kind": "water",
        "row": 26
      },
      {
        "col": 16,
        "kind": "water",
        "row": 26
      },
      {
        "col": 17,
        "kind": "water",
        "row": 26
      },
      {
        "col": 18,
        "kind": "water",
        "row": 26
      },
      {
        "col": 19,
        "kind": "water",
        "row": 26
      },
      {
        "col": 20,
        "kind": "water",
        "row": 26
      },
      {
        "col": 21,
        "kind": "water",
        "row": 26
      },
      {
        "col": 22,
        "kind": "water",
        "row": 26
      },
      {
        "col": 23,
        "kind": "water",
        "row": 26
      },
      {
        "col": 24,
        "kind": "water",
        "row": 26
      },
      {
        "col": 25,
        "kind": "water",
        "row": 26
      },
      {
        "col": 26,
        "kind": "water",
        "row": 26
      },
      {
        "col": 27,
        "kind": "water",
        "row": 26
      },
      {
        "col": 28,
        "kind": "water",
        "row": 26
      },
      {
        "col": 29,
        "kind": "water",
        "row": 26
      },
      {
        "col": 30,
        "kind": "water",
        "row": 26
      },
      {
        "col": 31,
        "kind": "water",
        "row": 26
      },
      {
        "col": 32,
        "kind": "water",
        "row": 26
      },
      {
        "col": 33,
        "kind": "water",
        "row": 26
      },
      {
        "col": 34,
        "kind": "water",
        "row": 26
      },
      {
        "col": 35,
        "kind": "water",
        "row": 26
      },
      {
        "col": 36,
        "kind": "water",
        "row": 26
      },
      {
        "col": 37,
        "kind": "water",
        "row": 26
      },
      {
        "col": 38,
        "kind": "water",
        "row": 26
      },
      {
        "col": 0,
        "kind": "water",
        "row": 27
      },
      {
        "col": 1,
        "kind": "water",
        "row": 27
      },
      {
        "col": 2,
        "kind": "water",
        "row": 27
      },
      {
        "col": 3,
        "kind": "water",
        "row": 27
      },
      {
        "col": 4,
        "kind": "water",
        "row": 27
      },
      {
        "col": 5,
        "kind": "water",
        "row": 27
      },
      {
        "col": 6,
        "kind": "water",
        "row": 27
      },
      {
        "col": 7,
        "kind": "water",
        "row": 27
      },
      {
        "col": 8,
        "kind": "water",
        "row": 27
      },
      {
        "col": 9,
        "kind": "water",
        "row": 27
      },
      {
        "col": 10,
        "kind": "water",
        "row": 27
      },
      {
        "col": 11,
        "kind": "water",
        "row": 27
      },
      {
        "col": 12,
        "kind": "water",
        "row": 27
      },
      {
        "col": 13,
        "kind": "water",
        "row": 27
      },
      {
        "col": 14,
        "kind": "water",
        "row": 27
      },
      {
        "col": 15,
        "kind": "water",
        "row": 27
      },
      {
        "col": 16,
        "kind": "water",
        "row": 27
      },
      {
        "col": 17,
        "kind": "water",
        "row": 27
      },
      {
        "col": 18,
        "kind": "water",
        "row": 27
      },
      {
        "col": 19,
        "kind": "water",
        "row": 27
      },
      {
        "col": 20,
        "kind": "water",
        "row": 27
      },
      {
        "col": 21,
        "kind": "water",
        "row": 27
      },
      {
        "col": 22,
        "kind": "water",
        "row": 27
      },
      {
        "col": 23,
        "kind": "water",
        "row": 27
      },
      {
        "col": 24,
        "kind": "water",
        "row": 27
      },
      {
        "col": 25,
        "kind": "water",
        "row": 27
      },
      {
        "col": 26,
        "kind": "water",
        "row": 27
      },
      {
        "col": 27,
        "kind": "water",
        "row": 27
      },
      {
        "col": 28,
        "kind": "water",
        "row": 27
      },
      {
        "col": 29,
        "kind": "water",
        "row": 27
      },
      {
        "col": 30,
        "kind": "water",
        "row": 27
      },
      {
        "col": 31,
        "kind": "water",
        "row": 27
      },
      {
        "col": 32,
        "kind": "water",
        "row": 27
      },
      {
        "col": 33,
        "kind": "water",
        "row": 27
      },
      {
        "col": 34,
        "kind": "water",
        "row": 27
      },
      {
        "col": 35,
        "kind": "water",
        "row": 27
      },
      {
        "col": 36,
        "kind": "water",
        "row": 27
      },
      {
        "col": 37,
        "kind": "water",
        "row": 27
      },
      {
        "col": 38,
        "kind": "water",
        "row": 27
      }
    ]
  },
  "surfaceDraft": {
    "baseKind": "tiled_stone_road",
    "cellSize": 48,
    "overrides": [
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 0
      },
      {
        "col": 13,
        "kind": "grass",
        "row": 0
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 1
      },
      {
        "col": 13,
        "kind": "trees",
        "row": 1
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 2
      },
      {
        "col": 13,
        "kind": "grass",
        "row": 2
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 3
      },
      {
        "col": 13,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 14,
        "kind": "trees",
        "row": 3
      },
      {
        "col": 16,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 17,
        "kind": "trees",
        "row": 3
      },
      {
        "col": 19,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 20,
        "kind": "trees",
        "row": 3
      },
      {
        "col": 21,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 22,
        "kind": "bushes",
        "row": 3
      },
      {
        "col": 23,
        "kind": "bushes",
        "row": 3
      },
      {
        "col": 24,
        "kind": "trees",
        "row": 3
      },
      {
        "col": 25,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 26,
        "kind": "bushes",
        "row": 3
      },
      {
        "col": 27,
        "kind": "trees",
        "row": 3
      },
      {
        "col": 28,
        "kind": "bushes",
        "row": 3
      },
      {
        "col": 29,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 30,
        "kind": "trees",
        "row": 3
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 3
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 3
      },
      {
        "col": 0,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 1,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 2,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 3,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 4,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 5,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 6,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 7,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 8,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 9,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 11,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 12,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 13,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 14,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 15,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 16,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 17,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 18,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 19,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 20,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 21,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 22,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 24,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 25,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 26,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 27,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 28,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 29,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 30,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 31,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 4
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 4
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 4
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 5
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 5
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 5
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 5
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 5
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 6
      },
      {
        "col": 12,
        "kind": "trees",
        "row": 6
      },
      {
        "col": 13,
        "kind": "bushes",
        "row": 6
      },
      {
        "col": 14,
        "kind": "bushes",
        "row": 6
      },
      {
        "col": 15,
        "kind": "trees",
        "row": 6
      },
      {
        "col": 18,
        "kind": "bushes",
        "row": 6
      },
      {
        "col": 19,
        "kind": "trees",
        "row": 6
      },
      {
        "col": 20,
        "kind": "bushes",
        "row": 6
      },
      {
        "col": 21,
        "kind": "bushes",
        "row": 6
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 6
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 6
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 6
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 6
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 7
      },
      {
        "col": 12,
        "kind": "bushes",
        "row": 7
      },
      {
        "col": 21,
        "kind": "trees",
        "row": 7
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 7
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 7
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 7
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 7
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 8
      },
      {
        "col": 12,
        "kind": "trees",
        "row": 8
      },
      {
        "col": 21,
        "kind": "trees",
        "row": 8
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 8
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 8
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 8
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 8
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 9
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 9
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 9
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 9
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 9
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 10
      },
      {
        "col": 12,
        "kind": "trees",
        "row": 10
      },
      {
        "col": 21,
        "kind": "trees",
        "row": 10
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 10
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 10
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 11
      },
      {
        "col": 12,
        "kind": "trees",
        "row": 11
      },
      {
        "col": 21,
        "kind": "trees",
        "row": 11
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 11
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 11
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 12
      },
      {
        "col": 12,
        "kind": "trees",
        "row": 12
      },
      {
        "col": 13,
        "kind": "bushes",
        "row": 12
      },
      {
        "col": 14,
        "kind": "bushes",
        "row": 12
      },
      {
        "col": 15,
        "kind": "bushes",
        "row": 12
      },
      {
        "col": 18,
        "kind": "bushes",
        "row": 12
      },
      {
        "col": 19,
        "kind": "bushes",
        "row": 12
      },
      {
        "col": 20,
        "kind": "bushes",
        "row": 12
      },
      {
        "col": 21,
        "kind": "trees",
        "row": 12
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 12
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 12
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 12
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 12
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 13
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 13
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 13
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 13
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 13
      },
      {
        "col": 0,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 1,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 2,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 3,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 4,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 5,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 6,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 7,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 8,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 9,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 11,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 12,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 13,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 14,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 15,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 16,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 17,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 18,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 19,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 20,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 21,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 22,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 24,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 25,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 26,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 27,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 28,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 29,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 30,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 31,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 32,
        "kind": "paved_asphalt",
        "row": 14
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 14
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 14
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 15
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 15
      },
      {
        "col": 24,
        "kind": "bushes",
        "row": 15
      },
      {
        "col": 25,
        "kind": "bushes",
        "row": 15
      },
      {
        "col": 26,
        "kind": "bushes",
        "row": 15
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 15
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 15
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 16
      },
      {
        "col": 1,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 2,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 3,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 4,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 5,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 16
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 16
      },
      {
        "col": 8,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 16
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 16
      },
      {
        "col": 24,
        "kind": "trees",
        "row": 16
      },
      {
        "col": 25,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 16
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 16
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 8,
        "kind": "bushes",
        "row": 17
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 17
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 17
      },
      {
        "col": 24,
        "kind": "trees",
        "row": 17
      },
      {
        "col": 25,
        "kind": "bushes",
        "row": 17
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 17
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 17
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 8,
        "kind": "bushes",
        "row": 18
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 18
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 18
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 18
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 18
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 8,
        "kind": "bushes",
        "row": 19
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 19
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 19
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 19
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 19
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 8,
        "kind": "bushes",
        "row": 20
      },
      {
        "col": 10,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 11,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 12,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 13,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 14,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 15,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 16,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 17,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 18,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 19,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 20,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 21,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 22,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 23,
        "kind": "paved_asphalt",
        "row": 20
      },
      {
        "col": 34,
        "kind": "trees",
        "row": 20
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 20
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 21
      },
      {
        "col": 8,
        "kind": "bushes",
        "row": 21
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 8,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 9,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 10,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 11,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 12,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 13,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 24,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 25,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 26,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 27,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 28,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 29,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 30,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 31,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 32,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 33,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 34,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 35,
        "kind": "bushes",
        "row": 22
      },
      {
        "col": 36,
        "kind": "grass",
        "row": 22
      },
      {
        "col": 0,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 1,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 2,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 3,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 4,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 5,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 6,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 7,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 8,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 9,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 10,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 11,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 12,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 13,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 24,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 25,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 26,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 27,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 28,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 29,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 30,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 31,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 32,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 33,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 34,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 35,
        "kind": "grass",
        "row": 23
      },
      {
        "col": 36,
        "kind": "grass",
        "row": 23
      }
    ]
  }
} satisfies VisualSceneDocument;

export { SOUTH_QUAY_V2_DOCUMENT };
