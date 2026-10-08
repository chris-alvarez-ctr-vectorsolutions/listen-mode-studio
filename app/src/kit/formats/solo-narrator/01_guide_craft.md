## 7. Craft rules

- **The open** has a fixed shape, the one the voice example's open shows: a short teaser of three or four sentences (a surprising fact, why it matters on this job, the tension), then one plain promise line naming today's topic. Only content every learner hears. Under 60 words.
- **State the one big idea at the start of each part, and land on it at the end.** Say it in nearly the same plain words both times.
- **Signpost every turn in plain words:** "First, what counts as a sharp." "Before we get into the steps, the basics."
- **Put a one-line pivot on its own before each new section,** a single sentence that does the work a second voice would do ("Getting it right is another matter.").
- **Talk to the listener as "you,"** and say what they are probably thinking. Never tell them what they feel.
- **Ask the listener a question, then answer it.** At least one question to the listener in every topic part.
- **Explain a hazard or a rule by contrast with something familiar,** and tie a technical name to the thing everyone already knows.
- **Vary sentence length on purpose:** a longer explanation, then a short line. Plain words, contractions, few idioms. Many listeners speak English as a second language.
- **Every setup needs its payoff in the same part.** If a line sets up a moment, the part must deliver what happens next. Never tell the listener to hold onto a picture.
- At least one concrete, visual detail per part (the specific thing in the specific place, not an abstract label).
- **Nothing is referred to before it's introduced.** Never "the rule" until the narrator has said which rule.
- **No references to other parts, episodes or listens.** Not "as we said," not "next time."
- At most one light moment per part. The humor comes from the situation.
- Short fragments are fine for rhythm and emphasis, a few per part. Everything else is a full spoken sentence.
- One voice for several minutes can go flat. Give each pivot line and each question to the listener its own delivery, and keep a part to one idea so it never runs long.

Each part uses one way in and one way out from the lists below. None repeats within a listen. These describe moves; write fresh wording every time.

**Ways in**
- A plain one-line setup of the topic.
- A question the listener would ask.
- A surprising fact, from the claims ledger only.
- A short scene from the material, told in one or two sentences.
- What the listener probably thinks they already know.

**Ways out**
- The one big idea, said again in plain words.
- A rule of thumb, once per listen.
- What to do next time, in one sentence.
- A callback to the moment the part opened with.
- A question left with the listener.

**Shapes from the pattern library that fit this format:** start inside the listener's question; follow one concrete thing through the whole process; speak to the listener first; open on a strange, concrete detail then widen; give a procedure as numbered steps only when the ledger holds a real sequence. The ones that need a second voice (tease with a host, a background story from an expert) do not apply.

## 8. Length

| Asset | Words | About |
| --- | --- | --- |
| Open | 25 to 60 | 10 to 25 seconds |
| Topic part (Base, Test-up or single) | 200 to 280 | 1:30 to 2:00 |
| Close | 20 to 50 | 10 to 20 seconds |

Runtime = words / 140, plus holds, plus about 3 seconds per sting.

## 9. Render conventions (ElevenLabs)

- Model: Eleven v4 (same tag handling as v3). Start speed at 0.95. One voice, so there is no speaker change to carry the pacing: the punctuation does it.
- Render text holds spoken words, bracketed delivery tags and punctuation only. SFX, beds, holds and stings live on the cue sheet.
- The speaker label (NARRATOR:) maps every line to the one voice. Send only the text after the colon.
- Tags: about four to eight per part, only where the meaning or emotion changes, never on consecutive lines. Place a tag just before the line it shapes, or just after a line as a reaction ([sighs], [laughs]). Mostly on pivot lines and questions to the listener. Keep to the voice's palette. A tag may be two short descriptive words in that voice's register ([warm, amused], [dry, deadpan]); never staging or sound tags ([music], [standing]).
  - Narrator: [matter-of-fact] [thoughtful] [warmly] [curious] [dry] [quietly] [amused] [reassuring]
- Emphasis: CAPS on one or two words per part. No SSML.
- Short pauses: an ellipsis, a dash or punctuation (never [pause] or SSML break tags), especially right before a pivot line and right after a question to the listener. Anything 2 seconds or longer is a hold on the cue sheet.
- Spell out as spoken: numbers ("more than nine out of ten"), initialisms (H-I-V, P-P-E, U-S).
- Split each part into render segments at every hold and at the ending.

