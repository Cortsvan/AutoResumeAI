import { z } from 'zod';

const str = (max = 500) => z.string().max(max).default('');
const bullets = z.array(z.string().max(1200)).max(30).default([]);

export const resumeDataSchema = z.object({
  contact: z
    .object({
      name: str(160),
      headline: str(200),
      email: str(160),
      phone: str(80),
      location: str(200),
      links: z.array(z.object({ label: str(100), url: str(500) })).max(15).default([]),
    })
    .prefault({}),
  summary: str(4000),
  experience: z
    .array(z.object({ id: str(60), title: str(200), company: str(200), location: str(200), start: str(60), end: str(60), bullets }))
    .max(30)
    .default([]),
  education: z
    .array(z.object({ id: str(60), school: str(250), degree: str(250), location: str(200), start: str(60), end: str(60), details: bullets }))
    .max(15)
    .default([]),
  projects: z
    .array(z.object({ id: str(60), name: str(200), link: str(500), tech: str(500), description: str(2500), bullets }))
    .max(30)
    .default([]),
  skills: z.array(z.object({ id: str(60), label: str(160), items: str(2000) })).max(30).default([]),
  certifications: z
    .array(z.object({ id: str(60), name: str(250), issuer: str(250), date: str(80) }))
    .max(30)
    .default([]),
  additional: z.array(z.object({ id: str(60), title: str(160), bullets })).max(12).default([]),
});

export const TEMPLATE_IDS = ['classic', 'modern', 'compact'];
export const PAPER_IDS = ['letter', 'a4'];
