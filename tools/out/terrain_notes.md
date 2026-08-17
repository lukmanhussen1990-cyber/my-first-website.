# Terrain generation notes

- Island footprint: x/z -160..160 (321 x 321 blocks)
- Sea level: y=62 (water surface), build volume y=30..140
- Land columns: 66966
- Highest point: y=118
- Trees planted: 975
- Commands: 33187 in 326 step functions (<=150 each)
- Largest single fill volume: 31744 (limit 32768)
- Step budget: <=150 commands AND <=140000 blocks touched per tick

## Cave mouths (surface entrances)
- 96 78 -20
- 124 92 -50
- 66 68 -6

## Notes
- Rivers and lakes are placed as flat, fully-enclosed water boxes so no flow updates occur (a major mobile performance win).
- Heights are quantised to 2 blocks outside build pads so run-length encoding along X keeps the command count low.
- Ambiguous flattened block IDs are avoided; see tools/palette.py for the verified whitelist.
