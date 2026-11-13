import { UNIVERSITY_DB } from './mockDatabase';
import {
  DbStudentRecord,
  SkillEdgeDto,
  SkillLearningStatus,
  SkillNodeDto,
  SkillNodeType,
  SkillProficiencyLevel,
  SkillRelationType,
  SkillSourceType,
  StudentSkillGraphResponseDto,
  SystemDomainDto,
} from './types';

interface StudentSkillState {
  nodes: SkillNodeDto[];
  edges: SkillEdgeDto[];
  updatedAt: string;
  layoutVersion: number;
}

// In-memory persistent database for student skill graphs
const studentSkillGraphs: Record<string, StudentSkillState> = {};

export const SYSTEM_DOMAINS: SystemDomainDto[] = [
  {
    id: 'domain-tech',
    title: 'فناوری و برنامه‌نویسی',
    slug: 'technology',
    description: 'توسعه نرم‌افزار، هوش مصنوعی، شبکه، پایگاه داده و وب',
    icon: 'code',
    color: '#06b6d4', // cyan-500
    isActive: true,
  },
  {
    id: 'domain-edu',
    title: 'علمی و آموزشی',
    slug: 'education',
    description: 'علوم پایه، دروس تخصصی، ریاضیات، فیزیک و زبان‌های خارجه',
    icon: 'book',
    color: '#6366f1', // indigo-500
    isActive: true,
  },
  {
    id: 'domain-research',
    title: 'پژوهش و نوآوری',
    slug: 'research',
    description: 'مقالات علمی، ثبت اختراع، پروژه‌های دانش‌بنیان و آزمایشگاهی',
    icon: 'lightbulb',
    color: '#10b981', // emerald-500
    isActive: true,
  },
  {
    id: 'domain-sport',
    title: 'ورزش و تندرستی',
    slug: 'sport',
    description: 'رشته‌های ورزشی تیمی و انفرادی، آمادگی جسمانی و مسابقات',
    icon: 'activity',
    color: '#ef4444', // red-500
    isActive: true,
  },
  {
    id: 'domain-culture',
    title: 'فرهنگی و رسانه',
    slug: 'culture',
    description: 'تولید محتوا، نشریات دانشجویی، عکاسی، فیلم و فعالیت‌های عمومی',
    icon: 'palette',
    color: '#f59e0b', // amber-500
    isActive: true,
  },
  {
    id: 'domain-art',
    title: 'هنر و طراحی',
    slug: 'art',
    description: 'طراحی گرافیک، معماری، موسیقی، تدوین و هنرهای تجسمی',
    icon: 'pen',
    color: '#ec4899', // pink-500
    isActive: true,
  },
  {
    id: 'domain-quran',
    title: 'عترت و قرآن',
    slug: 'quran',
    description: 'قرائت، حفظ، مفاهیم قرآنی و فعالیت‌های دینی و معارفی',
    icon: 'bookmark',
    color: '#8b5cf6', // purple-500
    isActive: true,
  },
  {
    id: 'domain-workshop',
    title: 'مهارت‌های فنی و کارگاهی',
    slug: 'workshop',
    description: 'الکترونیک، ساخت و تولید، بردهای سخت‌افزاری و مکاترونیک',
    icon: 'wrench',
    color: '#f97316', // orange-500
    isActive: true,
  },
];

export const SKILL_RELATION_LABELS: Record<SkillRelationType, string> = {
  has_domain: 'اتصال به حوزه',
  has_interest: 'دارای علاقه',
  has_skill: 'دارای مهارت',
  belongs_to: 'زیرمجموعه حوزه',
  related_to: 'مرتبط با',
  has_achievement: 'دارای دستاورد',
  demonstrates: 'اثبات‌کننده مهارت',
  participated_in: 'مشارکت در رویداد',
};

