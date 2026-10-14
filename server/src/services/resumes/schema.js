import { z } from 'zod';

const str = (max = 500) => z.string().max(max).default('');
const bullets = z.array(z.string().max(1200)).max(30).default([]);

export const resumeDataSchema = z.object({
  contact: z
    .object({
      name: str(120),
      headline: str(160),
      email: str(160),
      phone: str(60),
      location: str(160),
      links: z.array(z.object({ label: str(80), url: str(300) })).max(8).default([]),
    })
    .prefault({}),
  summary: str(2500),
  experience: z
    .array(z.object({ id: str(40), title: str(160), company: str(160), location: str(160), start: str(40), end: str(40), bullets }))
    .max(20)
    .default([]),
  education: z
    .array(z.object({ id: str(40), school: str(200), degree: str(200), location: str(160), start: str(40), end: str(40), details: bullets }))
    .max(10)
    .default([]),
  projects: z
    .array(z.object({ id: str(40), name: str(160), link: str(300), tech: str(300), description: str(1200), bullets }))
    .max(20)
    .default([]),
  skills: z.array(z.object({ id: str(40), label: str(120), items: str(800) })).max(20).default([]),
  certifications: z
    .array(z.object({ id: str(40), name: str(200), issuer: str(200), date: str(60) }))
    .max(20)
    .default([]),
  additional: z.array(z.object({ id: str(40), title: str(120), bullets })).max(8).default([]),
});

export const TEMPLATE_IDS = ['classic', 'modern', 'compact'];
export const PAPER_IDS = ['letter', 'a4'];
