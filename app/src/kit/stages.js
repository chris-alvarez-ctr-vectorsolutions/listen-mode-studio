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
    prompt: `Using the production guide and the module files above, plan the episode for {module}. The pathway table above is fixed: the objectives, their KFD types, the versions each one needs, the part IDs and the listens. Don't add, drop, rename or re-route any of it. If the table is missing, say so and stop.
1. For each part in the table, in order, give: the part ID, the objective, the angle in one line (the scenario, story or evidence it will use), the way in and way out, and the ledger claim IDs it rests on. A Test-up is a harder scene with the same facts, and the learner never heard the Base. A Reinforced version gives a Feel topic more weight with the same facts, and replaces the Base.
2. Name the positions that play in every listen, and what the open may promise. The open can only promise content from positions that play in every listen.
3. Copy the listens from the table into an assembly table, add each one's estimated runtime, and order them from fewest chapters to most. Flag any listen under three chapters.
4. Describe the master script (the Full listen).
5. List any objective the ledger doesn't support.
Stop and wait for approval.`,
  },
  {
    id: 'beats', n: 4, title: 'Beat sheets', kind: 'doc',
    gate: 'A learning designer approves the beats.',
    prompt: `Write a beat sheet for every asset in the approved plan: the open, every part in the pathway table (Base, Test-up, Reinforced or single version) and the close.
Use the bullet style of the K1 beats in the voice example. For each, include: the objective, the way in and way out (none repeated within a listen), the one concrete detail, the claim IDs, the emotional target, any judgment hold question, and the word target. No dialogue yet.
Stop and wait for approval.`,
  },
  {
    id: 'draft', n: 5, title: 'Draft', kind: 'script',
    gate: 'You review the script line by line.',
    prompt: `Write every asset from the approved beat sheets. Match the voice example above all: its moves, its register, and its conversational back-and-forth. Follow the production guide, but where a rule seems to pull away from the voice example, follow the example. Never reuse example wording from any kit file.
Format: a heading per asset (## followed by the part ID from the pathway table and the title, for example "## 01-k1-base · The blade at the bench"), then one line per speaker as "NAME: text". Cue lines (holds and stings) in ⟨ ⟩ on their own lines. No delivery tags yet.
Write the Full listen's parts first, in order, then each Test-up and Reinforced version as a separate asset. Every part stands alone, and a Test-up or Reinforced version never relies on the learner having heard the Base.
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
{"parts":[{"id":"01-k1-base","title":"The blade at the bench","claims":["C01","C03"],"segments":[{"id":"01-k1-base-a","flag":null,"pauseAfter":0,"lines":[{"speaker":"DANA","text":"..."},{"speaker":"RAY","text":"[warmly] ..."}]}]}],
 "assembly":[{"name":"Master","parts":["00-open","01-k1-base","02-close"]}]}
Rules:
- Every asset is a part, in listen order, then the Test-up and Reinforced versions.
- Part IDs come from the pathway table above. Use them exactly, because the audio and the listen prototype read them: "NN-topic-variant", where NN is the topic's position in the listen (00 for the open, then 01, 02... in order; the close takes the last number), topic is the objective ID in lowercase (k1, f1), and variant is base, testup or reinforced. A topic with a single version has no variant (for example "03-f2"). Every version of a topic shares the same NN and topic. If a script heading uses a different ID, fix it to the table's.
- "claims" on each part lists every ledger claim ID its lines rest on, taken from the trace table (empty for the open and close if they carry none).
- Speaker names in capitals, exactly as in the script.
- Delivery tags only from each voice's palette, two to four per part, where the meaning or emotion shifts. CAPS on one or two words per part. Spell numbers and initialisms as spoken.
- Split segments at every hold and at the part ending. pauseAfter is the seconds of silence after the segment: 3 for a judgment hold, 2 for an emotional hold, 0 otherwise.
- Put every line tagged [FLAG] in its own segment and set "flag" to its flag ID. Remove the [FLAG] marker from the text.
- No cue text, stage directions or segment IDs inside any line's text.
- "assembly" lists every listen in the pathway table with the same names, each as an ordered list of part IDs.`,
  },
];
