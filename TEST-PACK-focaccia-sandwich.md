# Test pack: Making an Italian Focaccia Sandwich

A fictional module for running the full pipeline once, start to finish. Every claim below is made up for the test, so nothing needs a real SME. Leave the SME box **unchecked** and your audio will be named `DRAFT-...`, which is what you want here.

There is a second, realistic test at the bottom that uses the Contain the Sharp video script as a source file.

## 0. Before you start

- Worker deployed, app running (`cd app && npm run dev`).
- Settings: worker URL (and app token if set), ElevenLabs model picked, voices mapped for **DANA** and **RAY**.
- Kit page: if you saved the kit before this version, **reset it** (or at least the Claims ledger, Episode plan, Beat sheets, Draft and Performance prompts, plus the production guide and lint checklist). Saved prompts override the new defaults.
- Cost tip: the full run is 7 Claude stages plus renders. Render one part first.

## 1. Create the module

Module name: `Making an Italian Focaccia Sandwich`

**Audience and sector**
```
Line cooks and prep staff at a casual cafe. They build sandwiches to order during a busy lunch rush, and most have never worked with focaccia before.
```

**Learning objectives** (one per line)
```
The learner can explain why focaccia is cooled and sliced a certain way before it is used for a sandwich.
The learner can name the order of layers that keeps the bread from going soggy.
The learner can recognize why a sandwich that looks fine at the pass can fail by the time the customer eats it.
The learner can build a focaccia sandwich in the correct order, start to finish.
```

**Content claims** (one per line, source in brackets)
```
Focaccia is cooled completely before it is sliced. [Cafe prep SOP, section 1]
Focaccia is sliced horizontally with a serrated knife, using a gentle sawing motion rather than pressing down. [Cafe prep SOP, section 1.2]
Slicing warm focaccia squashes the crumb and tears the crust. [Cafe prep SOP, section 1.3]
A thin layer of olive oil is brushed on both cut sides before any filling goes on. [Cafe prep SOP, section 2]
The oil layer works as a barrier between the bread and wet fillings. [Cafe prep SOP, section 2]
Layers go on in this order: cheese first, then cured meat, then greens, then tomato last. [Cafe prep SOP, section 3]
Tomato goes in last and is patted dry first, because it is the wettest ingredient. [Cafe prep SOP, section 3.2]
A sandwich built in the wrong order can look fine at the pass and be soggy within minutes. [Cafe prep SOP, section 3.4]
The sandwich is pressed lightly with the palm, never flattened. [Cafe prep SOP, section 4]
Each sandwich is cut in half on a slight diagonal and wrapped in paper. [Cafe prep SOP, section 5]
```

**Skip rules**
```
Skip how to bake the focaccia, sourcing ingredients, and allergen labeling.
```

**Versions and constraints**
```
Do not name specific brands or cheeses. Do not give times or temperatures. About 6 minutes total.
```

**Pathway table** (use **Add objective** four times)

| ID | Objective | Type / subscale | Policy | Lock | In the audio |
| --- | --- | --- | --- | --- | --- |
| K1 | Explain why focaccia is cooled and sliced a certain way | Know / Remember | Gate | Open: can test out | yes |
| K2 | Name the order of layers that keeps the bread from going soggy | Know / Observe | Remediate | Compliance-locked | yes |
| F1 | Recognize why a sandwich that looks fine at the pass can fail | Feel / Believe | Remediate | n/a | yes |
| D1 | Build a focaccia sandwich in the correct order | Do / Apply | Never skipped | n/a | no (Do is never audio) |

Open the **Parts and listens this produces** line under the table and confirm:

- Parts: `00-open, 01-k1-base, 02-k2-base, 02-k2-testup, 03-f1-base, 03-f1-reinforced, 04-close`
- Listens: Full; K1 tested out; K2 tested up; F1 reinforced.
- No warning about too few chapters (three audio objectives is the minimum).

