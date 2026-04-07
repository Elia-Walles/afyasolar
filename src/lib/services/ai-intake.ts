import { env } from '@/lib/env'

export type IntakeMessage = {
  role: 'patient' | 'assistant' | 'system'
  message: string
}

export type IntakeSummaryResult = {
  structuredSummary: any
  rawSummary: string
  modelName: string
  tokensUsed: number
  status: 'completed' | 'failed'
  error?: string
}

const DEFAULT_SYSTEM_PROMPT = `
You are a medical intake assistant helping clinicians in East Africa.
Given a conversation between a patient and the intake bot, produce a JSON object with the following schema:
{
  "visit_type": "first_time | follow_up | chronic_clinic",
  "chief_complaint": "string",
  "onset": "YYYY-MM-DD or duration string",
  "symptoms": ["string"],
  "red_flags": ["string"],
  "history": {
    "medical": "string",
    "surgical": "string",
    "medications": ["string"],
    "allergies": ["string"]
  },
  "vitals_reported": {
    "temp": "string",
    "bp": "string",
    "hr": "string"
  },
  "pregnancy_status": "unknown | pregnant | not_pregnant",
  "impression": "short summary",
  "urgency": "routine | soon | urgent",
  "next_steps": ["string"]
}
Return ONLY valid JSON. Do not include commentary.
`

function buildConversationPrompt(conversation: IntakeMessage[]) {
  return conversation
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.message}`)
    .join('\n')
}

function buildFallbackSummary(conversation: IntakeMessage[]): IntakeSummaryResult {
  const combined = conversation.map((c) => c.message).join(' ')
  return {
    structuredSummary: {
      visit_type: 'first_time',
      chief_complaint: combined.slice(0, 140) || 'Not provided',
      onset: 'unknown',
      symptoms: [],
      red_flags: [],
      history: {
        medical: '',
        surgical: '',
        medications: [],
        allergies: [],
      },
      vitals_reported: {
        temp: '',
        bp: '',
        hr: '',
      },
      pregnancy_status: 'unknown',
      impression: combined.slice(0, 200),
      urgency: 'routine',
      next_steps: ['Review during consultation'],
    },
    rawSummary: combined,
    modelName: 'fallback-local',
    tokensUsed: 0,
    status: 'completed',
  }
}

export async function generateStructuredIntakeSummary({
  conversation,
  facilityName,
}: {
  conversation: IntakeMessage[]
  facilityName: string
}): Promise<IntakeSummaryResult> {
  if (!env.GOOGLE_AI_API_KEY) {
    return buildFallbackSummary(conversation)
  }

  try {
    const prompt = `${env.GOOGLE_AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT}

Facility: ${facilityName}
Conversation:
${buildConversationPrompt(conversation)}
`

    const modelName = env.GOOGLE_AI_MODEL_NAME || 'gemini-1.5-flash'
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`AI request failed: ${errorBody}`)
    }

    const data = await response.json()
    const textResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      ''

    const parsed = JSON.parse(textResponse)

    return {
      structuredSummary: parsed,
      rawSummary: textResponse,
      modelName,
      tokensUsed: data?.usageMetadata?.totalTokenCount ?? 0,
      status: 'completed',
    }
  } catch (error: any) {
    console.error('AI intake summary failed:', error)
    const fallback = buildFallbackSummary(conversation)
    fallback.status = 'failed'
    fallback.error = error?.message || 'AI request failed'
    return fallback
  }
}