export const PROFICIENCY_LEVEL_MAP: Record<SkillProficiencyLevel, { label: string; numeric: number }> = {
  beginner: { label: 'مقدماتی', numeric: 1 },
  elementary: { label: 'آشنا', numeric: 2 },
  intermediate: { label: 'متوسط', numeric: 3 },
  advanced: { label: 'پیشرفته', numeric: 4 },
  expert: { label: 'متخصص', numeric: 5 },
};

export const NUMERIC_TO_PROFICIENCY: Record<number, SkillProficiencyLevel> = {
  1: 'beginner',
  2: 'elementary',
  3: 'intermediate',
  4: 'advanced',
  5: 'expert',
};

export const LEARNING_STATUS_LABELS: Record<SkillLearningStatus, string> = {
  interested: 'علاقه‌مند',
  learning: 'در حال یادگیری',
  practiced: 'دارای تجربه عملی',
  proficient: 'مسلط (خوداظهاری)',
  archived: 'بایگانی‌شده',
};

export const SKILL_NODE_WIDTH = 220;
export const SKILL_NODE_HEIGHT = 82;
export const MAGNETIC_MIN_DIST_X = SKILL_NODE_WIDTH + 54; // 274px horizontal clearance
export const MAGNETIC_MIN_DIST_Y = SKILL_NODE_HEIGHT + 52; // 134px vertical clearance

/**
 * Magnetic repulsion solver: keeps a comfortable minimum distance between all boxes
 * so they never overlap or crowd each other.
 */
export function resolveMagneticSpacing(
  nodes: SkillNodeDto[],
  pinnedNodeId?: string | null,
  iterations = 10
): SkillNodeDto[] {
  const result = nodes.map((n) => ({
    ...n,
    position: { ...n.position },
  }));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];

        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;

        const nx = dx / MAGNETIC_MIN_DIST_X;
        const ny = dy / MAGNETIC_MIN_DIST_Y;
        const dist = Math.hypot(nx, ny);

        if (dist < 1) {
          const fallbackAngle = ((i * 7 + j * 13) % 12) * ((2 * Math.PI) / 12);
          const ux = dist > 0.001 ? nx / dist : Math.cos(fallbackAngle);
          const uy = dist > 0.001 ? ny / dist : Math.sin(fallbackAngle);

          const pushStrength = (1 - dist) * 0.72;
          const shiftX = ux * pushStrength * MAGNETIC_MIN_DIST_X;
          const shiftY = uy * pushStrength * MAGNETIC_MIN_DIST_Y;

          let weightA = 0.5;
          let weightB = 0.5;

          if (pinnedNodeId && a.id === pinnedNodeId) {
            weightA = 0;
            weightB = 1;
          } else if (pinnedNodeId && b.id === pinnedNodeId) {
            weightA = 1;
            weightB = 0;
          } else if (a.nodeType === 'student') {
            weightA = 0.12;
            weightB = 0.88;
          } else if (b.nodeType === 'student') {
            weightA = 0.88;
            weightB = 0.12;
          }

          a.position.x = Math.round(a.position.x - shiftX * weightA);
          a.position.y = Math.round(a.position.y - shiftY * weightA);
          b.position.x = Math.round(b.position.x + shiftX * weightB);
          b.position.y = Math.round(b.position.y + shiftY * weightB);
        }
      }
    }
  }

  return result;
}

/**
 * Calculates a clean radial cluster layout (Section 8.2):
 * - Student in Center
 * - Domains in Ring 1
 * - Skills & Achievements branched in Ring 2 around their respective domains
 */
