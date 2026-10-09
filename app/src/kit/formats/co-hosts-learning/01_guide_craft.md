## 7. Craft rules

- **The open** is a cold open: the sharpest line in content every learner hears (a line from a story, a striking detail), then the hosts' names and one short line to start. It is not an agenda read-out and does not list what's coming. It may say the co-hosts are learning this together. Under 60 words. Quoted story lines are allowed here only when that story's part plays in every listen. No host backgrounds.
- **The first answer in a part defines the topic in plain words.** The other co-host then connects it to something the listener has probably seen at work.
- **Attribute every fact, in plain words.** "The procedure says..." "According to the training..." The authority is the source, which is the claims ledger said out loud. Name a source only as the ledger names it. Never invent one.
- **Split the reading.** Each co-host brings different parts of the material, so neither is the expert. Alternate who reports.
- **Say what the material doesn't cover,** and say it plainly. An honest gap beats a confident guess. List each gap for the SME.
- **No guessing about facts, even as a joke.** A joke may be about the situation. It never states or implies a fact the ledger doesn't hold.
- **The other co-host reacts and adds a layer** to what was just reported: a question, a connection to work, or one light joke. Short backchannels ("Yeah." "Right." "Huh.") are their own lines.
- **Relate it to their own work.** One line, in each co-host's own words. It is characterization only and never carries a fact, a statistic, an injury or an outcome.
- **Neither co-host speaks as an authority.** No "in my years," no "I've seen," no "trust me." They say what the training says.
- **End with the practical list, said once,** if the ledger holds a real list or sequence. Then one line that leaves the listener with a question.
- **No speaker has more than two lines in a row.**
- At least one concrete, visual detail per part (the specific thing in the specific place, not an abstract label).
- Plain words, contractions, few idioms. Many listeners speak English as a second language.
- **Answers sound like speech.** Mostly full spoken sentences, but vary the rhythm the way people do: a short fragment, a trailing thought or a quick restart is fine in an answer when a person would say it that way ("Twenty years. Different kinds of places."). Never a bare list of notes, and never telegraphic fragments with no connective. A short reaction rides at the front of the next line, never its own turn.
- **Every question connects to the answer before it.** Jargon is explained in the next line.
- **Nothing is referred to before it's introduced.**
- **At most one interruption per part, in the conversational parts only.** When a speaker jumps in, mark it in the text: a dash ending the interrupted line and a dash starting the interrupting one ("So the part people forget is—" / "—the label, right."). Use it only where a real listener would already know where the line is going. Never in a part about harm, never inside a character's own story, and never in a way that cuts off a ledger claim. The interrupted line must still make sense without its ending.
- At most one light moment per part. Humor comes from the situation, not quips.
- Each part uses one way in and one way out from the lists below. None repeats within a listen. These describe moves; write fresh wording every time.

**Ways in**
- One co-host defines the topic in plain words, and the other ties it to something at work.
- One co-host says what they found when they read it, and where.
- One co-host asks the plain question a listener would ask.
- One co-host admits the topic was new to them.
- A surprising fact from the claims ledger only, attributed to its source.

**Ways out**
- The practical list, said once.
- One co-host says what they'll do differently now.
- A callback to the moment the part opened with.
- A short acknowledgment that closes the part cleanly.
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
- Speaker labels (DANA:, RAY:) map lines to voices. Send only the text after the colon.
- Tags: about four to eight per part, only where the meaning or emotion changes, never on consecutive lines. Place a tag just before the line it shapes, or just after a line as a reaction ([sighs], [laughs]). Keep to each voice's palette. Never [quietly], [softly] or a variant on a host, expert or narrator. A tag may be two short descriptive words in that voice's register ([warm, amused], [dry, deadpan]); never staging or sound tags ([music], [standing]).
  - Ray: [dry] [matter-of-fact] [thoughtful] [warmly] [laughs] [amused] [reassuring] [sighs]
  - Dana: [playful] [skeptical] [curious] [surprised] [sighs] [laughs] [amused] [warmly] [jumping in]
- Emphasis: CAPS on one or two words per part. No SSML.
- Short pauses: an ellipsis, a dash or punctuation (never [pause] or SSML break tags). Anything 2 seconds or longer is a hold on the cue sheet.
- Spell out as spoken: numbers ("more than nine out of ten"), initialisms (H-I-V, P-P-E, U-S).
- Split each part into render segments at every hold and at the ending.

