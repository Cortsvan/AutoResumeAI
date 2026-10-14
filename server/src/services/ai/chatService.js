import { config } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';
import { completeJson } from './providers/index.js';
import { buildSystemPrompt, buildUserTurn } from './prompts.js';
import { aiResponseSchema, validateResumeUpdate, validateSuggestions } from './validateResponse.js';

/** Pulls the first JSON object out of a model reply (tolerates code fences / preamble). */
export function extractJson(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no json');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Ensures roles alternate and begin with "user" (required by some providers). */
function normalizeMessages(history, finalUserContent) {
  const out = [];
  for (const m of history) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  const last = out[out.length - 1];
  if (last && last.role === 'user') last.content += `\n\n${finalUserContent}`;
  else out.push({ role: 'user', content: finalUserContent });
  return out;
}

async function requestStructured(system, messages) {
  const res = await completeJson({ system, messages });
  const raw = typeof res === 'object' && res !== null && 'text' in res ? res.text : res;
  const usage = typeof res === 'object' && res !== null && 'usage' in res ? res.usage : null;

  try {
    return { json: extractJson(raw), usage };
  } catch {
    // One repair attempt.
    const repair = [
      ...messages,
      { role: 'assistant', content: String(raw).slice(0, 4000) },
      {
        role: 'user',
        content: 'Your previous reply was not a single valid JSON object. Reply again with ONLY the JSON object described in the instructions.',
      },
    ];
    const res2 = await completeJson({ system, messages: repair });
    const raw2 = typeof res2 === 'object' && res2 !== null && 'text' in res2 ? res2.text : res2;
    const usage2 = typeof res2 === 'object' && res2 !== null && 'usage' in res2 ? res2.usage : usage;
    try {
      return { json: extractJson(raw2), usage: usage2 };
    } catch {
      throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned a response the app could not understand. Please try again.');
    }
  }
}

/**
 * Chat orchestration: builds the prompt from the client-provided context, calls the provider,
 * validates the structured result and returns only safe, normalised data.
 */
export async function runChat({ message, history, context }) {
  const system = buildSystemPrompt();
  const userTurn = buildUserTurn({ message, context, maxResumeChars: config.limits.maxResumeChars });
  const trimmedHistory = history.map((h) => ({ role: h.role, content: h.content.slice(0, 4000) }));
  const messages = normalizeMessages(trimmedHistory, userTurn);

  const { json, usage } = await requestStructured(system, messages);
  const parsed = aiResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI returned a response the app could not understand. Please try again.');
  }
  const data = parsed.data;

  const fields = context.resume ? context.resume.fields : [];
  const userTexts = [message, ...history.filter((h) => h.role === 'user').map((h) => h.content)];
  const { suggestions, dropped } = validateSuggestions(data.suggestions, {
    fields,
    mode: context.mode,
    userTexts,
    jobDescription: context.jobDescription,
  });

  const analysis = data.analysis
    ? {
        ...data.analysis,
        matchEstimate: data.analysis.matchEstimate
          ? {
              score: Math.round(data.analysis.matchEstimate.score),
              rationale: data.analysis.matchEstimate.rationale,
            }
          : null,
      }
    : null;

  return {
    reply: data.reply,
    jobTitle: data.jobTitle,
    jobDescriptionProvided: data.jobDescriptionProvided,
    needs: data.needs,
    analysis,
    suggestions,
    droppedSuggestions: dropped,
    resumeUpdate: validateResumeUpdate(data.resumeUpdate),
    usage,
  };
}