export function computeRadialLayout(
  coreStudentId: string,
  domains: SystemDomainDto[],
  skillsData: Array<{ id: string; domainId?: string; isAchievement?: boolean }>
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const CENTER_X = 560;
  const CENTER_Y = 380;
  const RING1_RADIUS = 230;
  const RING2_RADIUS = 430;

  // 1. Center Student Node
  positions[`node-student-${coreStudentId}`] = { x: CENTER_X, y: CENTER_Y };

  // 2. Active Domains in Ring 1
  const domainAngleStep = (2 * Math.PI) / Math.max(domains.length, 1);
  const domainAngles: Record<string, number> = {};

  domains.forEach((d, idx) => {
    const angle = -Math.PI / 2 + idx * domainAngleStep;
    domainAngles[d.id] = angle;
    positions[`node-domain-${d.id}`] = {
      x: Math.round(CENTER_X + RING1_RADIUS * Math.cos(angle) * 1.25),
      y: Math.round(CENTER_Y + RING1_RADIUS * Math.sin(angle) * 0.9),
    };
  });

  // 3. Group skills by domain and place them in Ring 2 around domain angle
  const domainSkillsMap: Record<string, string[]> = {};
  skillsData.forEach((s) => {
    const dId = s.domainId || 'domain-tech';
    if (!domainSkillsMap[dId]) domainSkillsMap[dId] = [];
    domainSkillsMap[dId].push(s.id);
  });

  Object.entries(domainSkillsMap).forEach(([domainId, skillIds]) => {
    const baseAngle = domainAngles[domainId] ?? 0;
    const count = skillIds.length;
    const spread = Math.min(Math.PI * 0.65, 0.42 * count);
    const startAngle = count > 1 ? baseAngle - spread / 2 : baseAngle;
    const step = count > 1 ? spread / (count - 1) : 0;

    skillIds.forEach((sId, sIdx) => {
      const angle = startAngle + sIdx * step;
      positions[sId] = {
        x: Math.round(CENTER_X + RING2_RADIUS * Math.cos(angle) * 1.25),
        y: Math.round(CENTER_Y + RING2_RADIUS * Math.sin(angle) * 0.9),
      };
    });
  });

  return positions;
}

/**
 * Initializes default registration data for a student conforming to SRS Section 1.2 & 6.
 */
