# South Quay Visual Spec

## Purpose
This document is the translation layer between the vision image and the actual Phaser map.

The current failure mode has been:

`reference image -> ad hoc renderer tweak -> partial visual drift`

The intended workflow going forward is:

`reference image -> explicit visual plan -> authored map layout -> asset mapping -> Phaser scene`

This spec is the human-readable version of that plan. The typed source of truth lives in [southQuayVisualPlan.ts](/Users/branavan/GitHub/many_lives/apps/sim-server/src/street-sim/southQuayVisualPlan.ts).

## Reference
Primary source image:

- `/Users/branavan/Downloads/image-citymap.png`

Reference read:

- The town is not a loose block diagram.
- The center is a paved civic square.
- Buildings read first by use, not by label.
- The waterfront is a real edge condition, not a black cutoff.
- Streets, paving, lamps, planters, dock hardware, and facades all belong to one authored town grammar.

## Translation Rules
- We are not copying the reference 1:1. We are translating its composition language into the existing South Quay simulation slice.
- `Kettle & Lamp` maps to the reference cafe/restaurant frontage.
- `Morrow House` maps to the modest boarding frontage on a side of the main square.
- `Mercer Repairs` maps to the workshop/service frontage.
- `Quay Square` maps to the civic center of the scene.
- `Pilgrim Slip` maps to the lower harbor/dock edge.
- Off-map space must always read as adjacent town fabric, quay edge, or water, never as empty black roof void.

## Zone Plan
The district should read as five major spatial bands:

1. North row
   `Kettle & Lamp`, a secondary civic/commercial building, and neighboring rooflines.
2. Main east-west street
   The primary promenade connecting the boarding house side to the workshop side.
3. Central square
   `Quay Square`, with paving rhythm, benches, lamps, and planters.
4. Service and yard edge
   `North Crane Yard`, work traffic, crates, carts, and gates.
5. Waterfront edge
   `Pilgrim Slip`, dock boards, bollards, boats, ladders, and animated water.

## Landmark Contracts
Each landmark needs a role-specific read before the label appears.

| Location ID | Name | Purpose Read | Must Have | Must Avoid |
| --- | --- | --- | --- | --- |
| `tea-house` | Kettle & Lamp | European cafe / restaurant | outdoor tables, menu board, warm windows, awning, planted frontage, visible entrance | generic storefront, empty frontage, roof-only silhouette |
| `boarding-house` | Morrow House | modest boarding house | stoop, bay/window rhythm, domestic facade, keeper-facing threshold | shopfront cues, oversized signage, terrace dining |
| `repair-stall` | Mercer Repairs | repair workshop | open frontage, service counter, exterior stock, tool/work cues, sturdier materials | cafe seating, residential window rhythm |
| `market-square` | Quay Square | civic plaza | central paving field, benches, lamps, planters, fountain or focal feature | reading as an empty plot or yard |
| `freight-yard` | North Crane Yard | working yard | crates, cart traffic, service gate, loading clutter, rougher surface | polished square language |
| `moss-pier` | Pilgrim Slip | dock / harbor edge | timber edge, bollards, ladders, mooring gear, boats, water movement | blank dark strip, featureless brown slab |
| `courtyard` | Morrow Yard | domestic service yard | pump, laundry, enclosed utilitarian space | plaza symmetry, restaurant language |

## Streetscape Grammar
Everything outside buildings should come from a tight shared vocabulary.

- Streets: pale stone paving with curb rhythm and subtle seam pattern.
- Square: cleaner, more deliberate paving grid than the street.
- Lamps: cast-iron post with visible lantern head, not a stub or glowing dot.
- Planters: clustered and intentional, especially at cafe and square edges.
- Benches: aligned to square edges, not randomly distributed.
- Waterfront: dock timber meets water cleanly with visible mooring equipment.
- Neighbor blocks: darker than the playfield, but still clearly readable as buildings.

## Edge Treatment Rules
The edges of the map are part of the composition.

- North edge should imply additional town blocks and rooflines.
- West/east edges should imply neighboring facades or side streets.
- South edge should resolve into quay, dock, or garden depending on district context.
- Fringe tiles may darken slightly, but they must still read as material surfaces.
- No edge should read as undefined void space.

## Asset Mapping Rules
Use semantic asset mapping, not frame-by-frame improvisation.

- `eatery_frontage`
- `boarding_frontage`
- `workshop_frontage`
- `square_paving`
- `quay_paving`
- `dock_edge`
- `cast_iron_lamp`
- `terrace_table`
- `menu_board`
- `planter_box`
- `bollard`
- `row_boat`

The renderer should consume named intentions like these, then resolve them to actual Kenney frames, custom overlays, or both.

## Definition Of Done
The district is visually acceptable when:

- A user can identify `Kettle & Lamp`, `Morrow House`, `Mercer Repairs`, `Quay Square`, and `Pilgrim Slip` without reading their labels.
- The center reads like a town square rather than leftover open space.
- The dock edge reads like a waterfront, not a border.
- Off-map space reads like adjacent town fabric, not darkness.
- Street lights, tables, benches, and planters are legible at gameplay zoom.
- The art style feels consistent across playfield, fringe, and waterfront.

## Best Request Format
For frictionless iteration, future visual requests should use this format:

- `Target`: which landmark or zone
- `Reference cue`: what specific part of the vision image it should resemble
- `Primary read`: what the player should understand at a glance
- `Must-have cues`: 3-5 concrete visual signals
- `Avoid`: what it must not look like

Example:

- `Target`: `tea-house`
- `Reference cue`: upper-left cafe block in the image
- `Primary read`: “this is a restaurant with terrace seating”
- `Must-have cues`: menu board, dining tables, warm windows, awning, planted frontage
- `Avoid`: generic shopfront, flat roof slab, empty pavement

