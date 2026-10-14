import {
  getState,
  getResume,
  appendMessage,
  updateMessage,
  updateConversation,
  setBusy,
  toast,
  setAuthModalOpen,
  updateQuota,
} from '../app/store.js';
import { api, ApiError } from './api.js';
import { getFields, applyEditsToResume, applyResumeDataUpdate, createCreatedResume } from './resumeRepo.js';
import { uid } from '../utils/ids.js';
import { normalizeForCompare } from '../utils/textDiff.js';
import { mergeResumeUpdate, emptyResumeData } from '../features/resume-creation/model.js';

/**
 * Generates sensible, realistic demo suggestions mapped to the actual uploaded resume paragraphs
 * when no live AI API key is configured.
 */
function generateDemoSuggestions(fields, jobTitle, jobDesc) {
  const suggestions = [];
  const editable = fields.filter((f) => f.editable && !f.isHeading && f.text.trim().length > 15);

  for (const f of editable) {
    const text = f.text;
    // Check for passive or weak phrasings
    if (/responsible for/i.test(text)) {
      const improved = text.replace(/responsible for\s+([a-z]+)ing/i, (_, v) => {
        const verbMap = {
          test: 'Tested and verified',
          writ: 'Authored and maintained',
          manag: 'Directed and coordinated',
          creat: 'Developed',
          lead: 'Spearheaded',
          develop: 'Architected and built',
          execut: 'Executed rigorous',
        };
        for (const [k, rep] of Object.entries(verbMap)) {
          if (v.startsWith(k)) return rep;
        }
        return v[0].toUpperCase() + v.slice(1) + 'ed';
      }).replace(/responsible for/i, 'Led');

      suggestions.push({
        id: uid('s'),
        targetId: f.id,
        kind: 'replace',
        section: f.section || 'Experience',
        original: text,
        proposed: improved,
        explanation: 'Replaced passive phrasing ("responsible for") with active impact verbs to demonstrate ownership.',
        status: 'pending',
        warnings: [],
      });
    } else if (/helped to|assisted in/i.test(text)) {
      const improved = text
        .replace(/helped to\s+/i, 'Collaborated with team to ')
        .replace(/assisted in\s+([a-z]+)ing/i, (_, v) => `Partnered across teams to ${v}`);

      suggestions.push({
        id: uid('s'),
        targetId: f.id,
        kind: 'replace',
        section: f.section || 'Experience',
        original: text,
        proposed: improved,
        explanation: 'Strengthened collaboration phrasing to highlight teamwork and delivery.',
        status: 'pending',
        warnings: [],
      });
    } else if (f.section === 'summary' && text.length > 40) {
      const targetRole = jobTitle || 'Target Role';
      const tailored = text.replace(
        /(looking to|seeking to).*/i,
        `Dedicated to delivering high-quality results in a ${targetRole} role with a strong foundation in modern workflows.`,
      );
      if (tailored !== text) {
        suggestions.push({
          id: uid('s'),
          targetId: f.id,
          kind: 'replace',
          section: 'Summary',
          original: text,
          proposed: tailored,
          explanation: 'Tailored career objective to explicitly align with the target position.',
          status: 'pending',
          warnings: [],
        });
      }
    }

    if (suggestions.length >= 6) break;
  }

  // If no patterns matched, provide a general refinement for the first bullet or summary
  if (suggestions.length === 0 && editable.length > 0) {
    const target = editable[0];
    suggestions.push({
      id: uid('s'),
      targetId: target.id,
      kind: 'replace',
      section: target.section || 'Experience',
      original: target.text,
      proposed: `${target.text.replace(/\.$/, '')}, ensuring alignment with quality benchmarks and team requirements.`,
      explanation: 'Added an outcome statement to clearly emphasize the results and value delivered.',
      status: 'pending',
      warnings: ['[CONFIRM: Verify that this outcome accurately reflects your project results.]'],
    });
  }

  return suggestions;
}

/**
 * Primary dispatch for sending a message in a conversation.
 */
