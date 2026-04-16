"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, FileUp, Globe, Database } from "lucide-react"

type Lang = "en" | "sw"

type ModuleCode = "HES" | "CSF" | "ECPQ" | "EDC" | "RRC"

type AnswerChoice = {
  id: string
  label_en: string
  label_sw: string
  score: number
}

type Question = {
  module: ModuleCode
  code: string
  title_en: string
  title_sw: string
  helper_en: string
  helper_sw: string
  max: number
  choices: AnswerChoice[]
  evidenceSuggested?: boolean
  redFlagIfAnswerId?: string
}

type EvidenceItem = {
  questionCode: string
  type: "photo" | "document" | "url" | "note"
  fileUrl?: string
  note?: string
  capturedAt: string
}

const MODULE_MAX: Record<ModuleCode, number> = {
  HES: 20,
  CSF: 30,
  ECPQ: 25,
  EDC: 15,
  RRC: 10,
}

// Guided climate flow (v2.0): 3–6 questions per screen, progressive disclosure, assistive helper text.
const QUESTIONS: Question[] = [
  {
    module: "HES",
    code: "HES_FLOOD",
    title_en: "Flood exposure around the facility",
    title_sw: "Hatari ya mafuriko eneo la kituo",
    helper_en: "Why this matters: flood events can damage inverters, batteries, and critical service areas.",
    helper_sw: "Kwa nini ni muhimu: mafuriko yanaweza kuharibu inverter, betri, na maeneo ya huduma muhimu.",
    max: 5,
    evidenceSuggested: true,
    choices: [
      { id: "none", label_en: "No known flood exposure", label_sw: "Hakuna hatari inayojulikana", score: 0 },
      { id: "low", label_en: "Low / rare flooding nearby", label_sw: "Chini / nadra karibu", score: 1 },
      { id: "med", label_en: "Medium / occasional flooding", label_sw: "Wastani / mara kwa mara", score: 3 },
      { id: "high", label_en: "High / frequent flooding impacts", label_sw: "Kubwa / huathiri mara nyingi", score: 5 },
    ],
  },
  {
    module: "HES",
    code: "HES_HEAT",
    title_en: "Heat stress risk (high temperatures)",
    title_sw: "Hatari ya joto kali",
    helper_en: "Why this matters: heat reduces battery life and increases cold-chain and medicine spoilage risk.",
    helper_sw: "Kwa nini ni muhimu: joto hupunguza maisha ya betri na huongeza hatari ya baridi (cold chain) na kuharibika kwa dawa.",
    max: 5,
    evidenceSuggested: false,
    choices: [
      { id: "none", label_en: "Low heat risk", label_sw: "Hatari ndogo ya joto", score: 0 },
      { id: "low", label_en: "Some hot periods", label_sw: "Kuna vipindi vya joto", score: 1 },
      { id: "med", label_en: "Frequent heat stress", label_sw: "Joto kali mara kwa mara", score: 3 },
      { id: "high", label_en: "Severe heat stress", label_sw: "Joto kali sana", score: 5 },
    ],
  },
  {
    module: "HES",
    code: "HES_STORM",
    title_en: "Storm / wind / lightning exposure",
    title_sw: "Hatari ya dhoruba / upepo / radi",
    helper_en: "Why this matters: storms can damage PV and disrupt grid reliability.",
    helper_sw: "Kwa nini ni muhimu: dhoruba zinaweza kuharibu PV na kuvuruga upatikanaji wa umeme wa gridi.",
    max: 5,
    evidenceSuggested: false,
    choices: [
      { id: "none", label_en: "Low", label_sw: "Chini", score: 0 },
      { id: "low", label_en: "Occasional", label_sw: "Mara chache", score: 1 },
      { id: "med", label_en: "Regular", label_sw: "Mara kwa mara", score: 3 },
      { id: "high", label_en: "Severe", label_sw: "Kubwa sana", score: 5 },
    ],
  },
  {
    module: "HES",
    code: "HES_GRID",
    title_en: "Grid instability exposure",
    title_sw: "Hatari ya kutokuwa thabiti kwa gridi",
    helper_en: "Why this matters: unstable grid increases outage exposure and equipment stress.",
    helper_sw: "Kwa nini ni muhimu: gridi isiyo thabiti huongeza kukatika kwa umeme na kuathiri vifaa.",
    max: 5,
    evidenceSuggested: false,
    choices: [
      { id: "stable", label_en: "Stable", label_sw: "Imara", score: 0 },
      { id: "minor", label_en: "Minor issues", label_sw: "Changamoto ndogo", score: 1 },
      { id: "med", label_en: "Frequent outages", label_sw: "Kukatika mara kwa mara", score: 3 },
      { id: "severe", label_en: "Severe instability", label_sw: "Kutokuwa thabiti sana", score: 5 },
    ],
  },
  {
    module: "CSF",
    code: "CSF_COLD_CHAIN",
    title_en: "Cold-chain fragility (vaccines/medicines)",
    title_sw: "Udhaifu wa cold chain (chanjo/dawa)",
    helper_en: "Why this matters: cold-chain failures are high-severity clinical risks.",
    helper_sw: "Kwa nini ni muhimu: kushindwa kwa cold chain ni hatari kubwa kwa huduma za afya.",
    max: 10,
    evidenceSuggested: true,
    redFlagIfAnswerId: "severe",
    choices: [
      { id: "none", label_en: "No cold-chain services", label_sw: "Hakuna huduma za cold chain", score: 0 },
      { id: "managed", label_en: "Cold chain present & well managed", label_sw: "Ipo na inadhibitiwa vizuri", score: 3 },
      { id: "weak", label_en: "Cold chain present with gaps", label_sw: "Ipo lakini kuna mapungufu", score: 7 },
      { id: "severe", label_en: "Frequent cold-chain failures", label_sw: "Kushindwa mara kwa mara", score: 10 },
    ],
  },
  {
    module: "CSF",
    code: "CSF_MATERNITY",
    title_en: "Critical service fragility (maternity / theatre / lab)",
    title_sw: "Udhaifu wa huduma muhimu (uzazi / upasuaji / maabara)",
    helper_en: "Why this matters: outages during critical services increase harm risk.",
    helper_sw: "Kwa nini ni muhimu: kukatika umeme wakati wa huduma muhimu huongeza hatari ya madhara.",
    max: 10,
    evidenceSuggested: false,
    choices: [
      { id: "low", label_en: "Low fragility", label_sw: "Udhaifu mdogo", score: 2 },
      { id: "med", label_en: "Medium fragility", label_sw: "Udhaifu wa wastani", score: 6 },
      { id: "high", label_en: "High fragility", label_sw: "Udhaifu mkubwa", score: 10 },
    ],
  },
  {
    module: "CSF",
    code: "CSF_WATER",
    title_en: "Water / pump dependency fragility",
    title_sw: "Udhaifu wa utegemezi wa maji/pampu",
    helper_en: "Why this matters: power loss can stop water and sanitation services.",
    helper_sw: "Kwa nini ni muhimu: kukatika umeme kunaweza kusimamisha huduma za maji na usafi.",
    max: 10,
    evidenceSuggested: false,
    choices: [
      { id: "low", label_en: "Low dependency", label_sw: "Utegemezi mdogo", score: 2 },
      { id: "med", label_en: "Medium dependency", label_sw: "Utegemezi wa wastani", score: 6 },
      { id: "high", label_en: "High dependency", label_sw: "Utegemezi mkubwa", score: 10 },
    ],
  },
  {
    module: "ECPQ",
    code: "ECPQ_BACKUP",
    title_en: "Backup coverage for critical loads",
    title_sw: "Uwezo wa backup kwa mizigo muhimu",
    helper_en: "Why this matters: continuity depends on critical circuits and autonomy.",
    helper_sw: "Kwa nini ni muhimu: mwendelezo wa huduma unategemea mizigo muhimu na muda wa backup.",
    max: 10,
    evidenceSuggested: true,
    redFlagIfAnswerId: "none",
    choices: [
      { id: "none", label_en: "No backup", label_sw: "Hakuna backup", score: 10 },
      { id: "partial", label_en: "Partial backup", label_sw: "Backup ya sehemu", score: 6 },
      { id: "mostly", label_en: "Mostly covered", label_sw: "Karibu zote", score: 3 },
      { id: "full", label_en: "Fully covered", label_sw: "Imefunikwa kikamilifu", score: 0 },
    ],
  },
  {
    module: "ECPQ",
    code: "ECPQ_POWER_QUALITY",
    title_en: "Power quality issues (voltage spikes, outages)",
    title_sw: "Changamoto za ubora wa umeme (mabadiliko ya voltage, kukatika)",
    helper_en: "Why this matters: poor power quality damages equipment and increases downtime.",
    helper_sw: "Kwa nini ni muhimu: ubora duni wa umeme huathiri vifaa na kuongeza muda wa kusimama.",
    max: 8,
    evidenceSuggested: false,
    choices: [
      { id: "none", label_en: "No issues", label_sw: "Hakuna changamoto", score: 0 },
      { id: "some", label_en: "Some issues", label_sw: "Changamoto kidogo", score: 4 },
      { id: "many", label_en: "Frequent issues", label_sw: "Changamoto mara kwa mara", score: 8 },
    ],
  },
  {
    module: "ECPQ",
    code: "ECPQ_PROTECTION",
    title_en: "Electrical protection & grounding readiness",
    title_sw: "Ulinzi wa umeme na grounding",
    helper_en: "Why this matters: lightning and surge protection reduces failures.",
    helper_sw: "Kwa nini ni muhimu: ulinzi dhidi ya radi na surge hupunguza kushindwa kwa mfumo.",
    max: 7,
    evidenceSuggested: false,
    choices: [
      { id: "good", label_en: "Adequate protection", label_sw: "Ulinzi wa kutosha", score: 0 },
      { id: "partial", label_en: "Partial", label_sw: "Sehemu", score: 3 },
      { id: "poor", label_en: "Poor", label_sw: "Duni", score: 7 },
    ],
  },
  {
    module: "EDC",
    code: "EDC_DEMAND",
    title_en: "Demand control practices (switch-off, scheduling)",
    title_sw: "Udhibiti wa matumizi (kuzima, ratiba)",
    helper_en: "Why this matters: demand control reduces cost and improves backup feasibility.",
    helper_sw: "Kwa nini ni muhimu: udhibiti wa matumizi hupunguza gharama na kuongeza uwezo wa backup.",
    max: 8,
    evidenceSuggested: false,
    choices: [
      { id: "strong", label_en: "Strong practices", label_sw: "Mazoea bora", score: 0 },
      { id: "some", label_en: "Some practices", label_sw: "Mazoea kiasi", score: 4 },
      { id: "none", label_en: "No practices", label_sw: "Hakuna", score: 8 },
    ],
  },
  {
    module: "EDC",
    code: "EDC_THERMAL",
    title_en: "Thermal efficiency (ventilation, shading, insulation)",
    title_sw: "Ufanisi wa joto (uingizaji hewa, kivuli, insulation)",
    helper_en: "Why this matters: cooling load reduction improves savings and resilience.",
    helper_sw: "Kwa nini ni muhimu: kupunguza mzigo wa kupoeza huongeza akiba na uimara.",
    max: 7,
    evidenceSuggested: true,
    choices: [
      { id: "good", label_en: "Good", label_sw: "Nzuri", score: 0 },
      { id: "some", label_en: "Some gaps", label_sw: "Mapungufu", score: 3 },
      { id: "poor", label_en: "Poor", label_sw: "Duni", score: 7 },
    ],
  },
  {
    module: "RRC",
    code: "RRC_SOP",
    title_en: "Readiness SOPs & response training",
    title_sw: "SOP za utayari na mafunzo ya majibu",
    helper_en: "Why this matters: documented SOPs reduce operational failure during shocks.",
    helper_sw: "Kwa nini ni muhimu: SOP zilizoandikwa hupunguza kushindwa kwa uendeshaji wakati wa mshtuko.",
    max: 5,
    evidenceSuggested: true,
    choices: [
      { id: "yes", label_en: "SOPs exist & trained", label_sw: "Zipo na kuna mafunzo", score: 0 },
      { id: "partial", label_en: "Partial SOPs", label_sw: "SOP za sehemu", score: 2 },
      { id: "no", label_en: "No SOPs", label_sw: "Hakuna SOP", score: 5 },
    ],
  },
  {
    module: "RRC",
    code: "RRC_EVIDENCE",
    title_en: "Evidence capture readiness",
    title_sw: "Uwezo wa kuhifadhi ushahidi",
    helper_en: "Why this matters: evidence supports funding, QA, and learning loops.",
    helper_sw: "Kwa nini ni muhimu: ushahidi husaidia ufadhili, ubora, na maboresho endelevu.",
    max: 5,
    evidenceSuggested: true,
    choices: [
      { id: "yes", label_en: "Evidence routinely captured", label_sw: "Ushahidi hukusanywa mara kwa mara", score: 0 },
      { id: "some", label_en: "Sometimes captured", label_sw: "Wakati mwingine", score: 2 },
      { id: "no", label_en: "Not captured", label_sw: "Haukusanwi", score: 5 },
    ],
  },
]

