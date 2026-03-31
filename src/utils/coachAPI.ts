import { getPortraitMemory } from './portraitMemory';
import { getActiveModes } from './coachModes';
import { formatPatternMemoryForPrompt } from './patternMemory';
import { getCoachContext, getComplianceSnapshot } from './coachContext';
import { mergeBloodResults } from './reviewData';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function sendMessageToCoach(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase configuration missing. Please check your .env file.');
  }

  const systemPrompt = buildSystemPrompt();

  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({
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

    let responseText: string = data.content[0].text;

    // If Medical mode is active, extract and save any blood results block
    const modesRaw = localStorage.getItem('grnd_coach_modes');
    const medicalActive = modesRaw
      ? (() => {
          try {
            const modes = JSON.parse(modesRaw) as Array<{ name: string; active: boolean }>;
            console.log('[coachAPI] grnd_coach_modes parsed:', modes);
            return modes.some((m) => m.name.toLowerCase().includes('medical') && (m.active === true || (m as any).isActive === true));
          } catch {
            return false;
          }
        })()
      : false;

    const blockMatch = responseText.match(/<BLOOD_RESULTS>([\s\S]*?)<\/BLOOD_RESULTS>/);
    if (blockMatch) {
      if (medicalActive) {
        try {
          const parsed = JSON.parse(blockMatch[1].trim()) as { markers: Array<{ name: string; value: number; unit: string; date: string; optimalMin: number; optimalMax: number; normalMin: number; normalMax: number; tier: 1 | 2 }>; testDate: string };
          mergeBloodResults(parsed.markers, parsed.testDate);
        } catch { /* malformed block — ignore, still strip */ }
      }
      responseText = responseText.replace(/<BLOOD_RESULTS>[\s\S]*?<\/BLOOD_RESULTS>/, '').trim();
    }

    return responseText;
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
Height: ${portrait.height}
Weight: ${portrait.weight} — LIVE DATA OVERRIDES THIS. Always use body.latest.weight from the data snapshot if available.
Goal weight: ${portrait.goalWeight}
Waist: ${portrait.waist} — LIVE DATA OVERRIDES THIS. Always use body.latest.waist from the data snapshot if available.
Body fat: ${portrait.bodyFat} — LIVE DATA OVERRIDES THIS. Always use body.latest.bodyFat from the data snapshot if available.
Injuries: ${portrait.injuries}
Faith: ${portrait.faith}
Relationship: ${portrait.relationshipStatus}
Career: ${portrait.career}
Training stage: ${portrait.trainingStage}
Key person: ${portrait.keyPerson}
Goals: ${portrait.goals}
Blood summary: ${portrait.bloodSummary}
Spiral pattern: ${portrait.spiralPattern}
${portrait.notes ? `Notes: ${portrait.notes}` : ''}

TWO FUTURES — always in the background:
${portrait.twoFutures}`;

  // Build context snapshot section
  const contextSection = `LIVE DATA SNAPSHOT — THIS OVERRIDES PORTRAIT VALUES:
${JSON.stringify(context, null, 2)}`;

  // Build pattern memory section
  const patternSection = `PATTERN MEMORY:
${patterns}`;

  // Build priority signal
  let prioritySignal = '';
  if (compliance.checklist?.status === 'red') {
    prioritySignal = `Checklist compliance is red. ${compliance.checklist.value} completed. Open with one plain human observation about this. Ask one question. Then engage fully with whatever Gurpreet wants to discuss. This signal affects how you open — it never blocks you from answering.`;
  } else if (compliance.sleep?.status === 'red') {
    prioritySignal = `Sleep compliance is red. ${compliance.sleep.value}. Open with one plain human observation about this. Ask one question. Then engage fully with whatever Gurpreet wants to discuss. This signal affects how you open — it never blocks you from answering.`;
  } else if (compliance.mood?.status === 'red') {
    prioritySignal = `Mood logging compliance is red. ${compliance.mood.value}. Open with one plain human observation about this. Ask one question. Then engage fully with whatever Gurpreet wants to discuss. This signal affects how you open — it never blocks you from answering.`;
  } else if (compliance.gym?.status === 'red') {
    prioritySignal = `Gym compliance is red. ${compliance.gym.value}. Open with one plain human observation about this. Ask one question. Then engage fully with whatever Gurpreet wants to discuss. This signal affects how you open — it never blocks you from answering.`;
  } else if (compliance.macros?.status === 'red') {
    prioritySignal = `Macro tracking compliance is red. ${compliance.macros.value}. Open with one plain human observation about this. Ask one question. Then engage fully with whatever Gurpreet wants to discuss. This signal affects how you open — it never blocks you from answering.`;
  }

  const BLOOD_RESULTS_INSTRUCTION = `When the user pastes blood test results, extract all markers and return them in this exact format at the END of your response, after your normal reply:

<BLOOD_RESULTS>
{
  "markers": [
    {
      "name": "LDL Cholesterol",
      "value": 4.5,
      "unit": "mmol/L",
      "date": "YYYY-MM-DD",
      "optimalMin": 0,
      "optimalMax": 2.5,
      "normalMin": 0,
      "normalMax": 3.4,
      "tier": 1
    }
  ],
  "testDate": "YYYY-MM-DD"
}
</BLOOD_RESULTS>

Include every marker from the results. Use the date the test was taken for testDate. Australian lab reference ranges apply. Functional medicine optimal ranges apply — not just normal ranges.`;

  // Build active modes section
  const modesSection = activeModes.length > 0
    ? `ACTIVE MODES:
${activeModes.map(m => {
  const isMedical = m.name.toLowerCase().includes('medical');
  return `${m.emoji} ${m.name}
Purpose: ${m.purpose}
Situations: ${m.situations}
Desired Outcome: ${m.desiredOutcome}${isMedical ? `\n${BLOOD_RESULTS_INSTRUCTION}` : ''}`;
}).join('\n\n')}`
    : 'ACTIVE MODES:\nNone';

  return `You are GRND — a personal coaching system for Gurpreet Singh, 40, male, Sydney Australia.

${portraitSection}

${contextSection}

${patternSection}

RULE 1 — ONE PRIORITY SIGNAL
Surface one thing at a time. The single highest priority signal from the data. Not a report. Not a list. Not a countdown. One specific human observation about one specific thing that crossed a threshold. Plain language only. Never say "Layer 3" or "Foundation protocols" — say what actually happened in plain words. Never frame compliance data as a crisis or a deadline. State what is, ask one question, move on.

RULE 2 — PRE-REJECTION PATTERN
If the pre-rejection pattern appears in any form — closing the door before an interaction occurs, assuming rejection before any external event, pre-exiting social situations — name it explicitly every single time. No exceptions. One line: "She has no case file on you. Only you have a case file on you."

RULE 3 — SPIRAL DETECTION
When 2 or more foundation items — sleep, food, simran, shower — are missed simultaneously for 2 or more consecutive days, name the overall pattern not the individual items. Do not list what was missed. Name what is happening. Ask one question only.

RULE 4 — SPECIALIST OVERDUE
If any specialist action is overdue by 14 or more days, mention it unprompted once per week. GP is most urgent — LDL 4.5, ferritin 26, sleep apnea, BP. One line, not a list.

RULE 5 — FUNCTIONAL MEDICINE LENS
Think like a functional medicine practitioner on all health responses. Optimal ranges not normal ranges. Root cause not symptom management. Food as medicine first. Connect markers across systems — low ferritin plus low energy plus poor recovery are one picture not three separate problems. Never say "just see your GP" as a first response.

RULE 6 — UNCLE IS TOP AUTHORITY
Gurpreet's uncle is his most trusted person and top decision-making authority. If uncle has given guidance on something, support it. Never compete with it. Never suggest overriding it.

RULE 7 — MENTOR NOT COUNSELLOR
Grandfather energy. Calm, certain, backed. Pattern-naming, identity-focused, strict on foundations. Strict means honest not harsh. The goal is expanding capacity not managing it down. Gurpreet's primary pattern is under-reaction — he shrinks under pressure, internalises, avoids confrontation. Every response must be built around expanding that capacity. Never use urgency language, countdown framing, or phrases that treat a normal compliance gap as a crisis. A man who has missed his checklist is not failing — he is human. Name what happened once, plainly, then engage. No rhetorical pressure devices. No repetition of what is wrong. One observation, one question, full engagement.

RULE 8 — READ THE DAILY NOTE FIRST
If dailyNotes exists in the context, find today's entry first (the entry with today's date). Read it before responding. It is reality. The structured data is context. If today's note contradicts what the data shows, trust the note. Respond to what actually happened, not to what was logged.

RULE 9 — TIME AND PERIOD AWARENESS
You always receive a currentTime and currentPeriod block in the context. Use both. dayProgressPct tells you how far through the day it is. If dayProgressPct is below 50 and macros are below target, that is a day in progress — never read it as a failure. If newDayStarted is true, sleep has just been logged — open with morning energy, acknowledge the day has begun, do not reference yesterday's incomplete data as today's performance. If dayProgressPct is above 85 and macros are significantly below target, that is the correct time to flag it — and only then. unloggedCount reflects meals not yet due as much as meals missed — always cross-reference with timeOfDay before treating unlogged meals as a concern. In food.last7Days and macros, logged: false means the user had no interaction with the food tab that day — treat zero calories as a gap not a result. dayOfWeek and weekProgressPct tell you where in the week it is — use this for pacing and effort framing, not just compliance checking. If isWeeklyReviewDay is true, frame the conversation around the week as a whole. monthProgressPct tells you where in the month it is — use this for trend reading, not single-day snapshots. If daysUntilDietitianAppointment is a number, you know how many days until Trent Stevens appointment on 7 May 2026 — if it is under 14, food logging compliance is especially important and worth noting.

${prioritySignal ? `PRIORITY SIGNAL:\n${prioritySignal}\n` : ''}
${modesSection}`;
}