export async function sendMessage(conversationId, text, attachedDocxFile = null, attachedImages = []) {
  const state = getState();
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return;

  const userMessageText = text.trim();
  const hasImages = Array.isArray(attachedImages) && attachedImages.length > 0;
  if (!userMessageText && !attachedDocxFile && !hasImages) return;

  // Append user message
  appendMessage(conversationId, {
    role: 'user',
    content:
      userMessageText ||
      (hasImages
        ? attachedImages.length === 1
          ? 'Shared screenshot reference'
          : `Shared ${attachedImages.length} screenshot references`
        : `Uploaded resume: ${attachedDocxFile?.name}`),
    attachment: attachedDocxFile ? { name: attachedDocxFile.name, size: attachedDocxFile.size } : null,
    images: hasImages ? attachedImages : undefined,
  });

  // Auto-title conversation if title is still default
  if (!conv.titleCustom && conv.messages.length <= 1 && (userMessageText || hasImages)) {
    const autoTitle =
      userMessageText.slice(0, 32).replace(/[^\w\s-]/g, '').trim() ||
      (hasImages ? 'Screenshot Reference' : 'Resume Chat');
    updateConversation(conversationId, { title: autoTitle });
  }

  setBusy(conversationId, true);

  try {
    let activeResume = conv.context.activeResumeId ? getResume(conv.context.activeResumeId) : null;
    let jobDesc = conv.context.jobDescription;
    let jobTitle = conv.context.jobTitle;

    // Detect if user pasted a job description in their message
    const isJobDescLikely =
      userMessageText.length > 120 &&
      /(requirements|qualifications|responsibilities|job description|we are looking for|what you'll do|skills needed)/i.test(
        userMessageText,
      );

    if (isJobDescLikely && !jobDesc) {
      jobDesc = userMessageText;
      const titleMatch = userMessageText.match(
        /(?:title|position|role|job):\s*([^\n\r]+)|(?:for (?:this|a|the))\s+([A-Z][A-Za-z0-9\s/]+(?:Tester|Engineer|Developer|Analyst|Manager|Specialist|Designer|Lead|Associate|Intern))/i,
      );
      if (titleMatch) {
        jobTitle = (titleMatch[1] || titleMatch[2]).trim().slice(0, 80);
      }
      updateConversation(conversationId, {
        context: { ...conv.context, jobDescription: jobDesc, jobTitle: jobTitle || conv.context.jobTitle },
      });
    }

    // If user has no resume attached yet, but provided screenshots: auto-bootstrap a draft resume
    if (!activeResume && hasImages) {
      try {
        const newResume = await createCreatedResume({
          name: 'Resume from Screenshot',
          data: emptyResumeData(),
        });
        activeResume = newResume;
        updateConversation(conversationId, {
          context: {
            ...conv.context,
            activeResumeId: newResume.id,
            creating: true,
          },
        });
        toast('Created resume draft from screenshot.', 'info');
      } catch (err) {
        console.warn('Could not auto-create resume draft from screenshot:', err);
      }
    }

    // If still no resume:
    if (!activeResume) {
      const replyContent =
        "Welcome! To get started, please **upload your existing Word (.docx) resume**, attach a **screenshot** of your resume or details to include, or select **'Create a resume from scratch'**.\n\nOnce your resume is loaded, you can ask me to improve bullet points, tailor it to a target job description, or strengthen specific sections—all while preserving your original formatting.";

      appendMessage(conversationId, {
        role: 'assistant',
        content: replyContent,
        needs: ['resume'],
      });
      return;
    }

    const fields = getFields(activeResume);
    const serverConfig = state.serverConfig;
    const isAiOnline = Boolean(serverConfig?.ai?.configured);

    if (isAiOnline) {
      // Require authentication for live AI features if Supabase is configured
      if (state.auth.isSupabaseConfigured && !state.auth.user) {
        setAuthModalOpen(true);
        toast('Please sign in or create an account to use live AI features.', 'info');
        appendMessage(conversationId, {
          role: 'assistant',
          content:
            'To access live AI resume improvements and job tailoring, please **sign in** or **create an account**. Free accounts include 10 daily AI requests.',
          isError: true,
        });
        return;
      }

      // Call Live Server AI
      const history = conv.messages
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const payload = {
        message:
          userMessageText ||
          (hasImages
            ? 'Please examine the attached screenshot(s) and extract relevant resume details or incorporate them into my resume.'
            : 'Review resume'),
        images: hasImages ? attachedImages.map((img) => img.dataUrl || img) : [],
        history,
        context: {
          mode: activeResume.mode || 'preserve',
          resume: {
            name: activeResume.name,
            kind: activeResume.kind,
            fields,
          },
          resumeData: activeResume.resumeData || null,
          jobDescription: jobDesc,
          jobTitle: jobTitle,
          pendingSuggestions: [],
          creating: Boolean(conv.context.creating),
        },
      };

      const res = await api.chat(payload);

      // Update user quota state
      if (res.quota) {
        updateQuota(res.quota);
      }

      // Map suggestions into structured client state
      const clientSuggestions = (res.suggestions || []).map((s) => ({
        id: uid('s'),
        targetId: s.targetId,
        kind: s.kind || 'replace',
        section: s.section,
        original: s.original,
        proposed: s.proposed,
        explanation: s.explanation,
        warnings: s.warnings || [],
        status: 'pending',
      }));

      // Handle resumeUpdate if AI generated new facts for created resume
      if (res.resumeUpdate && activeResume.kind === 'created') {
        const { data, changed } = mergeResumeUpdate(activeResume.resumeData, res.resumeUpdate);
        if (changed.length) {
          await applyResumeDataUpdate(activeResume.id, data, `Updated ${changed.join(', ')}`);
        }
      }

      appendMessage(conversationId, {
        role: 'assistant',
        content: res.reply,
        isDemo: false,
        analysis: res.analysis || null,
        jobTitle: res.jobTitle || jobTitle,
        suggestions: clientSuggestions,
        needs: res.needs || [],
      });
    } else {
      // Demo Mode / Simulation Engine
      await new Promise((r) => setTimeout(r, 600)); // Natural slight delay

      let demoReply = '';
      let demoAnalysis = null;
      let demoSuggestions = [];

      if (hasImages) {
        demoReply = `I reviewed the ${attachedImages.length} screenshot(s) you attached.\n\n- **Extracted details:** Identified relevant career milestones, roles, and skills shown in the image(s).\n- **Preservation:** AutoResumeAI can transcribe these details into your resume without distorting your document structure.\n\nHere are suggestions generated from your reference:`;
        demoSuggestions = generateDemoSuggestions(fields, jobTitle, jobDesc);
      } else if (/tailor|job|match|position|apply/i.test(userMessageText) || jobDesc) {
        const targetRole = jobTitle || 'Target Position';
        demoReply = `I analyzed your resume against the requirements for **${targetRole}**.\n\n- **Identified strengths:** Relevant project work and foundational skills are already highlighted.\n- **Improvement areas:** Several bullet points use passive descriptions and could more assertively demonstrate specific competencies.\n- **Design preservation:** All edits below can be applied directly to a separate working copy of your DOCX without changing fonts or layout.`;

        demoAnalysis = {
          summary: `Assessment for ${targetRole}`,
          matchEstimate: {
            score: 78,
            rationale:
              'Approximate match based on detected skill keywords and experience relevance. (Note: Demo assessment, not a commercial ATS score).',
          },
          strengths: ['Relevant educational and project background', 'Clear section hierarchy in original document'],
          gaps: ['Quantifiable project outcomes could be clearer', 'Action verbs can be sharpened for greater impact'],
          keywordsSupported: ['Testing', 'Bug Reporting', 'Collaboration', 'Documentation'],
          keywordsNotEvidenced: ['CI/CD Pipeline Integration', 'Performance Profiling'],
          questions: [
            'Did you use any specific bug-tracking or test management tools during your projects?',
            'What was the approximate scale or user reach of the applications you tested?',
          ],
        };

        demoSuggestions = generateDemoSuggestions(fields, jobTitle, jobDesc);
      } else {
        demoReply =
          "I reviewed your resume to identify opportunities for stronger wording, active voice, and conciseness.\n\nHere are targeted improvements for your review. You can **accept**, **edit**, or **reject** each suggestion individually, and your original document design will be preserved.";
        demoSuggestions = generateDemoSuggestions(fields, null, null);
      }

      appendMessage(conversationId, {
        role: 'assistant',
        content: demoReply,
        isDemo: true,
        analysis: demoAnalysis,
        jobTitle: jobTitle,
        suggestions: demoSuggestions,
      });
    }
  } catch (err) {
    console.error('Chat error:', err);
    if (err?.code === 'UNAUTHORIZED' || err?.status === 401) {
      setAuthModalOpen(true);
      toast('Please sign in or create an account to use AI features.', 'error');
    } else if (err?.code === 'QUOTA_EXHAUSTED' || err?.status === 429) {
      toast('Daily AI request limit reached. Quota resets at 00:00 UTC.', 'error');
    } else if (err?.code === 'GLOBAL_BUDGET_EXCEEDED') {
      toast('Global AI budget protection threshold reached. Requests paused.', 'error');
    }

    appendMessage(conversationId, {
      role: 'assistant',
      content: `I ran into an issue processing that request: ${err.message || 'Server error'}. Please try again.`,
      isError: true,
    });
  } finally {
    setBusy(conversationId, false);
  }
}

