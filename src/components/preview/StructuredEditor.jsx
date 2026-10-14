import React, { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { updateCreatedResume } from '../../services/resumeRepo.js';
import { toast } from '../../app/store.js';
import { Plus, Trash2, Save, FileCode } from 'lucide-react';
import { TEMPLATES } from '../../features/resume-creation/model.js';

export function StructuredEditor({ resume }) {
  const [data, setData] = useState(() => structuredClone(resume.resumeData || {}));
  const [template, setTemplate] = useState(resume.template || 'classic');
  const [paper, setPaper] = useState(resume.paper || 'letter');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCreatedResume(resume.id, { data, template, paper });
      toast('Saved changes and regenerated DOCX.', 'success');
    } catch (err) {
      toast(err.message || 'Error saving changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateContact = (key, value) => {
    setData((d) => ({ ...d, contact: { ...d.contact, [key]: value } }));
  };

  // Experience handlers
  const updateExp = (index, key, value) => {
    setData((d) => {
      const exp = [...(d.experience || [])];
      exp[index] = { ...exp[index], [key]: value };
      return { ...d, experience: exp };
    });
  };

  const addExpBullet = (expIndex) => {
    setData((d) => {
      const exp = [...(d.experience || [])];
      exp[expIndex].bullets = [...(exp[expIndex].bullets || []), ''];
      return { ...d, experience: exp };
    });
  };

  const updateExpBullet = (expIndex, bulletIndex, value) => {
    setData((d) => {
      const exp = [...(d.experience || [])];
      exp[expIndex].bullets[bulletIndex] = value;
      return { ...d, experience: exp };
    });
  };

  const removeExpBullet = (expIndex, bulletIndex) => {
    setData((d) => {
      const exp = [...(d.experience || [])];
      exp[expIndex].bullets = exp[expIndex].bullets.filter((_, i) => i !== bulletIndex);
      return { ...d, experience: exp };
    });
  };

  const addExp = () => {
    setData((d) => ({
      ...d,
      experience: [
        ...(d.experience || []),
        { id: Date.now().toString(), title: '', company: '', location: '', start: '', end: '', bullets: [''] },
      ],
    }));
  };

  const removeExp = (index) => {
    setData((d) => ({
      ...d,
      experience: (d.experience || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-xs bg-paper">
      {/* Template & Paper bar */}
      <div className="p-3.5 bg-surface border border-line-strong rounded-lg shadow-panel space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink text-xs flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-accent" />
            Template & Format
          </span>
          <Button size="sm" variant="primary" icon={Save} loading={saving} onClick={handleSave}>
            Save & Update DOCX
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="label">Template Layout</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="field text-xs py-1.5"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Paper Size</label>
            <select
              value={paper}
              onChange={(e) => setPaper(e.target.value)}
              className="field text-xs py-1.5"
            >
              <option value="letter">Letter (US)</option>
              <option value="a4">A4 (International)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="p-4 bg-surface border border-line rounded-lg shadow-panel space-y-3">
        <h4 className="font-semibold text-ink border-b border-line pb-1.5">Contact Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="field"
              value={data.contact?.name || ''}
              onChange={(e) => updateContact('name', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Headline / Target Title</label>
            <input
              type="text"
              className="field"
              value={data.contact?.headline || ''}
              onChange={(e) => updateContact('headline', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="field"
              value={data.contact?.email || ''}
              onChange={(e) => updateContact('email', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input
              type="text"
              className="field"
              value={data.contact?.phone || ''}
              onChange={(e) => updateContact('phone', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Location (City, State / Country)</label>
            <input
              type="text"
              className="field"
              value={data.contact?.location || ''}
              onChange={(e) => updateContact('location', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 bg-surface border border-line rounded-lg shadow-panel space-y-2">
        <h4 className="font-semibold text-ink border-b border-line pb-1.5">Professional Summary</h4>
        <textarea
          rows={3}
          className="field text-xs leading-relaxed"
          value={data.summary || ''}
          onChange={(e) => setData((d) => ({ ...d, summary: e.target.value }))}
          placeholder="Brief professional profile, target competencies, and key career highlights..."
        />
      </div>

      {/* Experience */}
      <div className="p-4 bg-surface border border-line rounded-lg shadow-panel space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-1.5">
          <h4 className="font-semibold text-ink">Work Experience</h4>
          <Button size="sm" variant="ghost" icon={Plus} onClick={addExp} className="h-6 px-2 text-xs">
            Add Position
          </Button>
        </div>

        {(data.experience || []).map((exp, expIdx) => (
          <div key={exp.id || expIdx} className="p-3 bg-sunken/40 border border-line rounded space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">Position #{expIdx + 1}</span>
              <button
                onClick={() => removeExp(expIdx)}
                className="text-ink-faint hover:text-bad p-1"
                title="Remove position"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                className="field"
                placeholder="Job Title"
                value={exp.title || ''}
                onChange={(e) => updateExp(expIdx, 'title', e.target.value)}
              />
              <input
                type="text"
                className="field"
                placeholder="Company Name"
                value={exp.company || ''}
                onChange={(e) => updateExp(expIdx, 'company', e.target.value)}
              />
              <input
                type="text"
                className="field"
                placeholder="Start Date"
                value={exp.start || ''}
                onChange={(e) => updateExp(expIdx, 'start', e.target.value)}
              />
              <input
                type="text"
                className="field"
                placeholder="End Date (or Present)"
                value={exp.end || ''}
                onChange={(e) => updateExp(expIdx, 'end', e.target.value)}
              />
            </div>

            {/* Bullets */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-ink-muted">
                <span>Accomplishment Bullets</span>
                <button
                  type="button"
                  onClick={() => addExpBullet(expIdx)}
                  className="text-accent hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add bullet
                </button>
              </div>

              {(exp.bullets || []).map((bullet, bIdx) => (
                <div key={bIdx} className="flex items-center gap-1.5">
                  <span className="text-ink-faint">•</span>
                  <input
                    type="text"
                    className="field flex-1"
                    value={bullet}
                    onChange={(e) => updateExpBullet(expIdx, bIdx, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeExpBullet(expIdx, bIdx)}
                    className="text-ink-faint hover:text-bad p-1 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <Button size="md" variant="primary" icon={Save} loading={saving} onClick={handleSave}>
          Save & Regenerate DOCX
        </Button>
      </div>
    </div>
  );
}
