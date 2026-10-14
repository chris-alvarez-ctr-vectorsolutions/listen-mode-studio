// Stage prompts, adapted from 05_stage_prompts.md. {module} is replaced with the module name; {speaker1}, {speaker2} and {speakers} with the cast of its conversation type.
// kind: 'doc' = read and approve; 'script' = line-by-line review; 'editor' = fresh reviewer; 'json' = render data
export const DEFAULT_STAGES = [
  {
    id: 'ledger', n: 2, title: 'Claims ledger', kind: 'doc', skippable: true,
    gate: 'An SME signs the ledger before anything is rendered for real.',
    purpose: "The list of facts the script is allowed to say. Every line of the script traces back to it.",
    check: ["Is each claim true, in scope and worded plainly?", "For each flagged claim, accept the proposed fix, edit it, or send it to the SME.", "Have the SME sign it before anything is rendered for real."],
    next: "Outline",
    prompt: `From the source content for {module} (the seed text and any attached source files), build a claims ledger as a table:
ID (C01, C02...) | the claim in one plain sentence | source (learning objective and slide or reference) | flag | proposed fix.
Flag any claim with a scope limit, a conflict with another claim, or a claim the source content doesn't support. Leave the flag empty for claims with no problem.
For each flagged claim, write the proposed fix as a replacement claim in one plain sentence that the source content fully supports, or "needs SME: " followed by the question an SME must answer. Never invent a fact to resolve a flag. Leave the proposed fix empty on unflagged claims.
Don't merge, generalize or add claims. Then list any claim from other attached material (prior scripts, decks) that the source content doesn't support, marked FLAG.
Stop when done.`,
  },
  {
    id: 'plan', n: 3, title: 'Outline', kind: 'doc',
    gate: 'You approve the outline.',
    purpose: "The outline of the content, the same for every variant. It says what each part has to cover, which claims it uses, and how the listens are built. It says nothing about who it is for or what scenario it uses: each variant decides that.",
    check: ["Does each part cover the right objective, and only that?", "Are the claims you care about assigned to a part?", "Do the listens look right, with at least three chapters each?", "Does \"Needs your attention\" list anything to settle first?"],
    next: "Variants. Make one for each industry and role, and each gets its own beat sheets",
    prompt: `Using the production guide and the module files above, write the outline of the content for {module}. The pathway table above is fixed: the objectives, their KFD types, the versions each one needs, the part IDs and the listens. Don't add, drop, rename or re-route any of it. If the table is missing, say so and stop.
This outline is shared by every variant of the module, each for a different industry and learner role. So it holds only what does not depend on the audience. Do not choose a scenario, a setting, a story, a way in or out, or an example, and do not name an industry or a role. Those are chosen per variant, in the beat sheets. Keep every table cell to one short line.
Use exactly these four sections, each starting with a "##" heading:
## Parts
A table with one row per part in the pathway table, in listen order, plus the open and the close. Columns: Part ID | Objective | What it must get across (one line, in plain words) | Claims (ledger IDs). A Test-up is a harder version with the same facts, and the learner never heard the Base. A Reinforced version gives a Feel topic more weight with the same facts, and replaces the Base. The open only covers content from positions that play in every listen.
## Plays in every listen
One or two lines: which positions play in every listen, and what the open may promise.
## Listens
A table copied from the pathway table. Columns: Listen | Parts (IDs) | Chapters | Estimated runtime. Order the rows from fewest chapters to most, and flag any listen under three chapters. Then one sentence describing the master script (the Full listen).
## Needs your attention
A short bullet list of only real problems: an objective the ledger doesn't support, ledger claims no part uses, or a listen under three chapters. Write "Nothing." if there are none.
Stop and wait for approval.`,
  },
  {
    id: 'beats', n: 4, title: 'Beat sheets', kind: 'doc',
    gate: 'A learning designer approves the beats.',
    purpose: "An outline for each part, fitted to this variant's industry and learner role: the scenario it uses, how it opens and closes, what is said and with which claims. The script is written from these, so changes are cheapest here.",
    check: ["Does the scenario fit this industry and role, and would the learner recognize it?", "Does each part meet its objective, with a concrete detail worth hearing?", "Does each part take a different shape and way in from the others?", "Are the required claims present, and none invented?"],
    next: "Draft, the first full script",
    prompt: `Write a beat sheet for every asset in the approved outline, fitted to this show's industry and learner role (see the show setup above): the open, every part in the pathway table (Base, Test-up, Reinforced or single version) and the close.
Start with a section headed "## Anchor": one line naming the single setting or object (a property tray, a booking counter) that every part, including Test-up and Reinforced versions, will use concretely so the parts hold together without bridges. It must come from the source content and suit this industry and role. Then one section per asset.
Use the bullet style of the beats in the voice example. In every part, name how the anchor shows up, and, in a Know part, which moves the host makes besides asking (reacting, setting up a scenario, correcting a common assumption). Do not number or script the turns. For each, include the shape the part will take (chosen from the pattern library, and different from the other parts), then: the objective, the angle (one line: the scenario, story or evidence it will use, chosen for this industry and role), the way in and way out (none repeated within a listen), the one concrete detail, the claim IDs the part carries (for the part as a whole, not tied to individual turns), the emotional target, any judgment hold question, and the word target. If the cast guide gives the expert a background, the open's beat sheet gives its cold-open line and where it comes from, and also covers the host intro that follows the open in the same asset: quote the background text it will use (so the draft stays inside it), say that the host states one specific fact from it and asks one short question that invites a reaction (the expert is a co-host who already introduced himself, never a guest), say that the expert answers in the first person with a view or a feeling that builds on the background, without parroting her sentence back or adding a career fact beyond that text, and say that the host ties his experience to the subject of the whole episode in one line (never a generic "let's get going"), without naming any topic part. If the cast guide gives no background, write no host intro and note that in the beat sheet. Never invent a background or a role question.
Write no dialogue: no questions, no lines and no sample wording for either speaker. Describe what each turn does and which facts it lands, never what is said.
Stop and wait for approval.`,
  },
  {
    id: 'draft', n: 5, title: 'Draft', kind: 'script',
    gate: 'You review the script line by line.',
    purpose: "The first full script. The beats say what each part must do and which facts it lands. The draft finds the words.",
    check: ["Read it aloud. Does it sound like people talking, not reading?", "Click a line to leave a note, or save a note as a rule for every future module.", "Does every fact trace to the trace table at the end?"],
    next: "Validity pass, which checks it against the rules",
    prompt: `Write every asset from the approved beat sheets. The beat sheets say what each part must do and which facts it must land. They are not a script: write every line fresh, in the speakers' voices, and never copy phrasing from a beat sheet. Keep each part's shape, its way in and way out, its facts and any hold; the turns in between are yours, and you may reorder or merge them if the talk reads more naturally. Where a beat describes a question or an answer, find your own words for it. Where it quotes background text or a claim, say it in your own words and add no fact. Match the register of the voice example: how the hosts sound and their conversational back-and-forth. Take each part's shape from its beat sheet and the pattern library, not from the voice example's script, and never follow its sequence of moves, questions or lines. Follow the production guide. Never reuse example wording from any kit file.
Format: a heading per asset (## followed by the part ID from the pathway table and the title, for example "## 01-k1-base · A short plain title"), then one line per speaker as "NAME: text". Cue lines (holds and stings) in ⟨ ⟩ on their own lines. No delivery tags yet.
Write the Full listen's parts first, in order, then each Test-up and Reinforced version as a separate asset. Every part stands alone, and a Test-up or Reinforced version never relies on the learner having heard the Base.
Write it as two people talking, following the conversation feel rules: the host reacts and sets up scenarios as well as asking, a reaction rides on the front of the next line, turns vary in length, and no point or figure is repeated. Every host question is aimed at the expert so he is clearly asked, and the host never echoes the expert's rule in her next turn, and no frame ("I'd have...", "here's one for you") is used twice in a listen. Write the close as the pathway table's last part: a short fallback, 20 to 50 words, that ends on a reflection question for the learner or a callback to content every learner hears, with no thank-you and no "that's our time." Do not write bridges between parts: the Seams stage writes them, and its closer replaces this close where it fits.
Before you finish, check each asset against the "Principles from review" and "What not to copy" sections of the voice example, and against the open's "what to avoid" list, and fix anything that matches.
After the scripts, add a trace table mapping every claim-bearing line to its ledger ID, and list anything you needed that the ledger doesn't contain.`,
  },
  {
    id: 'validity', n: 6, title: 'Validity pass', kind: 'script',
    gate: 'Click each line to add editor notes.',
    purpose: "A checklist pass that fixes mechanical problems and flags any new fact for the SME. It does not rewrite lines that work.",
    check: ["Read each failure and its fix.", "Anything under \"For the SME\" needs an answer before it can stay in the script."],
    next: "Editor pass, a fresh reviewer",
    prompt: `Run every check in the lint checklist against the latest script in this conversation.
First, report each check as pass or fail. For each failure, quote the line and give the fix. List any new facts separately under "For the SME", with the line each came from. Treat as new facts any added detail the ledger doesn't state: how a device or process works or looks, a superlative or absolute ("most effective," "always"), what a person knew or was trained on, or a consequence. Flag them, quote the line, and don't cut them silently.
The app has already counted the mechanical checks, and lists them above under "Mechanical checks" (casual markers, one-word reaction turns, em dashes, long sentences, three lines in a row, repeated openers, interruptions, word counts and runtime). Don't recount them. Report each exact result as a failure with the fix, judge each candidate and report only the real ones, and use its word counts for the length checks. You still judge, from the script: any repeated question/answer frame, any point or figure said twice within two turns, and any fact inside a character's story. Report each as a failure with the fix.
Then output the full corrected script in the same format as the draft (## headings per asset, "NAME: text" lines, cue lines in ⟨ ⟩), applying every fix that doesn't need a new fact.`,
  },
  {
    id: 'editor', n: 7, title: 'Editor pass', kind: 'editor',
    gate: 'You pick which fixes to apply.',
    purpose: "A fresh reviewer reads the script cold and lists real problems. You choose which fixes to apply.",
    check: ["Apply the fixes you agree with and skip the rest.", "Edit a fix before applying it if it is close but not right."],
    next: "Performance pass, which adds delivery tags",
    prompt: `You're the showrunner. Review the script below against the production guide, the voice example and the lint checklist. Don't rewrite lines that work. Do flag any part whose shape or lines track the voice example instead of its own beat sheet.
List only real problems, numbered: the line, what's wrong, and the fix. Check especially, as a listener: whether the host only feeds questions, turns of the same length, repeated frames ("Even X?"), a point said twice, facts dropped into a story, staged or polite filler ("off mic", thanking each other), an open that reads out an agenda, and drift from the claims ledger, anything referred to before it's introduced, questions that don't connect, lines that would sound odd in a synthetic voice, and anything repeated across parts.
Stop after the list.`,
  },
  {
    id: 'performance', n: 8, title: 'Performance pass', kind: 'json',
    gate: 'Ready to render.',
    purpose: "Adds delivery directions to every line (tone, emphasis, short pauses) and splits the script into the pieces that get recorded. It changes no wording.",
    check: ["Does every part in your pathway table appear in the list below?", "Open the script and skim a few lines: do the directions in [brackets] fit what the line says?"],
    next: "Render audio, where the voices record it",
    prompt: `Run the performance pass on the final script in this conversation, following section 9 of the production guide. Don't change any wording.
Return ONLY a JSON object, with no prose before or after it, in exactly this shape:
{"parts":[{"id":"01-k1-base","title":"A short plain title","claims":["C01","C03"],"segments":[{"id":"01-k1-base-a","flag":null,"pauseAfter":0,"lines":[{"speaker":"{speaker1}","text":"..."},{"speaker":"{speaker2}","text":"[warmly] ..."}]}]}],
 "assembly":[{"name":"Master","parts":["00-open","01-k1-base","02-close"]}]}
Rules:
- Every asset is a part, in listen order, then the Test-up and Reinforced versions.
- Part IDs come from the pathway table above. Use them exactly, because the audio and the listen prototype read them: "NN-topic-variant", where NN is the topic's position in the listen (00 for the open, then 01, 02... in order; the close takes the last number), topic is the objective ID in lowercase (k1, f1), and variant is base, testup or reinforced. A topic with a single version has no variant (for example "03-f2"). Every version of a topic shares the same NN and topic. If a script heading uses a different ID, fix it to the table's.
- "claims" on each part lists every ledger claim ID its lines rest on, taken from the trace table (empty for the open and close if they carry none).
- Speaker names in capitals, exactly as in the script ({speakers}, plus any character).
- Never a [quietly], [softly] or similar tag on the hosts, expert or narrator. Delivery tags only from each voice's palette, four to eight per part, never on consecutive lines, no tag more than twice in a part, where the meaning or emotion shifts. A tag may be two short descriptive words in the voice's register. Use ellipses, dashes and punctuation for short pauses, never [pause]. When a line ends in a dash and the next starts with one (an interruption), keep both in the same segment. CAPS on one or two words per part. Spell numbers and initialisms as spoken.
- In the open asset, when the open has a host intro, make the open proper one segment and the host intro a second segment, with pauseAfter 0 on the first (the renderer keeps the theme music with the open proper and starts the host intro after the music's tail). The host intro gets no music.
- Split segments at every hold. pauseAfter is the seconds of silence after the segment: 3 for a judgment hold (only after a question spoken directly to the listener, never after one speaker asks another; the segment after the hold starts with the host handing the floor back, e.g. "Okay, [name], let's hear your answer now.", using whoever answers), 2 for an emotional hold, 0 otherwise.
- Put every line tagged [FLAG] in its own segment and set "flag" to its flag ID. Remove the [FLAG] marker from the text.
- No cue text, stage directions or segment IDs inside any line's text.
- "assembly" lists every listen in the pathway table with the same names, each as an ordered list of part IDs.`,
  },
  {
    id: 'seams', n: 9, title: 'Seams', kind: 'seams', skippable: true,
    gate: 'You approve the bridges and the closer.',
    purpose: "Short bridges between topics and a closer, written once for every pair of topics a learner can move between. Each sits between two parts and is played only when both are in the learner's listen, so the parts stay standalone.",
    check: ["Does each bridge sound like the same two people moving on, using the shared anchor?", "Do the bridges work whichever version of either topic the learner heard, and when topics between them were skipped?", "Does each closer end on a question for the learner or a callback, not a thank-you?"],
    next: "Render audio, where the voices record it",
    prompt: `Write the seams for {module}: bridges between topics and a closer. The pairs and last topics are listed above, computed from the pathway table. Use them exactly: don't add, drop or rename any.
Bridge, for each pair (from, to): one to three lines, under 40 words, in the voices of the show. It closes the topic just heard and opens the next, using the shared anchor from the episode plan. It must work whichever version (Base, Test-up or Reinforced) of either topic the learner heard, and when topics between the two were skipped, so never name a skipped topic and never say what the learner learned. State no new facts: say a fact only if it is a ledger claim, and prefer none. The next part still opens with its own signpost, so a bridge only hands over.
Closer, for each topic that can be the last one: two to four lines, under 50 words. It ends on a reflection question that asks the learner to check something at their own workplace, or on a callback to that topic's anchor detail. No thanks, no "that's our time," and no list of what was covered. Don't mention topics other than that one.
Follow the conversation feel rules. Delivery tags from each voice's palette: none or one per seam.
Return ONLY a JSON object, with no prose before or after it, in exactly this shape:
{"bridges":[{"from":"k1","to":"f1","lines":[{"speaker":"{speaker1}","text":"..."},{"speaker":"{speaker2}","text":"..."}]}],"closers":[{"after":"f1","lines":[{"speaker":"{speaker1}","text":"..."}]}]}
Speaker names in capitals, exactly as in the script ({speakers}). The from, to and after values are the topic keys from the list above.`,
  },
];
