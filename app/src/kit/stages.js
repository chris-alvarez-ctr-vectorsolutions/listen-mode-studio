// Stage prompts, adapted from 05_stage_prompts.md. {module} is replaced with the module name.
// kind: 'doc' = read and approve; 'script' = line-by-line review; 'editor' = fresh reviewer; 'json' = render data
export const DEFAULT_STAGES = [
  {
    id: 'ledger', n: 2, title: 'Claims ledger', kind: 'doc', skippable: true,
    gate: 'An SME signs the ledger before anything is rendered for real.',
    prompt: `From the source content for {module} (the seed text and any attached source files), build a claims ledger as a table:
ID (C01, C02...) | the claim in one plain sentence | source (learning objective and slide or reference) | flag | proposed fix.
Flag any claim with a scope limit, a conflict with another claim, or a claim the source content doesn't support. Leave the flag empty for claims with no problem.
For each flagged claim, write the proposed fix as a replacement claim in one plain sentence that the source content fully supports, or "needs SME: " followed by the question an SME must answer. Never invent a fact to resolve a flag. Leave the proposed fix empty on unflagged claims.
Don't merge, generalize or add claims. Then list any claim from other attached material (prior scripts, decks) that the source content doesn't support, marked FLAG.
Stop when done.`,
  },
  {
    id: 'plan', n: 3, title: 'Episode plan', kind: 'doc',
    gate: 'You approve the plan.',
    prompt: `Using the production guide and the module files above, plan the episode for {module}.
1. List the topic parts in order, one per objective, each with: a topic key (k1, k2... for Know topics, f1, f2... for Feel topics, d1, d2... for Do topics, numbered in order within each type), objective, KFD subscale, part type (Everyone or Skippable), and versions (Normal, Harder, Add-on). Where versions aren't specified, propose them with a one-line reason.
2. Name the positions that play in every listen, and what the open may promise.
3. Build the assembly table: each distinct listen, its parts in order, and estimated runtime, ordered from fewest parts to most.
4. Describe the master script (the longest path).
Stop and wait for approval.`,
  },
  {
    id: 'beats', n: 4, title: 'Beat sheets', kind: 'doc',
    gate: 'A learning designer approves the beats.',
    prompt: `Write a beat sheet for every asset in the approved plan: the open, each topic's Normal, each Harder, each Add-on and the close.
Use the bullet style of the K1 beats in the voice example. For each, include: the objective, the way in and way out (none repeated within a listen), the one concrete detail, the claim IDs, the emotional target, any judgment hold question, and the word target. No dialogue yet.
Stop and wait for approval.`,
  },
  {
    id: 'draft', n: 5, title: 'Draft', kind: 'script',
    gate: 'You review the script line by line.',
    prompt: `Write every asset from the approved beat sheets. Match the voice example above all: its moves, its register, and its conversational back-and-forth. Follow the production guide, but where a rule seems to pull away from the voice example, follow the example. Never reuse example wording from any kit file.
Format: a heading per asset (## followed by the asset ID and title, for example "## 01-k1-normal · The blade at the bench"), then one line per speaker as "NAME: text". Cue lines (holds, stings, add-on seams) in ⟨ ⟩ on their own lines. No delivery tags yet.
Write the master script first, marking each add-on seam and each part's ending, then the Harder versions as separate assets.
Before you finish, check each asset against the "Bad, then better" and "What not to copy" sections of the voice example and fix anything that matches.
After the scripts, add a trace table mapping every claim-bearing line to its ledger ID, and list anything you needed that the ledger doesn't contain.`,
  },
  {
    id: 'validity', n: 6, title: 'Validity pass', kind: 'script',
    gate: 'New facts go to the SME. Everything else is fixed here.',
    prompt: `Run every check in the lint checklist against the latest script in this conversation.
First, report each check as pass or fail. For each failure, quote the line and give the fix. List any new facts separately under "For the SME", with the line each came from.
Then output the full corrected script in the same format as the draft (## headings per asset, "NAME: text" lines, cue lines in ⟨ ⟩), applying every fix that doesn't need a new fact.`,
  },
  {
    id: 'editor', n: 7, title: 'Editor pass', kind: 'editor',
    gate: 'You pick which fixes to apply.',
    prompt: `You're the showrunner. Review the script below against the production guide, the voice example and the lint checklist. The voice is already where we want it, so don't rewrite lines that work.
List only real problems, numbered: the line, what's wrong, and the fix. Check especially: drift from the claims ledger, anything referred to before it's introduced, questions that don't connect, lines that would sound odd in a synthetic voice, and anything repeated across parts.
Stop after the list.`,
  },
  {
    id: 'performance', n: 8, title: 'Performance pass', kind: 'json',
    gate: 'Ready to render.',
    prompt: `Run the performance pass on the final script in this conversation, following section 9 of the production guide. Don't change any wording.
Return ONLY a JSON object, with no prose before or after it, in exactly this shape:
{"parts":[{"id":"01-k1-normal","title":"The blade at the bench","claims":["C01","C03"],"segments":[{"id":"01-k1-normal-a","flag":null,"pauseAfter":0,"lines":[{"speaker":"DANA","text":"..."},{"speaker":"RAY","text":"[warmly] ..."}]}]}],
 "assembly":[{"name":"Master","parts":["00-open","01-k1-normal"]}]}
Rules:
- Every asset is a part, in master-script order, then Harder versions.
- Part IDs are lowercase and follow one pattern, because the audio and the listen prototype read them: "NN-topic" or "NN-topic-variant", where NN is the topic's position in the listen (00 for the open, then 01, 02... in order; the close takes the last number). The open is "00-open" and the close is, for example, "06-close". "topic" is the plan's topic key (k1, f2, d1). "variant" is normal, harder or addon, and is left off only when a topic has a single version (for example "03-f2"). Every version of a topic uses the same NN and topic, so "02-k2-normal" and "02-k2-harder" share a position. Use the IDs from the script headings when they already follow this pattern, and fix them when they don't.
- "claims" on each part lists every ledger claim ID its lines rest on, taken from the trace table (empty for the open and close if they carry none). Add-ons list their own.
- Speaker names in capitals, exactly as in the script.
- Delivery tags only from each voice's palette, two to four per part, where the meaning or emotion shifts. CAPS on one or two words per part. Spell numbers and initialisms as spoken.
- Split segments at every hold, add-on seam and part ending. pauseAfter is the seconds of silence after the segment: 3 for a judgment hold, 2 for an emotional hold, 0 otherwise.
- Put every line tagged [FLAG] in its own segment and set "flag" to its flag ID. Remove the [FLAG] marker from the text.
- No cue text, stage directions or segment IDs inside any line's text.
- "assembly" lists every distinct listen from the approved plan, each as an ordered list of part IDs.`,
  },
  {
    id: 'cards', n: 9, title: 'Review cards', kind: 'cards',
    gate: 'An SME and a learning designer approve every card against the ledger.',
    prompt: `Write the review set for each Know topic in the approved plan. A review set is what a learner sees after the checks when they miss a question on that topic. It is read and answered on screen, not heard, so nothing in it is a script.
Return ONLY a JSON object, with no prose before or after it, in exactly this shape:
{"reviewSets":[{"topic":"k1","title":"Short plain title",
  "cards":[{"front":"A question or prompt","back":"The answer in one or two plain sentences","claims":["C03"]}],
  "retry":[{"question":"...","options":["...","...","..."],"answer":0,"feedback":"One sentence on why.","claims":["C03"]}]}]}
Rules:
- "topic" is the same topic key used in the part IDs (k1, k2...). One set per Know topic. Skip Feel and Do topics.
- Three to five cards per topic. One fact per card, in plain words with contractions allowed and few idioms.
- Every card and retry question carries the ledger IDs it rests on. Don't add, strengthen or combine claims. If a fact you need isn't in the ledger, leave it out and list it in a final key "missing":["..."].
- Retry questions test the same fact in a new situation. The learner's original check isn't known here, so don't copy any question from the script.
- "answer" is the zero-based index of the correct option. Give two to four options, with one clearly correct.
- Nothing refers to the listen, the hosts or any character. Each card stands alone.`,
  },
];