function createDefaultRegistrationSkillGraph(student: DbStudentRecord): StudentSkillState {
  const studentNodeId = `node-student-${student.id}`;
  const now = new Date().toISOString();

  // Pick relevant initial domains based on student major
  const isComputerOrTech = student.major.includes('کامپیوتر') || student.major.includes('برق');
  const activeDomains = isComputerOrTech
    ? [
        SYSTEM_DOMAINS[0], // Technology
        SYSTEM_DOMAINS[1], // Education
        SYSTEM_DOMAINS[2], // Research
        SYSTEM_DOMAINS[4], // Culture
      ]
    : [
        SYSTEM_DOMAINS[5], // Art (e.g. Architecture)
        SYSTEM_DOMAINS[1], // Education
        SYSTEM_DOMAINS[4], // Culture
        SYSTEM_DOMAINS[2], // Research
      ];

  const initialSkillsList: Array<{
    id: string;
    title: string;
    domainId: string;
    nodeType: SkillNodeType;
    sourceType: SkillSourceType;
    verificationStatus?: 'unverified' | 'verified';
    proficiencyLevel: SkillProficiencyLevel;
    learningStatus: SkillLearningStatus;
    notes?: string;
  }> = [];

  if (student.id === 'stu-101') {
    // Ali Rezaei - Computer Engineering (SRS Demo Persona)
    initialSkillsList.push(
      {
        id: 'node-skill-react',
        title: 'برنامه‌نویسی React و توسعه فرانت‌اند',
        domainId: 'domain-tech',
        nodeType: 'skill',
        sourceType: 'personal',
        verificationStatus: 'unverified',
        proficiencyLevel: 'advanced',
        learningStatus: 'proficient',
        notes: 'ثبت‌شده در فرم خوداظهاری ورود به دانشگاه',
      },
      {
        id: 'node-skill-typescript',
        title: 'TypeScript و تایپ ایمن در نرم‌افزار',
        domainId: 'domain-tech',
        nodeType: 'skill',
        sourceType: 'personal',
        verificationStatus: 'unverified',
        proficiencyLevel: 'advanced',
        learningStatus: 'practiced',
        notes: 'استفاده در پروژه‌های درسی و دانشگاهی',
      },
      {
        id: 'node-skill-db',
        title: 'پایگاه داده و مدل‌سازی روابط داده‌ای',
        domainId: 'domain-tech',
        nodeType: 'skill',
        sourceType: 'reference', // From academic course
        verificationStatus: 'verified',
        proficiencyLevel: 'intermediate',
        learningStatus: 'practiced',
        notes: 'گذرانده‌شده در درس پایگاه‌داده (نمره الف)',
      },
      {
        id: 'node-fest-kharazmi',
        title: 'جشنواره بین‌المللی خوارزمی (رتبه دوم دانشگاهی)',
        domainId: 'domain-research',
        nodeType: 'achievement',
        sourceType: 'reference',
        verificationStatus: 'verified',
        proficiencyLevel: 'advanced',
        learningStatus: 'practiced',
        notes: 'مقام دوم در محور سیستم‌های توزیع‌شده',
      },
      {
        id: 'node-event-icpc',
        title: 'مسابقات برنامه‌نویسی ACM-ICPC',
        domainId: 'domain-tech',
        nodeType: 'event',
        sourceType: 'reference',
        verificationStatus: 'verified',
        proficiencyLevel: 'advanced',
        learningStatus: 'practiced',
        notes: 'عضو تیم رسمی برنامه‌نویسی دانشگاه',
      }
    );
  } else {
    // Generic student initial skills
    initialSkillsList.push(
      {
        id: `node-skill-${student.id}-1`,
        title: `مفاهیم تخصصی ${student.major}`,
        domainId: activeDomains[0].id,
        nodeType: 'skill',
        sourceType: 'personal',
        verificationStatus: 'unverified',
        proficiencyLevel: 'advanced',
        learningStatus: 'learning',
        notes: 'دروس تخصصی رشته تحصیلی',
      },
      {
        id: `node-skill-${student.id}-2`,
        title: 'مهارت‌های پژوهشی و تحلیل مسئله',
        domainId: 'domain-research',
        nodeType: 'skill',
        sourceType: 'personal',
        verificationStatus: 'unverified',
        proficiencyLevel: 'intermediate',
        learningStatus: 'practiced',
      },
      {
        id: `node-fest-${student.id}-1`,
        title: 'جشنواره دانشگاهی حرکت',
        domainId: 'domain-culture',
        nodeType: 'event',
        sourceType: 'reference',
        verificationStatus: 'verified',
        proficiencyLevel: 'intermediate',
        learningStatus: 'practiced',
      }
    );
  }

  // Calculate layout
  const positions = computeRadialLayout(
    student.id,
    activeDomains,
    initialSkillsList.map((s) => ({ id: s.id, domainId: s.domainId }))
  );

  const nodes: SkillNodeDto[] = [
    // 1. Central Student Node
    {
      id: studentNodeId,
      nodeType: 'student',
      title: student.displayName,
      subtitle: `${student.major} · ورودی ${student.entryYear}`,
      category: 'هویت دانشجو',
      sourceType: 'system',
      verificationStatus: 'verified',
      position: positions[studentNodeId] || { x: 560, y: 380 },
      isCustom: false,
      notes: 'گره مرجع و هویت اصلی دانشجو در University Graph',
      createdAt: now,
    },
    // 2. Domain Nodes
    ...activeDomains.map((d) => ({
      id: `node-domain-${d.id}`,
      nodeType: 'domain' as SkillNodeType,
      title: d.title,
      subtitle: d.description,
      domainId: d.id,
      domainTitle: d.title,
      category: 'حوزه فعالیت دانشگاهی',
      sourceType: 'system' as SkillSourceType,
      verificationStatus: 'verified' as const,
      position: positions[`node-domain-${d.id}`] || { x: 560, y: 160 },
      isCustom: false,
      createdAt: now,
    })),
    // 3. Skill & Achievement Nodes
    ...initialSkillsList.map((s) => ({
      id: s.id,
      nodeType: s.nodeType,
      title: s.title,
      subtitle: s.verificationStatus === 'verified' ? 'تأییدشده در سامانه دانشگاه' : 'خوداظهاری دانشجو',
      domainId: s.domainId,
      domainTitle: SYSTEM_DOMAINS.find((d) => d.id === s.domainId)?.title,
      category: s.nodeType === 'achievement' ? 'دستاورد رسمی' : s.nodeType === 'event' ? 'رویداد/جشنواره' : 'مهارت',
      sourceType: s.sourceType,
      verificationStatus: s.verificationStatus,
      proficiencyLevel: s.proficiencyLevel,
      numericLevel: PROFICIENCY_LEVEL_MAP[s.proficiencyLevel].numeric,
      learningStatus: s.learningStatus,
      position: positions[s.id] || { x: 800, y: 200 },
      notes: s.notes,
      isCustom: false,
      createdAt: now,
    })),
  ];

  const edges: SkillEdgeDto[] = [
    // Student -> Domains
    ...activeDomains.map((d) => ({
      id: `edge-${studentNodeId}-${d.id}`,
      source: studentNodeId,
      target: `node-domain-${d.id}`,
      relationType: 'has_domain' as SkillRelationType,
      label: 'علاقه‌مند / فعال در حوزه',
      sourceType: 'system' as SkillSourceType,
    })),
    // Skills -> Domains
    ...initialSkillsList.map((s) => ({
      id: `edge-${s.id}-${s.domainId}`,
      source: s.id,
      target: `node-domain-${s.domainId}`,
      relationType: 'belongs_to' as SkillRelationType,
      label: s.nodeType === 'achievement' ? 'دستاورد در حوزه' : 'متعلق به حوزه',
      sourceType: s.sourceType,
    })),
  ];

  // Specific cross-edges for Ali Rezaei
  if (student.id === 'stu-101') {
    edges.push(
      {
        id: 'edge-stu-react',
        source: studentNodeId,
        target: 'node-skill-react',
        relationType: 'has_skill',
        label: 'مهارت ثبت‌شده',
        sourceType: 'personal',
      },
      {
        id: 'edge-stu-ts',
        source: studentNodeId,
        target: 'node-skill-typescript',
        relationType: 'has_skill',
        label: 'مهارت ثبت‌شده',
        sourceType: 'personal',
      },
      {
        id: 'edge-stu-kharazmi',
        source: studentNodeId,
        target: 'node-fest-kharazmi',
        relationType: 'has_achievement',
        label: 'دارای دستاورد رسمی',
        sourceType: 'reference',
      },
      {
        id: 'edge-react-ts',
        source: 'node-skill-typescript',
        target: 'node-skill-react',
        relationType: 'related_to',
        label: 'مکمل فنی',
        sourceType: 'personal',
      }
    );
  }

  const spacedNodes = resolveMagneticSpacing(nodes, studentNodeId, 16);

  return {
    nodes: spacedNodes,
    edges,
    updatedAt: now,
    layoutVersion: 1,
  };
}

