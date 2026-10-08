# Brief: Replace add-on splicing with Reinforced swaps (Contain the Sharp listen mode)

For the prototype project (`aithera/lesson-presentation`). Send this as-is.

## Why

The stakeholder's source module and podcast deck define the Feel stories (F1, F3) as two **complete** versions: the standard story, and a longer **Reinforced** story shown **instead of** the standard one when the learner scores low on the pre-check. Our prototype instead splices a short "add-on" clip into the standard file at a seam time. That was our own modeling choice, not theirs, and it forces seam times, splice fades and extra player logic. Replace it with a plain swap. Nothing about which learners get it changes.

## What stays the same

- The trigger. `config.json` already has `triggers.reinforce` for f1 and f3 with `scoreAtMost 3`, read from the answers frozen when the learner chose Listen mode. Keep it.
- Know routing: k2 plays the harder version when the pre-check is correct. Same rule, new name (below).
- The post-listen checks. `checks` already maps a reinforced listen to `case3rf` (f1) and `debriefrf` (f3).
- Remedial content (quick takes, fact cards, review) stays outside the audio. The stakeholders liked this and want the learner to choose the format later (reading, interaction or more audio), so leave the existing `review` and `quickTakes` stubs alone.

## What changes

### 1. Version names in the manifest

The studio now writes `base`, `testup` and `reinforced`. A topic with only one version (open, close, f2, continue) is `universal`. Teach the player the new names and keep the old ones working until the new files land.

| Old (hand-made manifest) | New (studio export) |
| --- | --- |
| `normal` | `base`, or `universal` for a single-version topic |
| `harder` | `testup` |
| `addon` | removed, replaced by `reinforced` |

### 2. Topics f1 and f3 become two complete files

```json
"f1": { "title": "The needle in the trash",
        "base":       { "file": "04_f1-base.mp3",       "captions": "04_f1-base.vtt" },
        "reinforced": { "file": "04_f1-reinforced.mp3", "captions": "04_f1-reinforced.vtt" } },
"f3": { "title": "What people really do",
        "base":       { "file": "05_f3-base.mp3",       "captions": "05_f3-base.vtt" },
        "reinforced": { "file": "05_f3-reinforced.mp3", "captions": "05_f3-reinforced.vtt" } }
```

(File names are examples. The studio's export names them from the part IDs, `04-f1-base` and `04-f1-reinforced`, and the manifest is the source of truth.)

Remove `seamAt` from f1 and f3 and stop reading it. Remove `spliceFadeMs` if nothing else uses it. Keep `gapBetweenPartsSec`, which still applies between parts.

### 3. Player

- Build the listen by picking **one** version per topic:
  - f1 and f3: `reinforced` if the frozen score is 3 or lower, otherwise `base`.
  - k2: `testup` if the pre-check is correct, otherwise `base`.
  - Everything else: its single (`universal` or `base`) file.
- Delete the splice step: no cutting `base` at `seamAt`, no inserting the add-on, no add-on fade.
- Chapters, captions and the transcript fallback work per file as before. A reinforced f1 is simply a longer chapter, so the chapter list and times must come from the chosen file.
- If a topic's `reinforced` entry is missing, fall back to `base`. That keeps the prototype playable while the new files are being generated.
- Keep the answers-frozen-at-Listen-mode behavior, so resume and replay rebuild the same listen.

### 4. Config

- In `checks`, drop the `addon` keys. `reinforced` stays and `normal` becomes `base`; the player should accept either until the rename is done.
- Rename `triggers.harder` to `testup` only if it's cheap. Otherwise leave it and note it.

## Audio we need before this plays end to end

The old add-on files can't be reused. They are 20-second extra stories, not full versions.

| Part | Needed | Source |
| --- | --- | --- |
| `04-f1-base` | The current `06_04-f1-normal` can serve for now | Existing |
| `04-f1-reinforced` | New complete conversation | Source module slide 18: the Jacob story retold from the start, then the cost after the stick (report, evaluation, blood tests, weeks of waiting, family), ending on the question to the listener |
| `05-f3-base` | The current `08_05-f3-normal` can serve for now | Existing |
| `05-f3-reinforced` | New complete conversation | Source module F3 reinforced narration: the norm correction ("memorable isn't the same as normal"), given more room |

The studio produces these now (Feel topics with the Remediate policy get a Base and a Reinforced). They must stand alone, never reference the base, and sit in the 200 to 280 word range.

## Order of work

1. Player and manifest changes, using the fallback to `base`, so nothing breaks.
2. Studio renders `04-f1-reinforced` and `05-f3-reinforced`; drop in the files and captions, bump manifest `version`.
3. Run the four checks: f1 high and low, f3 high and low. Confirm a low f1 plays `reinforced` and the post-check asks `case3rf`; a high f1 plays `base` and asks `case3`.

## Test cases

| Pre-check | Listen |
| --- | --- |
| f1 = 4, f3 = 4, k2 wrong | open, k1, k2 base, f2, f1 base, f3 base, close, continue |
| f1 = 2, f3 = 4 | same, with f1 reinforced |
| f1 = 4, f3 = 2 | same, with f3 reinforced |
| f1 = 2, f3 = 2, k2 right | k2 testup, f1 reinforced, f3 reinforced (the longest listen) |
