# Trip Comparator: Travel Settings, Custom Cities, and 200-City Catalog

## Summary
Move the departure selector into a dedicated Travel Settings section at the bottom of the page, let each destination picker accept either a catalog city or a newly typed custom city, and expand the built-in catalog to 200 unique global destinations.

## Implementation

### 1. Reorder the page
- Remove the current “Flying from” section from the top.
- Add a clean “Travel settings” card after the destination editor, below the comparison table and at the bottom of the page.
- Keep the searchable Home City selector and its existing behavior: changing it recalculates airfare and flight time for every catalog-linked destination.
- Keep the active departure city visible in the ranked-results subtitle so users retain context before reaching the bottom setting.

### 2. Add creatable destination selection
- Extend the city combobox with an optional custom-entry mode used only by destination cards; the Home City selector remains catalog-only because distance calculation requires coordinates.
- When text has no exact catalog match, show an explicit action such as `Use “Custom City”` and support Enter/click to create it.
- Preserve catalog filtering, selected-state display, duplicate disabling, keyboard navigation, and popover behavior.
- When a catalog city is selected, continue auto-filling its ratings, airfare, and flight time from the active Home City.
- When a custom city is created, detach it from the catalog (`cityId: null`), set its entered name, assign neutral editable defaults (Food/Nightlife/Nature 5/10, airfare $500, flight time 8 hours), and immediately include it in rankings and the comparison table.
- Keep every custom value editable. Later Home City changes will leave custom-city estimates untouched because no coordinates are available.

### 3. Expand and validate the city catalog
- Grow the catalog to exactly 200 unique, internationally distributed, high-visit cities while preserving the existing city object shape.
- Add coordinates, a baseline airfare multiplier, and curated Food, Nightlife, and Nature scores for every new entry.
- Retain current IDs so defaults and existing lookups remain stable; correct any mislabeled or misleading IDs encountered in the existing data.
- Add a lightweight catalog validation test/check for exactly 200 entries, unique IDs, valid coordinate ranges, positive airfare multipliers, and 1–10 ratings.

## Technical details
- Update `CityCombobox` with an optional `onCreate` callback and controlled search text. Normalize and trim custom names before creation; suppress creation for blank text or an exact catalog match.
- Add a helper in the trip model for creating custom destinations so defaults stay centralized and typed.
- Update page state handlers to distinguish catalog selection from custom creation without changing the existing scoring formula or five-destination cap.
- Keep all data and state client-side; no account, external API, or storage changes.

## Verification
- Confirm the Travel Settings card is the final page section on desktop and mobile.
- Confirm catalog search and selection still auto-fill all metrics.
- Confirm typing a new city and pressing Enter creates it with neutral defaults, allows all fields to be edited, and updates rankings/table immediately.
- Confirm changing Home City recalculates catalog destinations but preserves custom destination values.
- Confirm duplicate catalog cities remain blocked and the five-destination limit still works.
- Confirm the catalog validation passes with exactly 200 valid, unique cities, then run the project build and a browser interaction check.