type ResponseMap = Record<string, { answerId: string; note?: string }>

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getTier(score: number, criticalAttention: boolean) {
  if (criticalAttention) return { tier: 0, label: "Critical attention" }
  if (score >= 80) return { tier: 3, label: "Tier 3 (strong)" }
  if (score >= 60) return { tier: 2, label: "Tier 2 (moderate)" }
  if (score >= 40) return { tier: 1, label: "Tier 1 (weak)" }
  return { tier: 0, label: "Tier 0 (fragile)" }
}

function computeModuleScores(responses: ResponseMap) {
  const sums: Record<ModuleCode, number> = { HES: 0, CSF: 0, ECPQ: 0, EDC: 0, RRC: 0 }
  const max: Record<ModuleCode, number> = { HES: 0, CSF: 0, ECPQ: 0, EDC: 0, RRC: 0 }
  let criticalAttention = false

  for (const q of QUESTIONS) {
    max[q.module] += q.max
    const r = responses[q.code]
    if (!r?.answerId) continue
    const choice = q.choices.find((c) => c.id === r.answerId)
    if (!choice) continue
    sums[q.module] += clamp(choice.score, 0, q.max)
    if (q.redFlagIfAnswerId && r.answerId === q.redFlagIfAnswerId) {
      criticalAttention = true
    }
  }

  // Normalize each module to required maxima in the document.
  const normalized: Record<ModuleCode, number> = { HES: 0, CSF: 0, ECPQ: 0, EDC: 0, RRC: 0 }
  ;(Object.keys(MODULE_MAX) as ModuleCode[]).forEach((m) => {
    const rawMax = Math.max(1, max[m])
    normalized[m] = Math.round((sums[m] / rawMax) * MODULE_MAX[m] * 10) / 10
  })

  const total =
    normalized.HES + normalized.CSF + normalized.ECPQ + normalized.EDC + normalized.RRC

  return {
    raw: sums,
    normalized,
    total: Math.round(total * 10) / 10,
    criticalAttention,
  }
}

