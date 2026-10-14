import { createApp } from './app.js';
import { config, isAiConfigured, isSupabaseConfigured } from './config/index.js';
import { syncBudgetConfigFromEnv } from './services/ai/budgetGuard.js';

const app = createApp();

app.listen(config.port, async () => {
  console.log(`AutoResumeAI API listening on http://localhost:${config.port}`);
  console.log(
    isAiConfigured()
      ? `AI provider: ${config.ai.provider} (model: ${config.ai.model})`
      : 'AI provider: not configured - the app runs in demo mode (see server/.env.example).',
  );

  if (isSupabaseConfigured()) {
    await syncBudgetConfigFromEnv();
  }
});
