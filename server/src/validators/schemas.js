import { z } from 'zod';
import { config } from '../config/index.js';
import { resumeDataSchema } from '../services/resumes/schema.js';

const { maxMessageChars, maxJobDescriptionChars } = config.limits;

const fieldSchema = z.object({
  id: z.string().min(1).max(80),
  section: z.string().max(40).default('other'),
  text: z.string().max(2000),
  isHeading: z.boolean().optional().default(false),
  isListItem: z.boolean().optional().default(false),
  editable: z.boolean().optional().default(true),
});

export const chatImageSchema = z.union([
  z.string().max(10_000_000),
  z.object({
    id: z.string().optional(),
    dataUrl: z.string().max(10_000_000),
    name: z.string().max(200).optional(),
    size: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
]);

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(maxMessageChars),
  images: z.array(chatImageSchema).max(5).optional().default([]),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000) }))
    .max(16)
    .default([]),
  context: z
    .object({
      mode: z.enum(['preserve', 'content', 'redesign']).default('preserve'),
      resume: z
        .object({
          name: z.string().max(200).default('Resume'),
          kind: z.enum(['imported', 'created']),
          fields: z.array(fieldSchema).max(config.limits.maxParagraphs),
        })
        .nullable()
        .default(null),
      resumeData: resumeDataSchema.nullable().default(null),
      jobDescription: z.string().max(maxJobDescriptionChars).nullable().default(null),
      jobTitle: z.string().max(160).nullable().default(null),
      pendingSuggestions: z
        .array(z.object({ targetId: z.string().max(80), proposed: z.string().max(600) }))
        .max(40)
        .default([]),
      creating: z.boolean().default(false),
    })
    .prefault({}),
});

export const structureRequestSchema = z.object({
  paragraphs: z
    .array(
      z.object({
        text: z.string().max(2000),
        section: z.string().max(40).default('other'),
        isHeading: z.boolean().default(false),
        isListItem: z.boolean().default(false),
        part: z.string().max(40).default('body'),
      }),
    )
    .max(config.limits.maxParagraphs),
  useAi: z.boolean().default(false),
});

export const generateRequestSchema = z.object({
  data: resumeDataSchema,
  template: z.enum(['classic', 'modern', 'compact']).default('classic'),
  paper: z.enum(['letter', 'a4']).default('letter'),
});

export const applyRequestSchema = z.object({
  edits: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        kind: z.enum(['replace', 'insert_after']).default('replace'),
        paragraphId: z.string().min(1).max(80),
        expectedText: z.string().min(1).max(3000),
        newText: z.string().max(3000),
      }),
    )
    .min(1)
    .max(60),
});

export const adminUpdateUserSchema = z
  .object({
    is_unlimited: z.boolean().optional(),
    daily_limit: z.number().int().min(0).max(10000).optional(),
    account_status: z.enum(['active', 'suspended']).optional(),
    role: z.enum(['user', 'admin']).optional(),
  })
  .strict();

export const adminUpdateBudgetSchema = z
  .object({
    total_budget_usd: z.number().positive().max(1000).optional(),
    hard_stop_threshold_usd: z.number().positive().max(1000).optional(),
    reserved_balance_usd: z.number().min(0).max(1000).optional(),
    is_paused: z.boolean().optional(),
  })
  .strict();

