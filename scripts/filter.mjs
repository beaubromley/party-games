export const decode = q => ({ ...q, question: decodeURIComponent(q.question).trim(), correct_answer: decodeURIComponent(q.correct_answer).trim() });
// Questions that only make sense with choices listed, or give nothing to bluff about.
const NEEDS_CHOICES = /\b(which of|of these|of the following|following|not|except)\b/i;
// Ages 10+. A word filter, not a human review.
const MATURE = /\b(sex\w*|porn\w*|nude|naked|drugs?|cocaine|heroin|marijuana|cannabis|beer|wine|vodka|whiske?y|liquor|alcohol\w*|cocktails?|cigar\w*|tobacco|casino|gambl\w*|murder\w*|kill\w*|suicide|rape\w*|genitals?|penis|vagina|breasts?|testic\w*|condoms?|nazi\w*|hitler|genocide|execut\w*)\b/i;
export const suitable = q => !NEEDS_CHOICES.test(q.question) && !MATURE.test(`${q.question} ${q.correct_answer}`) && q.correct_answer.length <= 40;
