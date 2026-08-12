# Writing Guidelines: Simplified Technical English

## 1. Scope

These guidelines apply to all text in this repository: page copy, headings, button
labels, error messages, code comments, commit messages, and documentation.

The guidelines follow ASD-STE100 Simplified Technical English (STE). STE is a
controlled English standard. It limits vocabulary, grammar, and sentence length so
that readers who do not speak English as a first language can read the text one
time and understand it.

Full compliance needs the STE dictionary, which this repository does not include.
Apply the principles in this document. Where a rule needs a word that the STE
dictionary does not approve, follow section 8.

## 2. Terms

| Term | Definition |
| --- | --- |
| STE | ASD-STE100 Simplified Technical English. |
| Approved word | A word in the STE dictionary, used with the meaning that the dictionary gives. |
| Technical name | A noun that identifies a part, a tool, a file, or a system. Example: `index.html`. |
| Technical verb | A verb that names a specific action in a technical field. Example: `deploy`. |
| Procedural text | Text that tells the reader to do something. |
| Descriptive text | Text that explains how something works or what something is. |

## 3. Sentences

1. Write one main idea in each sentence.
2. Keep procedural sentences to 20 words or less.
3. Keep descriptive sentences to 25 words or less.
4. Write one instruction in each sentence. If two actions occur at the same time,
   you can put them in one sentence.
5. Keep paragraphs of descriptive text to six sentences or less.
6. Write about one topic in each paragraph.
7. Start a procedure with the command, not with the condition, unless the
   condition controls whether the reader does the step.

## 4. Verbs and voice

1. Use the active voice. Name the actor.
2. Use the imperative for instructions: `Open`, `Select`, `Run`, `Check`,
   `Replace`, `Remove`.
3. Use simple tenses: simple present, simple past, simple future.
4. Do not use the `-ing` form as a verb. Keep the `-ing` form only in a technical
   name, such as `landing page`.
5. Use a concrete verb in place of a noun phrase.

| Do not write | Write |
| --- | --- |
| The deployment of the site is done by the pipeline. | The pipeline deploys the site. |
| Validation of the form input occurs on submit. | The form validates the input when the user submits it. |
| We are working on an improvement to load time. | We reduced the load time. |

## 5. Words

1. Use the same word for the same thing each time. Do not change `button` to
   `control` to `element` in one document.
2. Use the same word for the same action each time. Do not change `remove` to
   `delete` to `clear`.
3. Do not join more than three nouns. Break a long noun cluster with a preposition
   or a verb. Change `site build cache clear script` to `script that clears the
   build cache`.
4. Delete words that do not change the technical meaning.
5. Do not write the same information two times in different words.
6. Do not use idioms, metaphors, or jokes. A reader who does not speak English as
   a first language can misread them.
7. Keep the articles `a`, `an`, and `the`. Do not remove them to make the sentence
   short.

Do not use these words unless you give a measured value in the same sentence:

`robust`, `seamless`, `powerful`, `innovative`, `cutting-edge`, `comprehensive`,
`leverage`, `streamlined`, `intuitive`, `easy`, `simply`, `just`, `very`,
`extremely`, `state-of-the-art`, `best-in-class`.

Do not use these phrases:

`it is important to note`, `in today's rapidly evolving landscape`, `at its core`,
`this allows users to`, `by leveraging`, `dive into`, `unlock the power of`,
`when it comes to`, `needless to say`.

Replace a vague claim with a number, a condition, or an outcome.

| Do not write | Write |
| --- | --- |
| The build is very fast. | The build takes 4 seconds. |
| The site works well on mobile. | The layout adjusts at 480 px, 768 px, and 1024 px. |
| This makes the code more maintainable. | The change removes three copies of the same function. |

## 6. Procedures

1. Put the steps in the order in which the reader does them.
2. Number the steps.
3. Write one action in each step.
4. State the condition before the action when the condition controls the action.
   Example: `If the build fails, read the log in build/out.txt.`
5. State the result of the step when the reader cannot see it. Example:
   `Run npm start. The server listens on port 3000.`
6. Put a warning or a caution before the step that causes the risk.
7. Write a warning as a command. State the risk and the result. Example:
   `Do not commit the .env file. The file holds the API key, and GitHub keeps the
   file in the commit history after you delete it.`

## 7. Cause and effect

State the cause and the result in the same sentence. Use `because`, `if`, `when`,
or `so that`. Do not leave the reader to infer the link.

| Do not write | Write |
| --- | --- |
| The image did not load. The path was wrong. | The image did not load because the path was wrong. |
| Cache issues can affect the page. | If the browser holds an old copy of style.css, the page shows the previous colors. |

## 8. Terms outside the STE dictionary

Keep the technical term. Do not replace a precise term with a vague word.

Define the term one time, at the first use, in simple words. Then use the same
term for the rest of the document.

Example: `The site uses a service worker. A service worker is a script that the
browser runs in the background. It can send a cached file to the page when the
network fails.`

## 9. Abbreviations

1. Write the full term at the first use. Put the abbreviation in parentheses after
   it. Example: `Cascading Style Sheets (CSS)`.
2. Use the abbreviation for each use after the first.
3. Do not define an abbreviation that the audience knows, such as `HTML` or `URL`.
4. Do not use two abbreviations for the same thing.

## 10. Check before you commit

Read each sentence and check these points:

- [ ] The sentence has one main idea.
- [ ] The sentence is 20 words or less (procedure) or 25 words or less (description).
- [ ] The sentence uses the active voice, or the passive voice is necessary.
- [ ] Each pronoun points to one noun, and the reader can identify that noun.
- [ ] The document uses one term for each concept.
- [ ] Each claim gives a number, a condition, or an outcome.
- [ ] The sentence adds information that no other sentence gives.
- [ ] You can delete no more words without a change to the technical meaning.