/**
 * Accepts a single suggestion and applies it to the resume working copy.
 */
export async function acceptSuggestion(conversationId, messageId, suggestionId, editedText = null) {
  const state = getState();
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return;

  const msg = conv.messages.find((m) => m.id === messageId);
  if (!msg) return;

  const suggestion = msg.suggestions?.find((s) => s.id === suggestionId);
  if (!suggestion || suggestion.status === 'applied') return;

  const activeResumeId = conv.context.activeResumeId;
  if (!activeResumeId) {
    toast('No active resume is selected for this conversation.', 'error');
    return;
  }

  const textToApply = editedText !== null ? editedText : suggestion.proposed;

  try {
    const res = await applyEditsToResume(
      activeResumeId,
      [
        {
          id: suggestion.id,
          kind: suggestion.kind || 'replace',
          targetId: suggestion.targetId,
          original: suggestion.original,
          text: textToApply,
          section: suggestion.section,
          source: 'ai',
        },
      ],
      { label: `Accepted change: ${suggestion.section || 'Paragraph'}` },
    );

    const result = res.results.find((r) => r.id === suggestion.id);
    if (result && result.status === 'applied') {
      updateMessage(conversationId, messageId, (m) => ({
        suggestions: m.suggestions.map((s) =>
          s.id === suggestionId
            ? { ...s, status: 'applied', appliedText: textToApply, versionId: res.versionId }
            : s,
        ),
      }));
      toast('Applied edit to your resume working copy.', 'success');
    } else {
      const errorMsg = result?.message || 'Could not map edit safely onto the document formatting.';
      updateMessage(conversationId, messageId, (m) => ({
        suggestions: m.suggestions.map((s) =>
          s.id === suggestionId ? { ...s, status: 'failed', failMessage: errorMsg } : s,
        ),
      }));
      toast(errorMsg, 'warn');
    }
  } catch (err) {
    toast(err.message || 'Error applying suggestion.', 'error');
  }
}

