# Adversarial riddle: "Tomorrow, Mara will say"

**Riddle:**

> Tomorrow, Mara will say: "The day after tomorrow is my favourite day." Mara never says anything false, and her words are relative to the day she speaks them. Her favourite day is the day of the week whose name shares exactly one letter with the first word of this riddle and exactly four letters with its last word. Compare letters only, ignoring capitals and punctuation, and count each different letter once. What day of the week was yesterday?

---

**Answer:** Monday.

**Solution:**

1. The first word of the riddle is *Tomorrow*: letters {T, O, M, R, W}. The last word is *yesterday*: letters {Y, E, S, T, R, D, A}.
2. Distinct letters each day name shares with those two words:

   | Day | with TOMORROW | with YESTERDAY |
   |---|---|---|
   | MONDAY | M, O = 2 | D, A, Y = 3 |
   | TUESDAY | T = 1 | T, E, S, D, A, Y = 6 |
   | WEDNESDAY | W = 1 | E, D, S, A, Y = 5 |
   | THURSDAY | T, R = 2 | T, R, S, D, A, Y = 6 |
   | FRIDAY | R = 1 | R, D, A, Y = 4 |
   | SATURDAY | T, R = 2 | S, A, T, R, D, Y = 6 |
   | SUNDAY | none = 0 | S, D, A, Y = 4 |

   Exactly one with TOMORROW: Tuesday, Wednesday, Friday. Exactly four with YESTERDAY: Friday, Sunday. Both: **Friday** is Mara's favourite day.
3. Mara speaks tomorrow (today + 1). Her "day after tomorrow" is two days after she speaks: today + 3. That day is Friday, so today is Tuesday.
4. The question asks for yesterday: **Monday**.

**The trap:** Tuesday. Two different slips land there. Slip one: compute Mara's "day after tomorrow" from the reader's today instead of from her speaking day, getting today = Wednesday and yesterday = Tuesday. Slip two: do everything right, then answer with today instead of yesterday. Friday (the favourite day) and Sunday (shares zero letters with TOMORROW, four with YESTERDAY, and is the memorised answer to the classic "when the day after tomorrow is yesterday" riddle) are the next most likely wrong answers. A model that skims "the first word of this riddle" as a figure of speech never notices that the scene-setting word *Tomorrow* is the key.

**Why it's unique:**

- *Favourite day.* The table above is exhaustive over all seven names: Friday is the only name meeting both counts. Sunday fails the first count (0, not 1); Tuesday and Wednesday fail the second (6 and 5, not 4).
- *First word is "The" (start of the quote)?* THE gives Wednesday and Saturday for "exactly one", and neither shares four with YESTERDAY. No solution, so the text forces *Tomorrow*.
- *Last word is "day" (end of the quote)?* Every day name shares exactly three letters with DAY, never four. No solution, so the text forces *yesterday*.
- *Count repeated letters more than once?* The rule says count each different letter once. Even ignoring the rule, multiset counting still gives only Friday.
- *Her "day after tomorrow" measured from the reader's today?* The riddle states her words are relative to the day she speaks. Direct quotation already implies this; the rule removes the doubt.
- *"Yesterday" in the question measured from Mara's speaking day?* The question is the narrator's, in the same frame that says "Tomorrow, Mara will say". Nothing in the text shifts the narrator's now.
- *Could she be wrong or joking?* "Mara never says anything false."
- *Which calendar?* Only the cyclic order of the seven day names is used, so no calendar, year or time zone matters.

**Verification:** `verify_riddle.py` reads the first and last words out of the riddle text itself, tabulates shared distinct letters for all seven days, brute-forces all seven choices of "today" against Mara's statement, asserts the single survivor is (today = Tuesday, yesterday = Monday), and prints the candidate sets for each misreading above.

```
python3 verify_riddle.py
```

**Difficulty:** 10 to 20 minutes with pen and paper. Levers: C self-reference (the riddle's own first and last words), D letter-level work (two distinct-letter tallies over seven names), G viewpoint shift (a statement made tomorrow, a question about yesterday), E state tracking (today + 1 + 2, then minus 1), B literal reading ("the first word of this riddle" is literally *Tomorrow*), F hidden constraint (the opening word looks like scene-setting but is the key). The levers interact: the word that sets the time frame is the same word whose letters pick the day, and the time frame then moves that day three steps and the question moves it back one.

**Design notes:**

Five ideas:

1. *Reversed classic.* "Forward I am not; backward I am heavy." Answer NOT, memorised answer TON. Levers A, B, D. Solves in one minute, too easy.
2. *Self-descriptive number.* "Which whole number plus the letter count of its English name equals 18?" Answer 12 (TWELVE). Levers D, E. Unique by brute force, but no aha and models count short words fine.
3. *Changed sisters classic.* "Nana's mother has five daughters: Nene, Nini, Nono, Nunu and ..." Levers A, B. Current models get it.
4. *Count the E's.* "The answer is the weekday whose name has as many letters as this riddle has E's." Levers C, D. Pure counting, no aha, and a model that cannot count still has a one in two guess between Tuesday and Wednesday.
5. *Tomorrow / yesterday.* The scene-setting word "Tomorrow" and the question word "yesterday" are the letter keys; a statement made tomorrow fixes today; the question asks for yesterday. Levers B, C, D, E, F, G. Chosen for the strongest aha (the first word does double duty) and the best model-failure profile (two letter tallies plus two viewpoint shifts).

Attack log:

- Draft 1 used only "shares no letter with the first word", which gives Sunday in one pass. Too quick for the 10 minute floor and Sunday is also the memorised classic answer, so a lucky model could land on the favourite day without working. Added the last-word clue and changed the counts so both clues are necessary (one alone leaves three or two candidates).
- Draft 2 quoted Mara with the classic wording "when the day after tomorrow is yesterday". That phrase has two defensible readings (three days ahead or three days back) and the classic only survives because its answer is symmetric. Replaced with a plain quoted statement.
- Reported speech ("Mara will say that the day after tomorrow...") leaves the reference day ambiguous. Switched to direct quotation and added the explicit rule that her words are relative to the day she speaks.
- Checked whether the question's "yesterday" could attach to Mara's frame; the narrator's frame is set by the opening sentence and nothing moves it. Noted in the uniqueness section rather than adding more rule text.
- Checked every misreading of "first word" and "last word" (quote boundaries, a presentation label such as "Riddle:"). The quote-boundary readings give no solution. A leading label would not be part of what the solver sees, and this file presents the riddle text starting with "Tomorrow" for that reason.
- Word count of the solver-facing text: 78 words.
