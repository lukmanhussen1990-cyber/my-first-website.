# VO segments. Markup: {g:word} gold, {r:word} red, {n:word} green. ' | ' = new caption page, ' / ' = forced line break.
SEGMENTS = [
 ('s01', 1,  "Does {g:God} only want / {n:good} people?"),
 ('s02', 2,  "This painting answers it."),
 ('s03', 2,  "Can you spot the {r:secret?}"),
 ('s04', 3,  "Over 400 years ago, | an artist painted {g:Jesus} | walking into a room / full of {r:tax} {r:collectors.}"),
 ('s05', 4,  "Back then, tax collectors / were {r:hated.}"),
 ('s06', 4,  "They took money from / their own people for Rome."),
 ('s07', 4,  "Nobody wanted to / sit with them."),
 ('s08', 5,  "But {g:Jesus} walked right in."),
 ('s09', 6,  "Now look closely."),
 ('s10', 6,  "{g:Jesus's} hand is / the same hand | as {g:Adam's} in Michelangelo's / famous painting."),
 ('s11', 6,  "The God who made / the first man | is giving this man / a {n:new} {n:start.}"),
 ('s12a', 7, "And the light doesn't / come from the window."),
 ('s12b', 7, "It comes {g:with} {g:Jesus.}"),
 ('s13a', 8, "The man at the table / points at himself:"),
 ('s13b', 8, "{r:Me?}"),
 ('s14a', 9, "Jesus says two words:"),
 ('s14b', 9, "{g:Follow} {g:me.}"),
 ('s15', 9,  "And he got up / and {n:followed} Him."),
 ('s16', 10, "Jesus said: | It is not the healthy / who need a {n:doctor,} | but the {r:sick.}"),
 ('s17', 10, "I have not come / to call the righteous, | but {r:sinners.}"),
 ('s18', 11, "A famous writer / said it best:"),
 ('s19', 11, "Every saint / has a {r:past,} | and every sinner / has a {n:future.}"),
 ('s20', 12, "And that hated / tax collector?"),
 ('s21a', 12, "The first book of / the New Testament | carries his name:"),
 ('s21b', 12, "{g:Matthew.}"),
 ('s22', 13, "{g:God} doesn't wait / for you to be good."),
 ('s23', 13, "He just says, / {g:Follow} {g:me.}"),
 ('s24', 13, "And He's pointing / at {n:you.}"),
]
import re
def plain(markup):
    t = markup.replace(' | ', ' ').replace(' / ', ' ')
    t = re.sub(r'\{[grn]:([^}]*)\}', r'\1', t)
    return t