/**
 * Rejects a suggestion.
 */
export function rejectSuggestion(conversationId, messageId, suggestionId) {
  updateMessage(conversationId, messageId, (m) => ({
    suggestions: m.suggestions.map((s) =>
      s.id === suggestionId ? { ...s, status: 'rejected' } : s,
    ),
  }));
}

/**
 * Accepts all pending suggestions in a message.
 */
export async function acceptAllSuggestions(conversationId, messageId) {
  const state = getState();
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return;

  const msg = conv.messages.find((m) => m.id === messageId);
  if (!msg || !msg.suggestions) return;

  const pending = msg.suggestions.filter((s) => s.status === 'pending');
  if (!pending.length) return;

  const activeResumeId = conv.context.activeResumeId;
  if (!activeResumeId) return;

  try {
    const edits = pending.map((s) => ({
      id: s.id,
      kind: s.kind || 'replace',
      targetId: s.targetId,
      original: s.original,
      text: s.proposed,
      section: s.section,
      source: 'ai',
    }));

    const res = await applyEditsToResume(activeResumeId, edits, {
      label: `Accepted ${pending.length} suggestions`,
    });

    const resultMap = new Map(res.results.map((r) => [r.id, r]));

    updateMessage(conversationId, messageId, (m) => ({
      suggestions: m.suggestions.map((s) => {
        const r = resultMap.get(s.id);
        if (r && r.status === 'applied') {
          return { ...s, status: 'applied', appliedText: s.proposed, versionId: res.versionId };
        }
        if (r && r.status !== 'applied') {
          return { ...s, status: 'failed', failMessage: r.message };
        }
        return s;
      }),
    }));

    toast(`Applied ${res.applied} of ${pending.length} suggestions to working copy.`, 'success');
  } catch (err) {
    toast(err.message || 'Error applying suggestions.', 'error');
  }
}
