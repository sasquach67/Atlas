/**
 * The 20 pre-med pillars (spec Section 9 / 41).
 *
 * This module is the single source of truth for pillar identity: ids, order,
 * display names, muted map-legend accents, Lucide icon names, and the keyword
 * hints the mock extraction provider uses for classification.
 */

export interface Pillar {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Lucide icon name, mapped to a component in the UI layer. */
  icon: string;
  /** Muted accent, hex. Used for node borders, badges, and legend dots. */
  accent: string;
  sortOrder: number;
  /** Lowercase keyword hints for heuristic classification (mock provider). */
  keywords: string[];
}

export const PILLARS: Pillar[] = [
  {
    id: "north-star",
    name: "North Star / Overall Strategy",
    shortName: "North Star",
    description: "What schools evaluate, holistic review, long-term planning.",
    icon: "Compass",
    accent: "#6B6A9F",
    sortOrder: 1,
    keywords: ["holistic", "strategy", "narrative", "competenc", "box-check", "identity", "long-term", "big picture"],
  },
  {
    id: "academics-gpa",
    name: "Academics and GPA",
    shortName: "Academics & GPA",
    description: "Course performance, GPA trends, academic recovery.",
    icon: "GraduationCap",
    accent: "#A8763E",
    sortOrder: 2,
    keywords: ["gpa", "grade", "transcript", "course load", "withdrawal", "pass/fail", "post-bacc", "smp", "academic"],
  },
  {
    id: "prerequisites",
    name: "Prerequisites and Course Planning",
    shortName: "Prerequisites",
    description: "Required coursework and how to plan it.",
    icon: "ListChecks",
    accent: "#8B8552",
    sortOrder: 3,
    keywords: ["prerequisite", "prereq", "biology", "chemistry", "organic", "physics", "biochem", "course plan", "ap credit", "community college"],
  },
  {
    id: "mcat",
    name: "MCAT",
    shortName: "MCAT",
    description: "Content review, practice exams, scheduling, retakes.",
    icon: "Timer",
    accent: "#4E7D96",
    sortOrder: 4,
    keywords: ["mcat", "cars", "full-length", "practice exam", "content review", "anki", "uworld", "aamc", "retake", "study schedule"],
  },
  {
    id: "clinical-experience",
    name: "Clinical Experience",
    shortName: "Clinical",
    description: "Patient-facing experience: what counts and what matters.",
    icon: "Stethoscope",
    accent: "#9C4A34",
    sortOrder: 5,
    keywords: ["clinical", "patient", "emt", "cna", "scribe", "medical assistant", "hospice", "hospital volunteer", "clinical hours"],
  },
  {
    id: "shadowing",
    name: "Shadowing",
    shortName: "Shadowing",
    description: "Observing physicians across specialties.",
    icon: "Eye",
    accent: "#77628C",
    sortOrder: 6,
    keywords: ["shadow", "shadowing", "observe", "physician", "specialty exposure"],
  },
  {
    id: "nonclinical-service",
    name: "Nonclinical Service",
    shortName: "Service",
    description: "Community service and work with underserved populations.",
    icon: "HeartHandshake",
    accent: "#4F8A6B",
    sortOrder: 7,
    keywords: ["volunteer", "service", "community", "underserved", "nonclinical", "food bank", "tutor"],
  },
  {
    id: "research",
    name: "Research",
    shortName: "Research",
    description: "Labs, PIs, posters, publications, intellectual contribution.",
    icon: "FlaskConical",
    accent: "#3E7276",
    sortOrder: 8,
    keywords: ["research", "lab", "pi ", "publication", "poster", "abstract", "principal investigator", "md/phd", "journal"],
  },
  {
    id: "leadership",
    name: "Leadership and Extracurriculars",
    shortName: "Leadership",
    description: "Initiative, organizations, employment, hobbies.",
    icon: "Users",
    accent: "#8F5D3B",
    sortOrder: 9,
    keywords: ["leadership", "club", "organization", "president", "founder", "extracurricular", "hobby", "athletics", "job"],
  },
  {
    id: "letters",
    name: "Letters of Recommendation",
    shortName: "Letters",
    description: "Choosing recommenders, asking well, committee letters.",
    icon: "Mail",
    accent: "#5C7EA3",
    sortOrder: 10,
    keywords: ["letter", "recommendation", "recommender", "committee letter", "lor", "professor relationship"],
  },
  {
    id: "personal-statement",
    name: "Personal Statement and Story Bank",
    shortName: "Personal Statement",
    description: "Why medicine, narrative, reflection, story material.",
    icon: "PenLine",
    accent: "#A3557C",
    sortOrder: 11,
    keywords: ["personal statement", "essay", "why medicine", "story", "narrative", "reflection", "draft"],
  },
  {
    id: "work-activities",
    name: "Work and Activities",
    shortName: "Work & Activities",
    description: "Activity descriptions and most-meaningful entries.",
    icon: "ClipboardList",
    accent: "#6E7F4D",
    sortOrder: 12,
    keywords: ["work and activities", "activity description", "most meaningful", "character limit", "quantify"],
  },
  {
    id: "school-list",
    name: "School List",
    shortName: "School List",
    description: "Mission fit, statistics, geography, MD vs DO.",
    icon: "MapPin",
    accent: "#46698C",
    sortOrder: 13,
    keywords: ["school list", "mission fit", "msar", "reach", "target", "safety", "md vs do", "residency requirement", "in-state"],
  },
  {
    id: "application-systems",
    name: "AMCAS, AACOMAS, and TMDSAS",
    shortName: "Applications",
    description: "Primary application systems, timing, verification.",
    icon: "FileText",
    accent: "#746354",
    sortOrder: 14,
    keywords: ["amcas", "aacomas", "tmdsas", "primary application", "verification", "submit early", "transcript entry"],
  },
  {
    id: "secondaries",
    name: "Secondaries",
    shortName: "Secondaries",
    description: "Prewriting, common prompts, turnaround time.",
    icon: "Files",
    accent: "#AD6A4E",
    sortOrder: 15,
    keywords: ["secondary", "secondaries", "prewrite", "diversity essay", "why us", "turnaround"],
  },
  {
    id: "preview-casper",
    name: "PREview and Casper",
    shortName: "PREview & Casper",
    description: "Situational-judgment tests: prep, timing, scoring.",
    icon: "MessagesSquare",
    accent: "#5E8073",
    sortOrder: 16,
    keywords: ["casper", "preview", "situational judgment", "sjt"],
  },
  {
    id: "interviews",
    name: "Interviews",
    shortName: "Interviews",
    description: "Traditional, MMI, virtual; ethics and communication.",
    icon: "Mic",
    accent: "#7D4E64",
    sortOrder: 17,
    keywords: ["interview", "mmi", "mock interview", "behavioral question", "ethics scenario"],
  },
  {
    id: "financial-planning",
    name: "Financial Planning",
    shortName: "Finance",
    description: "Application costs, debt, loans, physician finance.",
    icon: "Wallet",
    accent: "#57794E",
    sortOrder: 18,
    keywords: ["financial", "finance", "debt", "loan", "pslf", "scholarship", "fee assistance", "budget", "invest", "tuition", "money"],
  },
  {
    id: "gap-years",
    name: "Gap Years and Reinvention",
    shortName: "Gap Years",
    description: "Productive gap years, reapplication, academic repair.",
    icon: "RefreshCw",
    accent: "#8C6D9C",
    sortOrder: 19,
    keywords: ["gap year", "reapply", "reapplication", "reinvention", "nontraditional", "career change"],
  },
  {
    id: "choosing-school",
    name: "Choosing a Medical School",
    shortName: "Choosing a School",
    description: "Comparing acceptances: cost, curriculum, fit.",
    icon: "Scale",
    accent: "#B78A3C",
    sortOrder: 20,
    keywords: ["choosing between", "acceptance", "second look", "plan to enroll", "commit to enroll", "financial aid offer", "match list"],
  },
];

export const PILLAR_IDS = PILLARS.map((p) => p.id);

const byId = new Map(PILLARS.map((p) => [p.id, p]));

export function getPillar(id: string): Pillar {
  const pillar = byId.get(id);
  if (!pillar) throw new Error(`Unknown pillar id: ${id}`);
  return pillar;
}

export function isPillarId(id: string): boolean {
  return byId.has(id);
}

/** Best-effort keyword classification used by the mock extraction provider. */
export function classifyByKeywords(text: string): Pillar | null {
  const lower = text.toLowerCase();
  let best: { pillar: Pillar; hits: number } | null = null;
  for (const pillar of PILLARS) {
    const hits = pillar.keywords.filter((k) => lower.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { pillar, hits };
    }
  }
  return best?.pillar ?? null;
}
