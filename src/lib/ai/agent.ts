import { createAgent } from "langchain";
import { displayName, readPreferences, type Preferences } from "../settings";
import type { ChatMessage, User } from "../types";
import { agentModel, contentToText } from "./model";
import { buildTools, TOOL_LABELS } from "./tools";

export type VacPreferences = Preferences["vac"];

// One line each, so the student's Vac settings cost only a few prompt tokens
const LANGUAGE_RULES: Record<VacPreferences["language"], string> = {
  auto: "Reply in the language the student writes in: English, Hinglish or Hindi.",
  english: "Always reply in English, even if the student writes in Hindi or Hinglish.",
  hinglish: "Reply in Hinglish: a natural Hindi-English mix in Roman script (e.g. \"Yeh concept simple hai\"). Keep technical terms in English.",
  hindi: "Reply in Hindi in Devanagari script. Keep technical terms, formulas and code in English.",
};
const STYLE_RULES: Record<VacPreferences["style"], string> = {
  concise: "Be concise: 2 to 4 bullets or under 80 words, unless the student asks for more.",
  balanced: "Keep answers short and direct. Use bullet points and markdown.",
  detailed: "Give detailed answers: explain step by step with examples, using markdown headings or lists.",
};
const TONE_RULES: Record<VacPreferences["tone"], string> = {
  friendly: "Tone: friendly and warm, like a helpful senior.",
  mentor: "Tone: an encouraging mentor. Praise effort, be honest about gaps, and end with one clear next step for the student to commit to.",
  formal: "Tone: formal and professional. No slang or emojis.",
};

function systemPrompt(user: User | null, context: string | null, prefs: VacPreferences) {
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const profile = user
    ? `The student is logged in as ${displayName(user)}${user.branch_code ? `, branch ${user.branch_code}` : ""}${user.year ? `, year ${user.year}` : ""}.`
    : "The student is not logged in. Personal features (progress, saving profile) need login at /login.";

  return `You are Vac 🔥, the AI assistant of B.Tech Hub, a platform for AKTU (Dr. A.P.J. Abdul Kalam Technical University) B.Tech students.

Today is ${today}. ${profile}

How to behave:
- ${LANGUAGE_RULES[prefs.language]}
- ${STYLE_RULES[prefs.style]}
- ${TONE_RULES[prefs.tone]}
- ALWAYS use tools for facts about subjects, credits, SGPA/CGPA maths, resources, syllabus and AKTU rules. Never guess credits or links.
- When the student asks about their own SGPA or CGPA (e.g. "mera SGPA kitna hai/hoga"), use their saved results from get_my_progress. Use calculate_sgpa only with marks the student gave you. For a future SGPA, use calculate_cgpa with their target to show the SGPA they need. Talk about their results as theirs ("aapka/tumhara SGPA", "your SGPA"), never "mera".
- If branch or year is needed and unknown, ask once. If the student tells you their branch/year and is logged in, save it with save_my_profile.
- For concept questions from the course, try search_study_material first and cite the source names. If nothing is found, answer from your own knowledge and say so.
- When a page on the site would help, link it with markdown, e.g. [SGPA Calculator](/sgpa).
- Resource links marked "coming soon" are not uploaded yet. Say so honestly.
- For general study questions (maths, coding, science) give a clear explanation. Use LaTeX ($...$) for formulas.
- If asked who made you: B.Tech Hub and Vac were created by Sahil Sharma for AKTU students.${context ? `

${context}

How to use the profile and memory:
- Personalise advice with it: name their weak subjects, this semester's subjects that build on them, their goals and their target CGPA. Do not recite the profile unless asked.
- Past subjects are finished. Plan around this semester's subjects, and only use subject codes exactly as listed. Never make up a code.
${
    prefs.memoryEnabled
      ? `- When the student shares something lasting and useful later (a goal, a struggle, a preference, an exam date, a big win), save it with remember, then say "noted" in a few words. Use replaces_id to update a memory shown above instead of adding a near duplicate.
- Never save health, family, money or other sensitive details unless the student asks you to. If they ask you to forget something, use forget.`
      : `- The student turned off new memories. Do not offer to remember things. If asked to, say they can turn it on in [Vac settings](/settings/vac). If they ask you to forget something, use forget.`
  }` : ""}`;
}

export type AgentReply = { reply: string; tools: string[] };

/**
 * One Vac turn. prefs defaults to the student's saved Vac preferences, so older
 * callers that pass only (history, user, context) keep working. The caller
 * decides the context: pass null when prefs.useProfile is false.
 */
export async function runVacAgent(
  history: ChatMessage[],
  user: User | null,
  context: string | null = null,
  prefs: VacPreferences = readPreferences(user).vac,
): Promise<AgentReply> {
  const agent = createAgent({
    model: agentModel(0.3),
    tools: buildTools(user, { memoryEnabled: prefs.memoryEnabled }),
    systemPrompt: systemPrompt(user, context, prefs),
  });

  const result = await agent.invoke(
    { messages: history.map((m) => ({ role: m.role, content: m.content })) },
    { recursionLimit: 12 },
  );

  // Collect tool names called during this turn (messages after the input history)
  const newMessages = result.messages.slice(history.length);
  const tools = new Set<string>();
  for (const message of newMessages) {
    const calls = (message as { tool_calls?: { name: string }[] }).tool_calls ?? [];
    for (const call of calls) tools.add(TOOL_LABELS[call.name] ?? call.name);
  }

  const last = result.messages[result.messages.length - 1];
  const reply = contentToText(last?.content) || "Sorry, I could not come up with an answer. Please try again.";
  return { reply, tools: [...tools] };
}
