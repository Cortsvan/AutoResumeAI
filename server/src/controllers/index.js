import { applyRequestSchema, generateRequestSchema, structureRequestSchema, chatRequestSchema } from '../validators/schemas.js';
import { AppError } from '../utils/errors.js';
import { config, isAiConfigured, isSupabaseConfigured } from '../config/index.js';
import { openDocx } from '../services/documents/package.js';
import { describeFeatures, detectFeatures, listParagraphs } from '../services/documents/inspect.js';
import { applyEdits } from '../services/documents/apply.js';
import { generateResumeDocx } from '../services/resumes/generate.js';
import { structureResume } from '../services/resumes/structureResume.js';
import { runChat } from '../services/ai/chatService.js';
import { providerInfo } from '../services/ai/providers/index.js';
import {
  reserveQuotaAndBudget,
  finalizeAiUsage,
  releaseReservedCost,
  getGlobalBudgetStatus,
} from '../services/ai/budgetGuard.js';

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(400, 'INVALID_REQUEST', `Invalid request: ${first?.path?.join('.') || 'body'} ${first?.message || ''}`.trim());
  }
  return result.data;
}

export async function getConfig(req, res) {
  let budgetStatus = null;
  if (req.user?.profile?.role === 'admin') {
    budgetStatus = await getGlobalBudgetStatus();
  }

  res.json({
    ai: providerInfo(),
    auth: {
      required: true,
      supabaseConfigured: isSupabaseConfigured(),
    },
    budget: budgetStatus || {
      totalBudgetUsd: config.budget.totalBudgetUsd,
      thresholdUsd: config.budget.thresholdUsd,
      defaultDailyLimit: config.budget.defaultDailyLimit,
      maxOutputTokens: config.budget.maxOutputTokens,
    },
    limits: {
      maxUploadMb: Math.round(config.limits.maxUploadBytes / 1024 / 1024),
      maxMessageChars: config.limits.maxMessageChars,
      maxJobDescriptionChars: config.limits.maxJobDescriptionChars,
    },
  });
}

export async function chat(req, res) {
  if (!isAiConfigured()) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'No AI provider is configured. The app is running in demo mode.');
  }

  // Authentication check
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required to use AI features. Please sign in or create an account.');
  }

  const body = parseBody(chatRequestSchema, req.body);

  // Atomic reservation: checks global budget threshold ($4) & user daily quota (10/day)
  const reservation = await reserveQuotaAndBudget({
    userId: req.user.id,
    estimatedCost: 0.005,
  });

  let result;
  try {
    result = await runChat(body);
  } catch (err) {
    // Release in-flight reservation on failure
    await releaseReservedCost(reservation.reservedCost);
    throw err;
  }

  // Record actual usage and update quota
  await finalizeAiUsage({
    userId: req.user.id,
    model: config.ai.model,
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    explicitCost: result.usage?.cost || null,
    reservedCost: reservation.reservedCost,
    requestType: 'chat',
  });

  const isAdminUser = Boolean(reservation.isAdmin || req.user?.profile?.role === 'admin');
  const isUnlimitedQuota = Boolean(reservation.isUnlimited || isAdminUser);

  res.json({
    ...result,
    quota: {
      dailyLimit: reservation.dailyLimit,
      isUnlimited: isUnlimitedQuota,
      isAdmin: isAdminUser,
      todayUsed: reservation.todayUsed + 1,
      remainingToday: isUnlimitedQuota ? null : Math.max(0, reservation.dailyLimit - (reservation.todayUsed + 1)),
    },
  });
}

export async function inspectDocument(req, res) {
  const docx = await openDocx(req.file.buffer);
  const [paragraphs, features] = await Promise.all([listParagraphs(docx), detectFeatures(docx)]);
  if (paragraphs.length > config.limits.maxParagraphs) {
    throw new AppError(422, 'INVALID_DOCX', 'This document is too long to process.');
  }
  if (!paragraphs.some((p) => p.text.trim())) {
    throw new AppError(422, 'EMPTY_DOCX', 'This document does not contain any readable text.');
  }
  res.json({ paragraphs, features, notes: describeFeatures(features) });
}

export async function applyDocumentEdits(req, res) {
  let rawEdits;
  try {
    rawEdits = JSON.parse(req.body?.edits || '[]');
  } catch {
    throw new AppError(400, 'INVALID_REQUEST', 'The edits payload is not valid JSON.');
  }
  const { edits } = parseBody(applyRequestSchema, { edits: rawEdits });
  const result = await applyEdits(req.file.buffer, edits);
  res.json({
    changed: result.changed,
    results: result.results,
    docx: result.changed ? result.buffer.toString('base64') : null,
    paragraphs: result.paragraphs || null,
    features: result.features || null,
    notes: result.notes || null,
  });
}

export async function generateDocument(req, res) {
  const { data, template, paper } = parseBody(generateRequestSchema, req.body);
  const buffer = await generateResumeDocx(data, { template, paper });
  res
    .status(200)
    .type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .set('Cache-Control', 'no-store')
    .send(buffer);
}

export async function structureDocument(req, res) {
  const { paragraphs, useAi } = parseBody(structureRequestSchema, req.body);

  if (useAi) {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required to use AI resume structuring. Please sign in or create an account.');
    }
    const reservation = await reserveQuotaAndBudget({
      userId: req.user.id,
      estimatedCost: 0.005,
    });
    try {
      const result = await structureResume(paragraphs, { useAi: true });
      await finalizeAiUsage({
        userId: req.user.id,
        model: config.ai.model,
        promptTokens: 800,
        completionTokens: 800,
        reservedCost: reservation.reservedCost,
        requestType: 'structure',
      });
      return res.json(result);
    } catch (err) {
      await releaseReservedCost(reservation.reservedCost);
      throw err;
    }
  }

  // Rule-based fallback does not consume quota
  const result = await structureResume(paragraphs, { useAi: false });
  res.json(result);
}