/**
 * Ensures graph exists for student in memory.
 */
export function getOrCreateStudentSkillGraph(studentId: string): StudentSkillState {
  if (!studentSkillGraphs[studentId]) {
    const student = UNIVERSITY_DB.students.find((s) => s.id === studentId);
    if (!student) {
      throw new Error(`Student ${studentId} not found`);
    }
    studentSkillGraphs[studentId] = createDefaultRegistrationSkillGraph(student);
  }
  return studentSkillGraphs[studentId];
}

/**
 * Returns available system domains.
 */
export function getSystemDomains(): SystemDomainDto[] {
  return SYSTEM_DOMAINS;
}

/**
 * Returns the full student skill graph response DTO conforming to SRS Section 14.1.
 */
export function getStudentSkillGraphDto(studentId: string): StudentSkillGraphResponseDto {
  const student = UNIVERSITY_DB.students.find((s) => s.id === studentId);
  if (!student) {
    throw new Error('دانشجوی موردنظر یافت نشد.');
  }

  const state = getOrCreateStudentSkillGraph(studentId);
  return {
    graphId: `skills-${student.id}`,
    apiVersion: 'v2',
    version: 1,
    module: 'student_skills',
    studentId: student.id,
    studentDisplayName: student.displayName,
    major: student.major,
    faculty: student.faculty,
    entryYear: student.entryYear,
    nodes: state.nodes,
    edges: state.edges,
    meta: {
      generatedAt: state.updatedAt,
      layoutVersion: state.layoutVersion,
    },
    updatedAt: state.updatedAt,
  };
}

