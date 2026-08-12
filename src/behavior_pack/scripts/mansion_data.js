// GENERATED FILE — do not edit by hand.
// Rebuilt by tools/gen_mansion_data.py from
// src/behavior_pack/functions/mansion/_index.json
//
// PARTS   : function paths, run one per tick so mobile devices keep their frame budget
// ANCHORS : named room offsets from the mansion origin
// SEALS   : envelope openings that lockdown fills solid and unlock re-opens
// BOUNDS  : the full build volume, used for the alarm/emergency-light fill sweeps

export const PARTS = [
  "mansion/part_00",
  "mansion/part_01",
  "mansion/part_02",
  "mansion/part_03",
  "mansion/part_04",
  "mansion/part_05",
  "mansion/part_06",
  "mansion/part_07",
  "mansion/part_08",
  "mansion/part_09",
  "mansion/part_10",
  "mansion/part_11",
  "mansion/part_12"
];

export const ANCHORS = {
  "entrance": [
    0,
    0,
    0
  ],
  "master_bedroom": [
    -11,
    8,
    -8
  ],
  "cinema": [
    -11,
    16,
    -9
  ],
  "gym": [
    11,
    16,
    -6
  ],
  "gaming_room": [
    11,
    16,
    -17
  ],
  "rooftop": [
    0,
    24,
    -10
  ],
  "server_room": [
    -11,
    -9,
    -8
  ],
  "security_room": [
    11,
    -9,
    -8
  ],
  "control_panel": [
    11,
    -8,
    -4
  ],
  "laboratory": [
    -9,
    -9,
    -18
  ],
  "bunker": [
    0,
    -21,
    -12
  ],
  "quarantine": [
    8,
    -21,
    -8
  ],
  "pool": [
    29,
    0,
    15
  ],
  "garage": [
    -29,
    0,
    14
  ],
  "tunnel_exit": [
    -11,
    0,
    34
  ]
};

export const SEALS = [
  {
    "name": "entrance",
    "from": [
      -4,
      0,
      0
    ],
    "to": [
      4,
      5,
      0
    ]
  },
  {
    "name": "garden_door",
    "from": [
      -3,
      0,
      -27
    ],
    "to": [
      3,
      4,
      -27
    ]
  },
  {
    "name": "pool_door",
    "from": [
      19,
      0,
      -8
    ],
    "to": [
      19,
      4,
      -4
    ]
  },
  {
    "name": "garage_bay_1",
    "from": [
      -36,
      0,
      22
    ],
    "to": [
      -33,
      4,
      22
    ]
  },
  {
    "name": "garage_bay_2",
    "from": [
      -30,
      0,
      22
    ],
    "to": [
      -27,
      4,
      22
    ]
  },
  {
    "name": "garage_bay_3",
    "from": [
      -24,
      0,
      22
    ],
    "to": [
      -21,
      4,
      22
    ]
  },
  {
    "name": "tunnel_mouth",
    "from": [
      -11,
      -20,
      -4
    ],
    "to": [
      -9,
      -18,
      -4
    ]
  },
  {
    "name": "tunnel_exit",
    "from": [
      -11,
      -1,
      33
    ],
    "to": [
      -11,
      -1,
      34
    ]
  }
];

export const BOUNDS = {
  "from": [
    -40,
    -30,
    -40
  ],
  "to": [
    40,
    34,
    40
  ]
};