Tip: the Template tab on the seed page takes a prompt and a pasted document, so you can also fill all of the above in one go. Leave the SME sign-off (on the Claims ledger stage) unchecked.

## 2. Run the stages

| # | Stage | What you should see | Quick check |
| --- | --- | --- | --- |
| 2 | Claims ledger | A table C01 to C10 with a proposed fix column on any flagged row | Flagged claims show as cards with decisions. Try Use the suggestion, Write my own and Send to SME on different cards. |
| 3 | Episode plan | The parts from the pathway table, an angle per part, the open's promises, the assembly table | The plan **doesn't add, drop or rename** versions. No Add-on, no Harder, no remedial. K2 has a Test-up, F1 has a Reinforced. |
| 4 | Beat sheets | One beat sheet per part, plus open and close | Each lists claim IDs, a concrete detail and a word target. |
| 5 | Draft | `## 01-k1-base · ...` headings, `NAME: text` lines, cues in ⟨ ⟩ | Open under 60 words. Test-up and Reinforced parts don't refer to the Base. Click a line to leave a note. |
| 6 | Validity pass | Pass/fail per check, then a corrected script | Anything under "For the SME" is a new fact. |
| 7 | Editor pass | Numbered problem list from a fresh conversation | Paste only the fixes you agree with and apply them. |
| 8 | Performance pass | JSON only | Part IDs match the pathway table exactly. A note appears if any are missing or extra. |

## 3. Render and export

1. Render one part first (`00-open` is cheapest), check the voices, then render the rest.
2. **Render all parts** downloads the prototype package.

## 4. What to verify at the end

- **Filenames** start with `DRAFT-`.
- **Package** has `manifest.json`, `audio/*.wav`, per-part `.vtt` captions and a combined `.vtt` per listen.
- **manifest.json** `topics` has `k1`, `k2`, `f1` (and `open`, `close`). Each carries `kfd`, `policy`, `lock` and `routing` (`testOut`, `testUp`, `reinforce`). `k2` has `base` and `testup`, `f1` has `base` and `reinforced`. There's a top-level `pathways` block with `feelLowMax: 3`.
- **No warnings** about missing versions or parts outside the table.
- **Impact page**: every claim C01 to C10 is cited by at least one part.
- **Staleness**: edit the wording of C07, then check Impact and the export flag the parts built from it.

## 5. Things worth trying to break

- Change K1 to "Open today, with a test-up in case it gets locked" and confirm a `01-k1-testup` part and a "K1 tested up" listen appear.
- Remove F1's Reinforced by setting its policy to Ask. It should collapse to a single `03-f1` part.
- Delete F1 so only two objectives are in the audio and confirm the too-few-chapters warning shows.
- Rename a part ID in the Performance JSON and confirm the mismatch note appears.
- Add a claim that needs a number (a bake time) and confirm the script writes around it, given the "no times or temperatures" constraint.

## 6. Second test: Contain the Sharp (realistic)

Create a module named `Contain the Sharp (Manufacturing)`. On the seed page, upload the video course script PDF as a source file (the text is read in the browser), then click **Suggest from the seed and source files** under the pathway table.

Expected table, to check what it reads:

| ID | Type / subscale | Policy | Lock |
| --- | --- | --- | --- |
| K1 | Know / Remember | Gate | Open today, with a test-up in case it gets locked |
| K2 | Know / Observe | Remediate | Compliance-locked |
| F2 | Feel / Value | Ask | n/a |
| F1 | Feel / Believe | Remediate | n/a |
| F3 | Feel / Perceive | Remediate | n/a |
| D1, D2 | Do | Never skipped, Gate | n/a (not audio) |

Put F2 before F1 and F3 to match the chapter order in the deck. The parts should then match the podcast deck's library: open, `01-k1-base`, `01-k1-testup`, `02-k2-base`, `02-k2-testup`, `03-f2`, `04-f1-base`, `04-f1-reinforced`, `05-f3-base`, `05-f3-reinforced`, close. (The deck's remedial chapters are intentionally not here.)