function rankTopRisks(scores: Record<ModuleCode, number>) {
  const drivers = [
    { key: "flood", module: "HES" as const, title_en: "Flood exposure", title_sw: "Hatari ya mafuriko", w: 1.0 },
    { key: "heat", module: "HES" as const, title_en: "Heat stress", title_sw: "Joto kali", w: 0.9 },
    { key: "cold", module: "CSF" as const, title_en: "Cold-chain fragility", title_sw: "Udhaifu wa cold chain", w: 1.2 },
    { key: "backup", module: "ECPQ" as const, title_en: "Backup gaps", title_sw: "Mapungufu ya backup", w: 1.1 },
    { key: "sop", module: "RRC" as const, title_en: "SOP & readiness", title_sw: "SOP na utayari", w: 1.0 },
  ]
  const list = drivers
    .map((d) => {
      const moduleScore = scores[d.module]
      return {
        ...d,
        severity: Math.round(clamp((moduleScore / MODULE_MAX[d.module]) * 100 * d.w, 0, 100)),
      }
    })
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5)

  return list
}

function storageKey(facilityId: string) {
  return `afyasolar:climateAssessment:v2:${facilityId}`
}

export function ClimateResilienceAssessment({
  facilityId,
  assessmentCycleId,
  onCapacityScoreChange,
  readOnly = false,
}: {
  facilityId: string
  assessmentCycleId?: string
  onCapacityScoreChange?: (score: number | null) => void
  /** Historical / submitted cycle — no edits or autosave */
  readOnly?: boolean
}) {
  const [lang, setLang] = useState<Lang>("en")
  const [step, setStep] = useState<number>(0)
  const [responses, setResponses] = useState<ResponseMap>({})
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [remoteLoaded, setRemoteLoaded] = useState<boolean>(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessAt, setSaveSuccessAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!assessmentCycleId) return

    ;(async () => {
      try {
        const res = await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, { cache: "no-store" })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) return

        const nextResponses: ResponseMap = {}
        const serverResponses = Array.isArray(json?.responses) ? json.responses : []
        for (const r of serverResponses) {
          if (!r?.questionCode || !r?.answerValue) continue
          nextResponses[String(r.questionCode)] = {
            answerId: String(r.answerValue),
            note: typeof r.note === "string" ? r.note : undefined,
          }
        }

        const serverEvidence = Array.isArray(json?.evidence) ? json.evidence : []
        const nextEvidence: EvidenceItem[] = serverEvidence
          .filter((e: any) => e?.questionCode && e?.type)
          .map((e: any) => ({
            questionCode: String(e.questionCode),
            type: e.type as EvidenceItem["type"],
            fileUrl: typeof e.fileUrl === "string" ? e.fileUrl : undefined,
            note: typeof e.note === "string" ? e.note : undefined,
            capturedAt: e.capturedAt ? new Date(e.capturedAt).toISOString() : new Date().toISOString(),
          }))

        setResponses(nextResponses)
        setEvidence(nextEvidence)
        setRemoteLoaded(true)
      } catch {
        if (!cancelled) setRemoteLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assessmentCycleId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(facilityId))
      if (!raw) return
      // If remote persisted data exists, prefer it over local draft.
      if (assessmentCycleId && remoteLoaded) return
      const parsed = JSON.parse(raw)
      if (parsed?.responses) setResponses(parsed.responses)
      if (Array.isArray(parsed?.evidence)) setEvidence(parsed.evidence)
      if (typeof parsed?.step === "number") setStep(parsed.step)
    } catch {
      // ignore
    }
  }, [facilityId])

  useEffect(() => {
    if (readOnly) return
    try {
      // Keep local drafts for offline continuity even when DB persistence is enabled.
      localStorage.setItem(
        storageKey(facilityId),
        JSON.stringify({ responses, evidence, step, updatedAt: new Date().toISOString() })
      )
    } catch {
      // ignore
    }
  }, [facilityId, responses, evidence, step, readOnly])

  const pages = useMemo(() => {
    const groups: { id: string; title_en: string; title_sw: string; items: Question[] }[] = [
      { id: "hazards", title_en: "Hazard profile", title_sw: "Wasifu wa hatari", items: QUESTIONS.filter((q) => q.module === "HES") },
      { id: "fragility", title_en: "Critical service fragility", title_sw: "Udhaifu wa huduma muhimu", items: QUESTIONS.filter((q) => q.module === "CSF") },
      { id: "continuity", title_en: "Energy continuity & power quality", title_sw: "Mwendelezo wa umeme na ubora", items: QUESTIONS.filter((q) => q.module === "ECPQ") },
      { id: "demand", title_en: "Efficiency & demand control", title_sw: "Ufanisi na udhibiti wa matumizi", items: QUESTIONS.filter((q) => q.module === "EDC") },
      { id: "readiness", title_en: "Readiness & response", title_sw: "Utayari na majibu", items: QUESTIONS.filter((q) => q.module === "RRC") },
      { id: "results", title_en: "Results & adaptation plan", title_sw: "Matokeo na mpango wa maboresho", items: [] },
    ]
    return groups
  }, [])

  const currentPage = pages[step] ?? pages[0]

  const scores = useMemo(() => computeModuleScores(responses), [responses])
  const tier = useMemo(() => getTier(100 - scores.total, scores.criticalAttention), [scores])
  // Note: scores.total is risk-weighted; invert to present capacity score.
  const resilienceCapacityScore = useMemo(() => Math.round((100 - scores.total) * 10) / 10, [scores])

  const topRisks = useMemo(() => rankTopRisks(scores.normalized), [scores])

  const answeredCount = useMemo(() => {
    return QUESTIONS.filter((q) => responses[q.code]?.answerId).length
  }, [responses])

  const totalQuestions = QUESTIONS.length
  const progress = Math.round((answeredCount / totalQuestions) * 100)

  const t = (en: string, sw: string) => (lang === "en" ? en : sw)

  const buildResponseRows = () => {
    return QUESTIONS.map((q) => {
      const r = responses[q.code]
      const choice = q.choices.find((c) => c.id === r?.answerId)
      if (!r?.answerId || !choice) return null
      return {
        moduleCode: q.module,
        questionCode: q.code,
        answerValue: r.answerId,
        score: clamp(choice.score, 0, q.max),
        scoreMax: q.max,
        note: r.note ?? null,
        confidence: 100,
        isRedFlag: Boolean(q.redFlagIfAnswerId && r.answerId === q.redFlagIfAnswerId),
      }
    }).filter(Boolean) as any[]
  }

  const buildEvidenceRows = () => {
    return evidence.map((e) => ({
      questionCode: e.questionCode,
      type: e.type,
      fileUrl: e.fileUrl ?? null,
      note: e.note ?? null,
      capturedAt: e.capturedAt,
    }))
  }

  useEffect(() => {
    onCapacityScoreChange?.(answeredCount > 0 ? resilienceCapacityScore : null)
  }, [answeredCount, onCapacityScoreChange, resilienceCapacityScore])

  // Persist to DB (auto-save) when assessmentCycleId is available.
  useEffect(() => {
    let cancelled = false
    if (readOnly) return
    if (!assessmentCycleId) return
    if (!remoteLoaded) return

    const timeout = setTimeout(async () => {
      try {
        // Build normalized response rows from QUESTIONS (single source of truth for scoring).
        const responseRows = QUESTIONS.map((q) => {
          const r = responses[q.code]
          const choice = q.choices.find((c) => c.id === r?.answerId)
          if (!r?.answerId || !choice) return null
          return {
            moduleCode: q.module,
            questionCode: q.code,
            answerValue: r.answerId,
            score: clamp(choice.score, 0, q.max),
            scoreMax: q.max,
            note: r.note ?? null,
            confidence: 100,
            isRedFlag: Boolean(q.redFlagIfAnswerId && r.answerId === q.redFlagIfAnswerId),
          }
        }).filter(Boolean)

        const evidenceRows = evidence.map((e) => ({
          questionCode: e.questionCode,
          type: e.type,
          fileUrl: e.fileUrl ?? null,
          note: e.note ?? null,
          capturedAt: e.capturedAt,
        }))

        await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: responseRows, evidence: evidenceRows }),
        })

        // Persist computed score + top risks for reporting/portfolio.
        if (!cancelled && responseRows.length > 0) {
          await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ responses: responseRows }),
          })
        }
      } catch {
        // ignore (offline / transient)
      }
    }, 900)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [assessmentCycleId, evidence, remoteLoaded, responses, readOnly])

  const saveClimateToDatabase = async () => {
    if (readOnly) return
    if (!assessmentCycleId) return
    if (!remoteLoaded) {
      setSaveError("Loading saved climate record first...")
      return
    }

    const responseRows = buildResponseRows()
    if (responseRows.length === 0) {
      setSaveError("Select answers before saving climate.")
      return
    }

    setSaveBusy(true)
    setSaveError(null)
    try {
      const evidenceRows = buildEvidenceRows()

      await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: responseRows, evidence: evidenceRows }),
      })

      await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: responseRows }),
      })

      const snapRes = await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, { cache: "no-store" })
      const snapJson = await snapRes.json().catch(() => ({} as any))
      if (!snapRes.ok) throw new Error((snapJson as any)?.error || "Failed to compute climate snapshot")

      const saveRes = await fetch(`/api/facility/${facilityId}/assessment-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceVersion: "3.0",
          assessmentCycleId,
          climate: snapJson,
        }),
      })
      const saveJson = await saveRes.json().catch(() => ({} as any))
      if (!saveRes.ok || !saveJson?.success) {
        throw new Error((saveJson as any)?.error || "Failed to save climate to database")
      }

      setSaveSuccessAt(Date.now())
      window.setTimeout(() => setSaveSuccessAt(null), 2000)
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save climate")
    } finally {
      setSaveBusy(false)
    }
  }

  const addEvidence = (questionCode: string, item: Omit<EvidenceItem, "capturedAt" | "questionCode">) => {
    setEvidence((prev) => [
      { questionCode, capturedAt: new Date().toISOString(), ...item },
      ...prev,
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? t("Viewing a saved assessment record (read-only).", "Unaona rekodi iliyohifadhiwa (soma tu).")
              : t(
                  "Guided climate resilience assessment (CRiPHC-aligned scoring scaffold).",
                  "Tathmini elekezi ya uimara wa hali ya hewa (skafoldi ya alama)."
                )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLang((l) => (l === "en" ? "sw" : "en"))}
        >
          <Globe className="h-4 w-4 mr-1" />
          {lang === "en" ? "SW" : "EN"}
        </Button>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveBusy || !assessmentCycleId}
            onClick={() => void saveClimateToDatabase()}
          >
            <Database className="h-4 w-4 mr-1" aria-hidden />
            {saveBusy ? "Saving..." : "Save Climate to Database"}
          </Button>
        )}
      </div>
      {(saveError || saveSuccessAt) && (
        <div className="text-xs">
          {saveError && <span className="text-red-600">{saveError}</span>}
          {saveSuccessAt && <span className="text-emerald-700">Climate saved to database.</span>}
        </div>
      )}

      <fieldset
        disabled={readOnly}
        className="min-w-0 space-y-4 border-0 p-0 m-0 disabled:opacity-[0.88]"
      >
      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {t("Climate Resilience & Adaptation", "Uimara wa hali ya hewa na maboresho")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "Answer 3–6 questions per screen. Add notes and evidence when relevant.",
                  "Jibu maswali 3–6 kwa kila ukurasa. Ongeza maelezo na ushahidi inapofaa."
                )}
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-emerald-200 text-emerald-800">
              {t("Progress", "Maendeleo")}: {progress}%
            </Badge>
          </div>
          <Progress value={progress} className="h-2 mt-2 bg-emerald-100" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stepper */}
          <div className="grid gap-2 sm:grid-cols-6">
            {pages.map((p, idx) => {
              const active = idx === step
              const complete = idx < step
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStep(idx)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                    active
                      ? "border-emerald-300 bg-white shadow-sm"
                      : complete
                        ? "border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("font-medium", active ? "text-emerald-950" : "text-slate-700")}>
                      {lang === "en" ? p.title_en : p.title_sw}
                    </span>
                    {complete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : active ? (
                      <Badge className="bg-emerald-600 text-white text-[10px]">Now</Badge>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Content */}
          {currentPage.id !== "results" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                <p className="text-sm font-semibold text-emerald-950">
                  {lang === "en" ? currentPage.title_en : currentPage.title_sw}
                </p>
                <p className="text-xs text-emerald-900/70 mt-1">
                  {t(
                    "Keep answers practical. Add evidence only when it strengthens decisions or funding readiness.",
                    "Jibu kwa vitendo. Ongeza ushahidi pale unaposaidia maamuzi au ufadhili."
                  )}
                </p>
              </div>

              <div className="space-y-4">
                {currentPage.items.map((q) => {
                  const r = responses[q.code]
                  const choice = q.choices.find((c) => c.id === r?.answerId)
                  const hasRedFlag = Boolean(q.redFlagIfAnswerId && r?.answerId === q.redFlagIfAnswerId)
                  const evidenceCount = evidence.filter((e) => e.questionCode === q.code).length

                  return (
                    <Card key={q.code} className={cn("border-emerald-100", hasRedFlag && "border-amber-200")}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="text-sm">
                              {lang === "en" ? q.title_en : q.title_sw}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {lang === "en" ? q.helper_en : q.helper_sw}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasRedFlag && (
                              <Badge className="bg-amber-100 text-amber-900 border border-amber-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {t("Red flag", "Bendera nyekundu")}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {t("Max", "Kikomo")}: {q.max}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("Answer", "Jibu")}</Label>
                          <Select
                            value={r?.answerId ?? ""}
                            onValueChange={(v) =>
                              setResponses((prev) => ({
                                ...prev,
                                [q.code]: { ...prev[q.code], answerId: v },
                              }))
                            }
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder={t("Select an option", "Chagua")}/>
                            </SelectTrigger>
                            <SelectContent>
                              {q.choices.map((c) => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                  {lang === "en" ? c.label_en : c.label_sw}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            {t("Score", "Alama")}: {choice ? choice.score : "—"} / {q.max}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">{t("Optional note", "Maelezo (hiari)")}</Label>
                          <Textarea
                            value={r?.note ?? ""}
                            onChange={(e) =>
                              setResponses((prev) => ({
                                ...prev,
                                [q.code]: { ...prev[q.code], note: e.target.value },
                              }))
                            }
                            placeholder={t("Add context, assumptions, or constraints", "Ongeza muktadha au vikwazo")}
                            className="text-xs"
                          />
                        </div>

                        {q.evidenceSuggested && (
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-emerald-950">
                                {t("Evidence (optional)", "Ushahidi (hiari)")}
                              </p>
                              <Badge variant="outline" className="text-[10px]">
                                {evidenceCount} {t("items", "vipengele")}
                              </Badge>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">{t("Evidence URL", "Kiungo cha ushahidi")}</Label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="https://..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const v = (e.target as HTMLInputElement).value.trim()
                                      if (!v) return
                                      addEvidence(q.code, { type: "url", fileUrl: v })
                                      ;(e.target as HTMLInputElement).value = ""
                                    }
                                  }}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  {t("Press Enter to add.", "Bonyeza Enter kuongeza.")}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{t("Evidence note", "Maelezo ya ushahidi")}</Label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder={t("Short description", "Maelezo mafupi")}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const v = (e.target as HTMLInputElement).value.trim()
                                      if (!v) return
                                      addEvidence(q.code, { type: "note", note: v })
                                      ;(e.target as HTMLInputElement).value = ""
                                    }
                                  }}
                                />
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <FileUp className="h-3.5 w-3.5" />
                                  {t("Upload support can be added later.", "Upakiaji utaongezwa baadaye.")}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  {t("Back", "Nyuma")}
                </Button>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStep((s) => Math.min(pages.length - 1, s + 1))}>
                  {t("Next", "Mbele")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-emerald-100 lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("Resilience Capacity Score", "Alama ya Uimara")}</CardTitle>
                    <CardDescription className="text-xs">{t("0–100 (higher = better)", "0–100 (juu ni bora)")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-emerald-800">{resilienceCapacityScore}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{t("Tier", "Kiwango")}: {tier.tier}</Badge>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-900">
                        {tier.label}
                      </Badge>
                      {scores.criticalAttention && (
                        <Badge className="bg-amber-100 text-amber-900 border border-amber-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t("Critical attention", "Umuhimu wa haraka")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-emerald-100 lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("Score breakdown", "Mgawanyo wa alama")}</CardTitle>
                    <CardDescription className="text-xs">
                      {t("HES / CSF / ECPQ / EDC / RRC contribute to total (risk-weighted).", "HES / CSF / ECPQ / EDC / RRC huchangia jumla.")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-5 text-xs">
                    {(["HES", "CSF", "ECPQ", "EDC", "RRC"] as ModuleCode[]).map((m) => (
                      <div key={m} className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-muted-foreground">{m}</p>
                        <p className="text-lg font-semibold">{scores.normalized[m]} / {MODULE_MAX[m]}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-sm">{t("Top 5 risk drivers", "Hatari 5 kuu")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("Ranked signals to guide the adaptation plan.", "Ili kusaidia mpango wa maboresho.")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {topRisks.map((r, idx) => (
                    <div key={r.key} className="rounded-xl border border-emerald-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-emerald-950">
                          {lang === "en" ? r.title_en : r.title_sw}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            r.severity >= 70 ? "border-red-200 text-red-800" : r.severity >= 40 ? "border-amber-200 text-amber-900" : "border-emerald-200 text-emerald-800"
                          )}
                        >
                          {t("Severity", "Ukali")}: {r.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("Module", "Moduli")}: {r.module}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("Rank", "Nafasi")}: {idx + 1}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(pages.length - 2)}>
                  {t("Back to questions", "Rudi kwenye maswali")}
                </Button>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStep(0)}>
                  {t("Start over", "Anza upya")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </fieldset>
    </div>
  )
}

