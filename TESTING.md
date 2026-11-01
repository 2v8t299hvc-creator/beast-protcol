# Test selection

Default: `node tools/test.cjs`. This runs four smoke checks in one file, normally under one second:

- Current content/recipe/asset registrations have no errors.
- Character selection, match initialization, starting weapon and departure work.
- Real crafting and recovery consume items and update resources.
- Closing the result screen still allows the next game to start.

These checks run on every relevant push/PR. They are VM checks of the actual game script, not a substitute for the user's Safari play testing.

## Choose checks based on the change

Smoke is automatically included when selecting any feature suite:

| Change | Additional command |
| --- | --- |
| Item/recipe/stat/character/region/asset definitions | `node tools/test.cjs --suite content` |
| Damage, skills, durability, ammunition, combat timing | `node tools/test.cjs --suite combat` |
| COM equipment, crafting, recovery, targeting | `node tools/test.cjs --suite com` |
| Layout markup, encyclopedia, crafting UI, skill HUD | `node tools/test.cjs --suite ui` |
| Play recording/export/storage | `node tools/test.cjs --suite records` |
| Shared inventory consumption | `node tools/test.cjs --suite smoke,com,combat,content` |
| Shared startup/clock/state, cross-feature refactor, uncertain impact | `node tools/test.cjs --maintained` |

Multiple groups: `node tools/test.cjs --suite smoke,com,combat`. File selections are deduplicated. Do not infer coverage from the number of assertions. Negative registration tests deliberately try invalid inputs; they belong in content checks, not every small UI change. Do not rely on the default smoke suite alone when modifying feature behavior.

`--maintained` runs all 25 maintained files (93 reported Node test results at this review). Node counts some older script-style files as a single result even when they contain many assertions, so this is not a uniform count of scenarios. `--list` lists groups; `--dry-run` shows selected files without executing.

## Existing tests pending review

All 56 previously failing files remain in place and are individually listed in `tests/suites.json` under `pendingReview`. They are **not deleted, fixed or silently treated as passing**. `node tools/test.cjs --audit` runs every test file, including them, and currently exits with failures. A green maintained suite does not claim those legacy checks passed.

53 files need startup-fixture migration and assertion review. Merely adding the new match-start call was tried: many then revealed other old assumptions, so this is not a safe bulk replacement. Three further files need specification comparison: `equipment-balance-update.test.cjs` (plasma attack display), `medicine-stones.test.cjs` (white-stone subcategory), and `region-balance.test.cjs` (region item total). Their expectations must be checked against approved game rules, not just replaced with whatever the implementation currently returns.

When modifying a feature with pending tests, inspect its relevant legacy file(s), retain meaningful boundaries, migrate or replace those checks in the maintained group, and only then remove the old duplicate. Do not mass-update expected values simply to make tests green. Pending failures mean that historical feature coverage is incomplete.

New test files must be classified in the manifest; the runner rejects unclassified, missing or duplicate entries. Shared VM setup lives in `tests/helpers/game-harness.cjs`; importing it executes no test assertions. Ten feature files previously imported the character-catalog test and reran its unrelated checks; they now import this helper directly.

## GitHub

Automatic checks run smoke. Workflow dispatch also permits content/combat/com/UI/records groups or the entire maintained suite. Feature-specific checks should be run before submitting the change; audit is explicit and separate.

Game behavior is unchanged by this testing reorganization.
