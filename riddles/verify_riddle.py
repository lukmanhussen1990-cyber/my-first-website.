"""Brute-force proof that the 'Tomorrow, Mara will say' riddle has exactly one answer.

Run:  python3 verify_riddle.py
"""
import re
from itertools import product

RIDDLE = (
    'Tomorrow, Mara will say: "The day after tomorrow is my favourite day." '
    "Mara never says anything false, and her words are relative to the day she speaks them. "
    "Her favourite day is the day of the week whose name shares exactly one letter with "
    "the first word of this riddle and exactly four letters with its last word. "
    "Compare letters only, ignoring capitals and punctuation, and count each different letter once. "
    "What day of the week was yesterday?"
)

DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

# --- Step 1: read the riddle's own first and last words (letters only, case ignored)
words = re.findall(r"[A-Za-z]+", RIDDLE)
first, last = words[0].upper(), words[-1].upper()
print(f"first word = {first!r}, last word = {last!r}")

# --- Step 2: which day name shares exactly 1 distinct letter with FIRST and 4 with LAST?
def shared(a, b):
    return len(set(a) & set(b))

print("\nday        shared w/ first  shared w/ last")
favourites = []
for d in DAYS:
    s1, s2 = shared(d, first), shared(d, last)
    ok = s1 == 1 and s2 == 4
    print(f"{d:<10} {s1:^15} {s2:^15} {'<-- favourite' if ok else ''}")
    if ok:
        favourites.append(d)
assert favourites == ["FRIDAY"], favourites

# --- Step 3: brute-force 'today' over all 7 days against Mara's statement
# Spoken on today+1; "the day after tomorrow" relative to her = today+1+2 = today+3.
answers = set()
for fav, today in product(favourites, range(7)):
    if DAYS[(today + 3) % 7] == fav:
        answers.add((DAYS[today], DAYS[(today - 1) % 7]))

print("\n(today, yesterday) pairs consistent with every clue:", answers)
assert answers == {("TUESDAY", "MONDAY")}
print("\nUNIQUE ANSWER: yesterday was MONDAY (today is Tuesday, favourite day Friday)")

# --- Attack log: misreadings a solver might try, and what they yield
print("\nMisreadings:")
for label, f, l in [
    ("first word = 'The' (start of quote)", "THE", last),
    ("last word = 'day' (end of quote)", first, "DAY"),
    ("counting with multiplicity", first, last),
]:
    if label.startswith("counting"):
        from collections import Counter
        hits = [d for d in DAYS
                if sum((Counter(d) & Counter(f)).values()) == 1
                and sum((Counter(d) & Counter(l)).values()) == 4]
    else:
        hits = [d for d in DAYS if shared(d, f) == 1 and shared(d, l) == 4]
    print(f"  {label:<40} -> candidates {hits}")