/**
 * Adds an authorized system domain to student's profile (Section 14.3).
 */
export function attachDomainToStudent(
  studentId: string,
  domainId: string,
  relationKind = 'interest'
): SkillNodeDto {
  const state = getOrCreateStudentSkillGraph(studentId);
  const domain = SYSTEM_DOMAINS.find((d) => d.id === domainId);
  if (!domain) {
    throw new Error('حوزه مورد نظر یافت نشد.');
  }

  const domainNodeId = `node-domain-${domain.id}`;
  const existingNode = state.nodes.find((n) => n.id === domainNodeId);
  if (existingNode) {
    return existingNode;
  }

  const studentNode = state.nodes.find((n) => n.nodeType === 'student');
  const now = new Date().toISOString();

  // Create domain node
  const newDomainNode: SkillNodeDto = {
    id: domainNodeId,
    nodeType: 'domain',
    title: domain.title,
    subtitle: domain.description,
    domainId: domain.id,
    domainTitle: domain.title,
    category: 'حوزه فعالیت',
    sourceType: 'system',
    verificationStatus: 'verified',
    position: {
      x: 560 + Math.round(240 * Math.cos(state.nodes.length)),
      y: 380 + Math.round(240 * Math.sin(state.nodes.length)),
    },
    isCustom: true,
    createdAt: now,
  };

  state.nodes.push(newDomainNode);
  state.nodes = resolveMagneticSpacing(state.nodes, studentNode?.id, 10);

  if (studentNode) {
    state.edges.push({
      id: `edge-${studentNode.id}-${domainNodeId}-${Date.now()}`,
      source: studentNode.id,
      target: domainNodeId,
      relationType: 'has_domain',
      label: relationKind === 'activity' ? 'فعالیت در حوزه' : 'علاقه‌مندی به حوزه',
      sourceType: 'personal',
    });
  }

  state.updatedAt = now;
  return state.nodes.find((n) => n.id === domainNodeId) || newDomainNode;
}

/**
 * Detaches a domain connection from student's profile (Section 14.4).
 */
export function detachDomainFromStudent(studentId: string, domainId: string): { success: boolean } {
  const state = getOrCreateStudentSkillGraph(studentId);
  const domainNodeId = domainId.startsWith('node-domain-') ? domainId : `node-domain-${domainId}`;

  state.nodes = state.nodes.filter((n) => n.id !== domainNodeId);
  state.edges = state.edges.filter((e) => e.source !== domainNodeId && e.target !== domainNodeId);
  state.updatedAt = new Date().toISOString();
  return { success: true };
}

/**
 * Adds a new personal skill or achievement box (Section 14.5).
 */
