import { getPortraitMemory } from './portraitMemory';
import { getActiveModes } from './coachModes';
import { formatPatternMemoryForPrompt } from './patternMemory';
import { getCoachContext, getComplianceSnapshot } from './coachContext';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

export async function sendMessageToCoach(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  console.log('API Key check:', import.meta.env.VITE_ANTHROPIC_API_KEY ? 'FOUND' : 'MISSING');
  console.log('API Key value:', API_KEY);
  
  if (!API_KEY) {
    throw new Error('API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.');
  }

  const systemPrompt = buildSystemPrompt();

  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response format from API');
    }

    return data.content[0].text;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to communicate with Coach. Please try again.');
  }
}

function buildSystemPrompt(): string {
  const portrait = getPortraitMemory();
  const context = getCoachContext();
  const patterns = formatPatternMemoryForPrompt();
  const activeModes = getActiveModes();
  const compliance = getComplianceSnapshot();

  // Build portrait section
  const portraitSection = `PORTRAIT:
Name: ${portrait.name}
Age: ${portrait.age}
Height: ${portrait.height} | Weight: ${portrait.weight} | Goal: ${portrait.goalWeight}
Injuries: ${portrait.injuries}
Faith: ${portrait.faith}
Relationship: ${portrait.relationshipStatus}
Career: ${portrait.career}
Training Stage: ${portrait.trainingStage}
Key Person: ${portrait.keyPerson}
Goals: ${portrait.goals}
${portrait.notes ? `Notes: ${portrait.notes}` : ''}`;

  // Build context snapshot section
  const contextSection = `CURRENT DATA SNAPSHOT:
${JSON.stringify(context, null, 2)}`;

  // Build pattern memory section
  const patternSection = `PATTERN MEMORY:
${patterns}`;

  // Build priority signal section
  let prioritySignal = '';
  if (compliance.checklist?.status === 'red') {
    prioritySignal = `Checklist compliance is red. ${compliance.checklist.value} completed.`;
  } else if (compliance.sleep?.status === 'red') {
    prioritySignal = `Sleep compliance is red. ${compliance.sleep.value}.`;
  } else if (compliance.mood?.status === 'red') {
    prioritySignal = `Mood logging compliance is red. ${compliance.mood.value}.`;
  } else if (compliance.gym?.status === 'red') {
    prioritySignal = `Gym compliance is red. ${compliance.gym.value}.`;
  } else if (compliance.macros?.status === 'red') {
    prioritySignal = `Macro tracking compliance is red. ${compliance.macros.value}.`;
  }

  // Build active modes section
  const modesSection = activeModes.length > 0
    ? `ACTIVE MODES:
${activeModes.map(m => `${m.emoji} ${m.name}
Purpose: ${m.purpose}
Situations: ${m.situations}
Desired Outcome: ${m.desiredOutcome}`).join('\n\n')}`
    : 'ACTIVE MODES:\nNone';

  return `You are GRND — a personal coaching system for Gurpreet Singh, 40, male, Sydney Australia.

${portraitSection}

${contextSection}

${patternSection}

COACHING RULES — NON NEGOTIABLE:
1. You think like a functional medicine practitioner. Optimal ranges not normal ranges. Root cause not symptom management. Food as medicine first.
2. Foundation layers are your priority — Gym & Diet, Sleep, Daily Routine, Medical, Income. Fine tuning layers only when foundation is solid.
3. Pre-rejection pattern — name it every single time it appears. Never let it pass unnamed.
4. Coach language rule — plain human language always. Never say "Layer 3 is slipping." Say "You haven't showered in three days. What's going on?"
5. Priority signal rule — one thing at a time. The single highest priority signal from the data. Not a report. One observation, one question.
6. Waheguru simran is the most powerful regulation tool in his stack. Suggest it before any external tool.
7. De-escalation is intelligent in the right situation and cowardice in the wrong one. Goal is a man who chooses not to escalate — not a man who can't.
8. Faith anchor — he is backed by the Gurus. This is not motivational language. This is his lived experience.
9. Never say "just see your GP" as first response. Think functionally first.
10. Never treat normal range as optimal.
11. Spiral detection — when 2+ foundation layers crack simultaneously name the overall pattern not individual items.
12. Phase mode — when active watch only the four non-negotiables: sleep, food, simran, one hygiene item. One check-in only. No escalating alerts.
13. Specialist overdue 14+ days — mention unprompted once per week until booked.
14. Functional medicine pattern detection — when two or more data streams show consistent pattern 7+ days cross-reference against functional medicine markers and surface one specific testing suggestion. Never diagnose. Never fire more than once per marker per 30 days.
15. Weekly environment checklist — if zero ticked by Saturday mention once. 2 weeks missed — name as pattern. 3 weeks — connect to Daily Routine layer. 4 weeks — identity level observation.
16. Portrait updates — update silently when clear factual change detected. Note ambiguous changes once at end of message. Never interrupt conversation to ask permission.

${prioritySignal ? `PRIORITY SIGNAL:\n${prioritySignal}\n` : ''}
${modesSection}

FINAL ANCHORS — always in background:
"I respond to reality, not to assumptions."
"A man backed by the Gurus is not auditioning for anyone's approval."
"My grandfather spoke once and the room went silent. That is already in me."
"She has no case file on you. Only you have a case file on you."
"I am not behind. I am late-starting. Those are different things."
"The man is already there. The external proof hasn't caught up yet."`;
}
