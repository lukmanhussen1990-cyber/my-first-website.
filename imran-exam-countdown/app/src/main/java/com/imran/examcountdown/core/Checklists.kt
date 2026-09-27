package com.imran.examcountdown.core

data class CheckItem(val id: Long, val text: String, val done: Boolean = false)

object Checklists {

    /** Storage key. MIL and the elective are kept per choice so switching never loses work. */
    fun key(subject: Subject, choices: Choices): String = when (subject) {
        Subject.MIL -> "MIL:" + (choices.mil?.name ?: "ANY")
        Subject.ELECTIVE -> "ELECTIVE:" + (choices.elective?.name ?: "ANY")
        else -> subject.name
    }

    /** Starter tasks; every one can be edited or deleted. */
    fun defaults(subject: Subject, choices: Choices): List<String> = when (subject) {
        Subject.MIL -> listOf(
            "Read through every lesson and poem",
            "Revise grammar",
            "Practise an essay and a letter",
            "Learn word meanings and spellings",
            "Solve one sample paper",
        )
        Subject.ENGLISH_1, Subject.ENGLISH_2 -> listOf(
            "Go through class notes",
            "Revise grammar",
            "Practise writing answers neatly",
            "Learn new words and spellings",
            "Solve one sample paper",
        )
        Subject.SOCIAL_SCIENCE -> listOf(
            "Revise History chapters",
            "Revise Geography and practise maps",
            "Revise Civics / Political Science",
            "Learn important dates and terms",
            "Solve one sample paper",
        )
        Subject.GENERAL_SCIENCE -> listOf(
            "Revise Physics chapters",
            "Revise Chemistry chapters",
            "Revise Biology chapters",
            "Practise labelled diagrams",
            "Learn key definitions",
        )
        Subject.GENERAL_MATHEMATICS -> listOf(
            "Write out all the formulas",
            "Practise textbook exercises",
            "Redo the solved examples",
            "Solve one sample paper",
            "Check your common mistakes",
        )
        Subject.MORAL_SCIENCE -> listOf(
            "Read every lesson",
            "Note the key values and morals",
            "Practise short answers",
        )
        Subject.ELECTIVE -> when (choices.elective) {
            Elective.ADVANCED_MATHEMATICS -> listOf(
                "Revise formulas and theorems",
                "Practise problems from each chapter",
                "Solve one sample paper",
            )
            Elective.COMPUTER_SCIENCE -> listOf(
                "Revise definitions and key terms",
                "Practise writing programs step by step",
                "Solve one sample paper",
            )
            Elective.ARABIC -> listOf(
                "Revise vocabulary",
                "Practise reading and writing",
                "Revise grammar",
                "Solve one sample paper",
            )
            null -> listOf("Go through class notes", "Solve one sample paper")
        }
    }
}