export function addSkillNode(
  studentId: string,
  nodeData: {
    title: string;
    nodeType?: SkillNodeType;
    subtitle?: string;
    domainId?: string;
    category?: string;
    proficiencyLevel?: SkillProficiencyLevel;
    numericLevel?: number;
    learningStatus?: SkillLearningStatus;
    position?: { x: number; y: number };
    notes?: string;
  }
): SkillNodeDto {
  const state = getOrCreateStudentSkillGraph(studentId);
  const now = new Date().toISOString();
  const newNodeId = `node-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const nodeType: SkillNodeType = nodeData.nodeType || 'skill';
  const domain = nodeData.domainId ? SYSTEM_DOMAINS.find((d) => d.id === nodeData.domainId) : undefined;

  const proficiencyLevel: SkillProficiencyLevel =
    nodeData.proficiencyLevel ||
    (nodeData.numericLevel ? NUMERIC_TO_PROFICIENCY[nodeData.numericLevel] || 'intermediate' : 'intermediate');

  const numericLevel = nodeData.numericLevel || PROFICIENCY_LEVEL_MAP[proficiencyLevel].numeric;

  const parentDomainNode = domain
    ? state.nodes.find((n) => n.id === `node-domain-${domain.id}`)
    : undefined;
  const anchorPos = parentDomainNode?.position || { x: 560, y: 380 };
  const angle = ((state.nodes.length * 1.35) % (2 * Math.PI));

  const position = nodeData.position || {
    x: Math.round(anchorPos.x + 280 * Math.cos(angle)),
    y: Math.round(anchorPos.y + 180 * Math.sin(angle)),
  };

  const newNode: SkillNodeDto = {
    id: newNodeId,
    nodeType,
    title: nodeData.title.trim(),
    subtitle: nodeData.subtitle?.trim() || (nodeType === 'achievement' ? 'دستاورد شخصی دانشجو' : 'مهارت شخصی خوداظهاری'),
    domainId: domain?.id,
    domainTitle: domain?.title,
    category: nodeData.category?.trim() || domain?.title || 'مهارت شخصی',
    sourceType: 'personal',
    verificationStatus: 'unverified',
    proficiencyLevel,
    numericLevel,
    learningStatus: nodeData.learningStatus || 'learning',
    position,
    notes: nodeData.notes?.trim(),
    isCustom: true,
    createdAt: now,
  };

  state.nodes.push(newNode);

  // Connect to domain if provided
  if (domain) {
    const domainNodeId = `node-domain-${domain.id}`;
    // Ensure domain node is on canvas
    if (!state.nodes.some((n) => n.id === domainNodeId)) {
      attachDomainToStudent(studentId, domain.id);
    }

    state.edges.push({
      id: `edge-${newNode.id}-${domainNodeId}-${Date.now()}`,
      source: newNode.id,
      target: domainNodeId,
      relationType: 'belongs_to',
      label: 'متعلق به حوزه',
      sourceType: 'personal',
    });
  } else {
    // If no domain, connect to student node
    const studentNode = state.nodes.find((n) => n.nodeType === 'student');
    if (studentNode) {
      state.edges.push({
        id: `edge-${studentNode.id}-${newNode.id}-${Date.now()}`,
        source: studentNode.id,
        target: newNode.id,
        relationType: 'has_skill',
        label: 'مهارت ثبت‌شده',
        sourceType: 'personal',
      });
    }
  }

  state.nodes = resolveMagneticSpacing(state.nodes, parentDomainNode?.id || `node-student-${studentId}`, 10);
  state.updatedAt = now;
  return state.nodes.find((n) => n.id === newNodeId) || newNode;
}

/**
 * Updates a personal skill or node (Section 14.6).
 */
export function updateSkillNode(
  studentId: string,
  nodeId: string,
  updates: Partial<SkillNodeDto>
): SkillNodeDto {
  const state = getOrCreateStudentSkillGraph(studentId);
  const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new Error('گره مورد نظر در گراف یافت نشد.');
  }

  const existing = state.nodes[nodeIndex];

  // Prevent students from modifying official university reference nodes
  if (existing.sourceType === 'system' && updates.title && updates.title !== existing.title) {
    throw new Error('ویرایش مشخصات گره‌های رسمی دانشگاه مجاز نیست.');
  }

  const numericLevel =
    updates.numericLevel ||
    (updates.proficiencyLevel ? PROFICIENCY_LEVEL_MAP[updates.proficiencyLevel].numeric : existing.numericLevel);

  const proficiencyLevel =
    updates.proficiencyLevel ||
    (updates.numericLevel ? NUMERIC_TO_PROFICIENCY[updates.numericLevel] : existing.proficiencyLevel);

  const updatedNode: SkillNodeDto = {
    ...existing,
    ...updates,
    id: existing.id,
    sourceType: existing.sourceType,
    numericLevel,
    proficiencyLevel,
    position: updates.position ? { ...updates.position } : existing.position,
  };

  state.nodes[nodeIndex] = updatedNode;
  state.updatedAt = new Date().toISOString();
  return updatedNode;
}

/**
 * Deletes a personal node and all connecting edges (Section 14.7).
 */
export function deleteSkillNode(studentId: string, nodeId: string): { success: boolean } {
  const state = getOrCreateStudentSkillGraph(studentId);
  const targetNode = state.nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    throw new Error('گره مورد نظر یافت نشد.');
  }

  if (targetNode.nodeType === 'student') {
    throw new Error('گره هویت مرکزی دانشجو قابل حذف نیست.');
  }

  state.nodes = state.nodes.filter((n) => n.id !== nodeId);
  state.edges = state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  state.updatedAt = new Date().toISOString();
  return { success: true };
}

/**
 * Creates a free relationship edge between two nodes (Section 14.8).
 */
export function addSkillEdge(
  studentId: string,
  edgeData: {
    source: string;
    target: string;
    relationType?: SkillRelationType;
    label?: string;
  }
): SkillEdgeDto {
  const state = getOrCreateStudentSkillGraph(studentId);

  const sourceNode = state.nodes.find((n) => n.id === edgeData.source);
  const targetNode = state.nodes.find((n) => n.id === edgeData.target);
  if (!sourceNode || !targetNode) {
    throw new Error('یک یا هر دو گره متصل‌شونده یافت نشدند.');
  }

  if (sourceNode.id === targetNode.id) {
    throw new Error('اتصال گره به خودش مجاز نیست.');
  }

  const existingEdge = state.edges.find(
    (e) =>
      (e.source === sourceNode.id && e.target === targetNode.id) ||
      (e.source === targetNode.id && e.target === sourceNode.id)
  );
  if (existingEdge) {
    return existingEdge;
  }

  const relation: SkillRelationType = edgeData.relationType || 'related_to';
  const label = edgeData.label || SKILL_RELATION_LABELS[relation];

  const newEdge: SkillEdgeDto = {
    id: `edge-${sourceNode.id}-${targetNode.id}-${Date.now()}`,
    source: sourceNode.id,
    target: targetNode.id,
    relationType: relation,
    label,
    sourceType: 'personal',
  };

  state.edges.push(newEdge);
  state.updatedAt = new Date().toISOString();
  return newEdge;
}

/**
 * Removes a relationship edge.
 */
export function deleteSkillEdge(studentId: string, edgeId: string): { success: boolean } {
  const state = getOrCreateStudentSkillGraph(studentId);
  state.edges = state.edges.filter((e) => e.id !== edgeId);
  state.updatedAt = new Date().toISOString();
  return { success: true };
}

/**
 * Persists custom layout positions for student's graph (Section 14.9).
 */
export function saveGraphLayout(
  studentId: string,
  positions: Array<{ nodeId: string; x: number; y: number }>
): { success: boolean; layoutVersion: number } {
  const state = getOrCreateStudentSkillGraph(studentId);
  positions.forEach((pos) => {
    const node = state.nodes.find((n) => n.id === pos.nodeId);
    if (node) {
      node.position = { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  });

  state.layoutVersion += 1;
  state.updatedAt = new Date().toISOString();
  return { success: true, layoutVersion: state.layoutVersion };
}

/**
 * Resets student's skill graph to initial university registration state.
 */
export function resetStudentSkillGraph(studentId: string): StudentSkillGraphResponseDto {
  const student = UNIVERSITY_DB.students.find((s) => s.id === studentId);
  if (!student) {
    throw new Error('دانشجو یافت نشد.');
  }
  studentSkillGraphs[studentId] = createDefaultRegistrationSkillGraph(student);
  return getStudentSkillGraphDto(studentId);
}
