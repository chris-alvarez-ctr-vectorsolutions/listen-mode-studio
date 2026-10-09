## 7. Craft rules

- **The open** is a cold open: the sharpest line in content every learner hears (a line from a story, a striking detail), then the hosts' names and one short line to start. It is not an agenda read-out and does not list what's coming. It does not promise which experts the listener will hear. Under 60 words. Quoted story lines are allowed here only when that story's part plays in every listen. No host backgrounds.
- **One expert per part,** introduced inside that part by role and one line on what that role sees. The part works whatever played before it, and any expert can be skipped or reordered.
- **Narration poses the question first,** then the expert answers it. Narration is two to four sentences at a time between expert lines.
- **Never claim a real person was involved.** No "I called up," "I spoke to," "we recorded," or "someone I know." The expert is simply "a safety manager" or "a line operator," speaking.
- **The role is the credential.** Employers stay generic ("a big industrial manufacturer"). Never name a real company.
- **Sum up in one sentence, then turn.** After an answer, Dana says what it established in one sentence, then names the open question or the other side. An expert never mentions another expert.
- **Explain jargon the moment it's said,** in the next line, by Dana or the expert.
- **Land on practical guidance.** Dana turns what was said into what to do, and the part ends on the expert's own practical advice.
- **Facts come only from the claims ledger.** The expert's stories and what a role "sees" are characterization.
- **No speaker has more than two lines in a row.**
- At least one concrete, visual detail per part (the specific thing in the specific place, not an abstract label).
- Plain words, contractions, few idioms. Many listeners speak English as a second language.
- **Answers sound like speech.** Mostly full spoken sentences, but vary the rhythm the way people do: a short fragment, a trailing thought or a quick restart is fine in an answer when a person would say it that way ("Twenty years. Different kinds of places."). Never a bare list of notes, and never telegraphic fragments with no connective. A short reaction rides at the front of the next line, never its own turn.
- **Every question from Dana connects to the answer before it.**
- **Nothing is referred to before it's introduced.**
- **At most one interruption per part, in the conversational parts only.** When a speaker jumps in, mark it in the text: a dash ending the interrupted line and a dash starting the interrupting one ("So the part people forget is—" / "—the label, right."). Use it only where a real listener would already know where the line is going. Never in a part about harm, never inside a character's own story, and never in a way that cuts off a ledger claim. The interrupted line must still make sense without its ending.
- At most one light moment per part. Humor comes from the situation, not quips.
- Each part uses one way in and one way out from the lists below. None repeats within a listen. These describe moves; write fresh wording every time.

**Ways in**
- Dana poses the question a listener would ask, then names the role.
- Dana says what this topic looks like from one seat on the job, then names the role.
- Dana sets up the tension, then asks the role to take it.
- A surprising fact, from the claims ledger only, then the role.

**Ways out**
- The expert's rule of thumb, in their own words. Once per listen.
- Dana says what she'd do differently now.
- The expert's own practical advice, last.
- A question left with the listener.

## 8. Length

| Asset | Words | About |
| --- | --- | --- |
| Open | 25 to 60 | 10 to 25 seconds |
| Topic part (Base, Test-up or single) | 200 to 280 | 1:30 to 2:00 |
| Close | 20 to 50 | 10 to 20 seconds |

Runtime = words / 140, plus holds, plus about 3 seconds per sting.

## 9. Render conventions (ElevenLabs)

- Model: Eleven v4 (same tag handling as v3). Start speed at 0.95.
- Render text holds spoken words, bracketed delivery tags and punctuation only. SFX, beds, holds and stings live on the cue sheet.
- Speaker labels (DANA:, EXPERT A:, EXPERT B:, EXPERT C:) map lines to voices. The label is internal and never spoken. Send only the text after the colon.
- Tags: about four to eight per part, only where the meaning or emotion changes, never on consecutive lines. Place a tag just before the line it shapes, or just after a line as a reaction ([sighs], [laughs]). Keep to each voice's palette. Never [quietly], [softly] or a variant on a host, expert or narrator. A tag may be two short descriptive words in that voice's register ([warm, amused], [dry, deadpan]); never staging or sound tags ([music], [standing]).
  - Experts: [dry] [matter-of-fact] [thoughtful] [warmly] [laughs] [amused] [reassuring] [sighs]
  - Dana: [playful] [skeptical] [curious] [surprised] [sighs] [laughs] [amused] [warmly] [jumping in]
- Emphasis: CAPS on one or two words per part. No SSML.
- Short pauses: an ellipsis, a dash or punctuation (never [pause] or SSML break tags). Anything 2 seconds or longer is a hold on the cue sheet.
- Spell out as spoken: numbers ("more than nine out of ten"), initialisms (H-I-V, P-P-E, U-S).
- Split each part into render segments at every hold and at the ending.
- Optional, outside the script: a phone-call or different-room sound on the expert voices can be added after rendering so they read as tape. Write nothing about it in the script.

