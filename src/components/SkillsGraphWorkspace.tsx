import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Crosshair,
  Download,
  Flame,
  GitCommitHorizontal,
  GraduationCap,
  Info,
  Layers,
  Link2,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  SkillEdgeDto,
  SkillLearningStatus,
  SkillNodeDto,
  SkillNodeType,
  SkillPortSide,
  SkillProficiencyLevel,
  SkillRelationType,
  StudentSkillGraphResponseDto,
} from '../domain/types';
import {
  LEARNING_STATUS_LABELS,
  PROFICIENCY_LEVEL_MAP,
  SKILL_NODE_HEIGHT,
  SKILL_NODE_WIDTH,
  SKILL_RELATION_LABELS,
  SYSTEM_DOMAINS,
  resolveMagneticSpacing,
} from '../domain/skillGraphEngine';
import {
  attachDomainApi,
  createSkillEdgeApi,
  createSkillNodeApi,
  deleteSkillEdgeApi,
  deleteSkillNodeApi,
  detachDomainApi,
  fetchMyStudentSkills,
  fetchSystemDomainsApi,
  resetStudentSkillsApi,
  saveGraphLayoutApi,
  updateSkillEdgeApi,
  updateSkillNodeApi,
} from '../services/api';
import { MAX_ZOOM, MIN_ZOOM } from '../store/useGraphStore';
import { formatZoomPercent, toPersianDigits } from '../utils/persianFormat';

const WORLD_CENTER_X = 560;
const WORLD_CENTER_Y = 410;

type PortSide = SkillPortSide;

const NODE_TYPE_LABELS: Record<SkillNodeType, string> = {
  student: 'دانشجو',
  domain: 'حوزه',
  skill: 'مهارت',
  interest: 'علاقه',
  achievement: 'دستاورد',
  event: 'رویداد',
};

const EDITABLE_NODE_TYPES: Array<{ type: SkillNodeType; label: string }> = [
  { type: 'skill', label: 'مهارت' },
  { type: 'domain', label: 'حوزه' },
  { type: 'achievement', label: 'دستاورد' },
  { type: 'event', label: 'رویداد' },
];

// Exact SeeNodes v1 palette mapping for v2 node types
function getSkillNodeTheme(nodeType: SkillNodeType) {
  switch (nodeType) {
    case 'student':
      return {
        accent: '#f59e0b',
        border: '#f59e0b',
        handle: '#f59e0b',
        tagBg: 'rgba(245, 158, 11, 0.15)',
        tagText: '#fbbf24',
      };
    case 'domain':
      return {
        accent: '#589bf6',
        border: '#589bf6',
        handle: '#589bf6',
        tagBg: 'rgba(88, 155, 246, 0.15)',
        tagText: '#60a5fa',
      };
    case 'achievement':
      return {
        accent: '#10b981',
        border: '#10b981',
        handle: '#10b981',
        tagBg: 'rgba(16, 185, 129, 0.15)',
        tagText: '#6ee7b7',
      };
    case 'event':
      return {
        accent: '#8b5cf6',
        border: '#8b5cf6',
        handle: '#8b5cf6',
        tagBg: 'rgba(139, 92, 246, 0.15)',
        tagText: '#c4b5fd',
      };
    case 'interest':
      return {
        accent: '#3b82f6',
        border: '#3b82f6',
        handle: '#3b82f6',
        tagBg: 'rgba(59, 130, 246, 0.15)',
        tagText: '#93c5fd',
      };
    case 'skill':
    default:
      return {
        accent: '#7f77dd',
        border: '#7f77dd',
        handle: '#7f77dd',
        tagBg: 'rgba(127, 119, 221, 0.15)',
        tagText: '#a78bfa',
      };
  }
}

function renderSkillNodeIcon(nodeType: SkillNodeType) {
  switch (nodeType) {
    case 'student':
      return <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'domain':
      return <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'achievement':
      return <Award className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'event':
      return <Calendar className="w-4 h-4 text-violet-400 shrink-0" />;
    case 'skill':
    default:
      return <Flame className="w-4 h-4 text-[#a78bfa] shrink-0" />;
  }
}

function getNodePorts(pos: { x: number; y: number }): Record<PortSide, { x: number; y: number }> {
  return {
    top: { x: pos.x, y: pos.y },
    bottom: { x: pos.x, y: pos.y + SKILL_NODE_HEIGHT },
    left: { x: pos.x - SKILL_NODE_WIDTH / 2, y: pos.y + SKILL_NODE_HEIGHT / 2 },
    right: { x: pos.x + SKILL_NODE_WIDTH / 2, y: pos.y + SKILL_NODE_HEIGHT / 2 },
  };
}

function getClosestPort(pos: { x: number; y: number }, point: { x: number; y: number }) {
  const ports = getNodePorts(pos);
  let bestSide: PortSide = 'top';
  let bestDist = Infinity;
  (Object.keys(ports) as PortSide[]).forEach((side) => {
    const d = Math.hypot(ports[side].x - point.x, ports[side].y - point.y);
    if (d < bestDist) {
      bestDist = d;
      bestSide = side;
    }
  });
  return { side: bestSide, point: ports[bestSide] };
}

function getDirectionalControlPoints(
  start: { x: number; y: number },
  startSide: PortSide,
  end: { x: number; y: number },
  endSide?: PortSide
) {
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const offset = Math.max(36, Math.min(120, dist * 0.45));

  const dirVec = (side: PortSide) => {
    switch (side) {
      case 'top':
        return { dx: 0, dy: -offset };
      case 'bottom':
        return { dx: 0, dy: offset };
      case 'left':
        return { dx: -offset, dy: 0 };
      case 'right':
        return { dx: offset, dy: 0 };
    }
  };

  const v1 = dirVec(startSide);
  const inferredEndSide: PortSide =
    endSide ||
    (Math.abs(end.y - start.y) >= Math.abs(end.x - start.x)
      ? end.y >= start.y
        ? 'top'
        : 'bottom'
      : end.x >= start.x
        ? 'left'
        : 'right');
  const v2 = dirVec(inferredEndSide);

  return {
    cx1: start.x + v1.dx,
    cy1: start.y + v1.dy,
    cx2: end.x + v2.dx,
    cy2: end.y + v2.dy,
  };
}

function buildDirectionalBezier(
  start: { x: number; y: number },
  startSide: PortSide,
  end: { x: number; y: number },
  endSide?: PortSide
) {
  const { cx1, cy1, cx2, cy2 } = getDirectionalControlPoints(start, startSide, end, endSide);
  return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
}

// Compute optimal circular port coordinates (Top, Bottom, Left, Right) between two boxes
function getOptimalEdgeCurve(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
) {
  const sCenterX = sourcePos.x;
  const sCenterY = sourcePos.y + SKILL_NODE_HEIGHT / 2;
  const tCenterX = targetPos.x;
  const tCenterY = targetPos.y + SKILL_NODE_HEIGHT / 2;

  const dx = tCenterX - sCenterX;
  const dy = tCenterY - sCenterY;

  let x1: number, y1: number, x2: number, y2: number;
  let cx1: number, cy1: number, cx2: number, cy2: number;

  if (Math.abs(dy) >= Math.abs(dx) * 0.55) {
    if (dy >= 0) {
      x1 = sourcePos.x;
      y1 = sourcePos.y + SKILL_NODE_HEIGHT;
      x2 = targetPos.x;
      y2 = targetPos.y;
      const offset = Math.max(36, Math.min(110, Math.abs(y2 - y1) * 0.5));
      cx1 = x1;
      cy1 = y1 + offset;
      cx2 = x2;
      cy2 = y2 - offset;
    } else {
      x1 = sourcePos.x;
      y1 = sourcePos.y;
      x2 = targetPos.x;
      y2 = targetPos.y + SKILL_NODE_HEIGHT;
      const offset = Math.max(36, Math.min(110, Math.abs(y2 - y1) * 0.5));
      cx1 = x1;
      cy1 = y1 - offset;
      cx2 = x2;
      cy2 = y2 + offset;
    }
  } else {
    if (dx >= 0) {
      x1 = sourcePos.x + SKILL_NODE_WIDTH / 2;
      y1 = sCenterY;
      x2 = targetPos.x - SKILL_NODE_WIDTH / 2;
      y2 = tCenterY;
      const offset = Math.max(36, Math.min(110, Math.abs(x2 - x1) * 0.5));
      cx1 = x1 + offset;
      cy1 = y1;
      cx2 = x2 - offset;
      cy2 = y2;
    } else {
      x1 = sourcePos.x - SKILL_NODE_WIDTH / 2;
      y1 = sCenterY;
      x2 = targetPos.x + SKILL_NODE_WIDTH / 2;
      y2 = tCenterY;
      const offset = Math.max(36, Math.min(110, Math.abs(x2 - x1) * 0.5));
      cx1 = x1 - offset;
      cy1 = y1;
      cx2 = x2 + offset;
      cy2 = y2;
    }
  }

  const edgePath = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return { edgePath, x1, y1, x2, y2, midX, midY };
}

// Respect persisted sourceHandle / targetHandle so connected lines stay anchored when boxes move
function getEdgeCurveForEdge(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  edge?: Pick<SkillEdgeDto, 'sourceHandle' | 'targetHandle'>
) {
  if (!edge?.sourceHandle && !edge?.targetHandle) {
    return getOptimalEdgeCurve(sourcePos, targetPos);
  }

  const sPorts = getNodePorts(sourcePos);
  const tPorts = getNodePorts(targetPos);

  const sSide: PortSide =
    edge.sourceHandle ||
    getClosestPort(sourcePos, {
      x: targetPos.x,
      y: targetPos.y + SKILL_NODE_HEIGHT / 2,
    }).side;
  const p1 = sPorts[sSide];

  const tSide: PortSide = edge.targetHandle || getClosestPort(targetPos, p1).side;
  const p2 = tPorts[tSide];

  const { cx1, cy1, cx2, cy2 } = getDirectionalControlPoints(p1, sSide, p2, tSide);
  const edgePath = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;
  const midX = 0.125 * p1.x + 0.375 * cx1 + 0.375 * cx2 + 0.125 * p2.x;
  const midY = 0.125 * p1.y + 0.375 * cy1 + 0.375 * cy2 + 0.125 * p2.y;

  return { edgePath, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, midX, midY };
}

interface SkillsGraphWorkspaceProps {
  sessionToken: string;
}

export const SkillsGraphWorkspace: React.FC<SkillsGraphWorkspaceProps> = ({ sessionToken }) => {
  const queryClient = useQueryClient();

  // Camera state (Exact v1 defaults)
  const [zoom, setZoom] = useState(0.78);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Selection & Contextual Popover state
  const [selection, setSelection] = useState<
    { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null
  >(null);
  const [isBoxPopoverOpen, setIsBoxPopoverOpen] = useState(false);
  const [isEdgePopoverOpen, setIsEdgePopoverOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [isDomainPickerOpen, setIsDomainPickerOpen] = useState(false);

  // Quick-Create Card state (Opened via Double-Click on empty background OR toolbar button)
  const [quickCreateAnchor, setQuickCreateAnchor] = useState<{
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
  } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newNodeType, setNewNodeType] = useState<SkillNodeType>('skill');
  const [newNotes, setNewNotes] = useState('');
  const [newDomainId, setNewDomainId] = useState('none');
  const [newProficiency, setNewProficiency] = useState<SkillProficiencyLevel>('intermediate');

  // Dragging & Magnetic Repulsion state
  const [activeDraggingNodeId, setActiveDraggingNodeId] = useState<string | null>(null);

  // SeeNodes 4-Port Connection Drawing state
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    side: PortSide;
    startX: number;
    startY: number;
  } | null>(null);
  const [connectingCursor, setConnectingCursor] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTargetNodeId, setHoveredTargetNodeId] = useState<string | null>(null);
  const [hoveredTargetPort, setHoveredTargetPort] = useState<PortSide | null>(null);
  const [isLinkMode, setIsLinkMode] = useState(false);

  // Inline Delete Confirmation (Zero window.confirm popups!)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Search & Filter state (Compact top-left strip)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Toast notice (subtle top-center bar)
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2600);
  };

  // Edit Node Form state inside Box-Adjacent Popover
  const [editTitle, setEditTitle] = useState('');
  const [editNodeType, setEditNodeType] = useState<SkillNodeType>('skill');
  const [editProficiency, setEditProficiency] = useState<SkillProficiencyLevel>('intermediate');
  const [editLearningStatus, setEditLearningStatus] = useState<SkillLearningStatus>('learning');
  const [editNotes, setEditNotes] = useState('');

  // Edit Edge Form state inside Edge Popover
  const [editEdgeLabel, setEditEdgeLabel] = useState('');
  const [editEdgeRelation, setEditEdgeRelation] = useState<SkillRelationType>('related_to');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth || 1200,
          height: containerRef.current.clientHeight || 800,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Cancel active wiring or close popovers on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setConnectingCursor(null);
        setHoveredTargetNodeId(null);
        setHoveredTargetPort(null);
        setIsLinkMode(false);
        setQuickCreateAnchor(null);
        setIsBoxPopoverOpen(false);
        setIsEdgePopoverOpen(false);
        setIsDomainPickerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Queries
  const skillsQuery = useQuery({
    queryKey: ['student-skills-graph', sessionToken],
    queryFn: () => fetchMyStudentSkills(sessionToken),
  });

  const domainsQuery = useQuery({
    queryKey: ['system-domains'],
    queryFn: () => fetchSystemDomainsApi(),
  });

  const graph = skillsQuery.data;
  const availableDomains = domainsQuery.data || SYSTEM_DOMAINS;

  // Mutations
  const createSkillMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      nodeType: SkillNodeType;
      domainId?: string;
      proficiencyLevel?: SkillProficiencyLevel;
      learningStatus?: SkillLearningStatus;
      position?: { x: number; y: number };
      notes?: string;
      autoConnect?: boolean;
    }) => createSkillNodeApi(sessionToken, payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['student-skills-graph', sessionToken] });
      setQuickCreateAnchor(null);
      setNewTitle('');
      setNewNotes('');
      setNewDomainId('none');
      setSelection({ kind: 'node', id: created.id });
      setIsBoxPopoverOpen(false);
      showNotice('باکس جدید ساخته شد — نقاط دور باکس را برای اتصال کلیک کنید');
    },
  });

  const attachDomainMutation = useMutation({
    mutationFn: (domainId: string) => attachDomainApi(sessionToken, domainId, 'interest'),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['student-skills-graph', sessionToken] });
      setSelection({ kind: 'node', id: created.id });
      showNotice('حوزه فعالیت به نقشه متصل شد');
    },
  });

  const detachDomainMutation = useMutation({
    mutationFn: (domainId: string) => detachDomainApi(sessionToken, domainId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-skills-graph', sessionToken] });
      setSelection(null);
      setIsBoxPopoverOpen(false);
      setConfirmDeleteId(null);
      showNotice('حوزه از نقشه جدا شد');
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: ({ nodeId, updates }: { nodeId: string; updates: Partial<SkillNodeDto> }) =>
      updateSkillNodeApi(sessionToken, nodeId, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData<StudentSkillGraphResponseDto>(
        ['student-skills-graph', sessionToken],
        (old) =>
          old
            ? { ...old, nodes: old.nodes.map((n) => (n.id === updated.id ? updated : n)) }
            : old
      );
      setIsBoxPopoverOpen(false);
      showNotice('مشخصات باکس ذخیره شد');
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: string) => deleteSkillNodeApi(sessionToken, nodeId),
    onSuccess: (_res, nodeId) => {
      queryClient.setQueryData<StudentSkillGraphResponseDto>(
        ['student-skills-graph', sessionToken],
        (old) =>
          old
            ? {
                ...old,
                nodes: old.nodes.filter((n) => n.id !== nodeId),
                edges: old.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
              }
            : old
      );
      setSelection(null);
      setIsBoxPopoverOpen(false);
      setConfirmDeleteId(null);
      showNotice('باکس حذف شد');
    },
  });

  const createEdgeMutation = useMutation({
    mutationFn: (payload: {
      source: string;
      target: string;
      relationType?: SkillRelationType;
      label?: string;
      sourceHandle?: PortSide;
      targetHandle?: PortSide;
    }) => createSkillEdgeApi(sessionToken, payload),
    onSuccess: (edge) => {
      queryClient.setQueryData<StudentSkillGraphResponseDto>(
        ['student-skills-graph', sessionToken],
        (old) => {
          if (!old) return old;
          const exists = old.edges.some((e) => e.id === edge.id);
          return exists
            ? { ...old, edges: old.edges.map((e) => (e.id === edge.id ? edge : e)) }
            : { ...old, edges: [...old.edges, edge] };
        }
      );
      setConnectingFrom(null);
      setConnectingCursor(null);
      setHoveredTargetNodeId(null);
      setHoveredTargetPort(null);
      setIsLinkMode(false);
      setSelection({ kind: 'edge', id: edge.id });
      setIsEdgePopoverOpen(false);
      showNotice('اتصال برقرار شد · برای ویرایش عنوان روی خط کلیک کنید');
    },
  });

  const updateEdgeMutation = useMutation({
    mutationFn: ({
      edgeId,
      updates,
    }: {
      edgeId: string;
      updates: {
        label?: string;
        relationType?: SkillRelationType;
        sourceHandle?: PortSide;
        targetHandle?: PortSide;
      };
    }) => updateSkillEdgeApi(sessionToken, edgeId, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData<StudentSkillGraphResponseDto>(
        ['student-skills-graph', sessionToken],
        (old) =>
          old
            ? { ...old, edges: old.edges.map((e) => (e.id === updated.id ? updated : e)) }
            : old
      );
      setIsEdgePopoverOpen(false);
      showNotice('برچسب ارتباط ذخیره شد');
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: (edgeId: string) => deleteSkillEdgeApi(sessionToken, edgeId),
    onSuccess: (_res, edgeId) => {
      queryClient.setQueryData<StudentSkillGraphResponseDto>(
        ['student-skills-graph', sessionToken],
        (old) =>
          old ? { ...old, edges: old.edges.filter((e) => e.id !== edgeId) } : old
      );
      setSelection(null);
      setIsEdgePopoverOpen(false);
      setConfirmDeleteId(null);
      showNotice('خط ارتباطی حذف شد');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetStudentSkillsApi(sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-skills-graph', sessionToken] });
      setSelection(null);
      setIsBoxPopoverOpen(false);
      setIsEdgePopoverOpen(false);
      setQuickCreateAnchor(null);
      setZoom(0.78);
      setPanX(0);
      setPanY(0);
      showNotice('چیدمان اولیه بازنشانی شد');
    },
  });

  const nodeById = useMemo(() => {
    const map = new Map<string, SkillNodeDto>();
    graph?.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graph?.nodes]);

  const selectedNode: SkillNodeDto | undefined =
    selection?.kind === 'node' ? nodeById.get(selection.id) : undefined;
  const selectedEdge: SkillEdgeDto | undefined =
    selection?.kind === 'edge' ? graph?.edges.find((e) => e.id === selection.id) : undefined;

  useEffect(() => {
    setConfirmDeleteId(null);
    if (selectedNode) {
      setEditTitle(selectedNode.title);
      setEditNodeType(selectedNode.nodeType);
      setEditProficiency(selectedNode.proficiencyLevel || 'intermediate');
      setEditLearningStatus(selectedNode.learningStatus || 'learning');
      setEditNotes(selectedNode.notes || '');
    }
  }, [selectedNode?.id]);

  useEffect(() => {
    setConfirmDeleteId(null);
    if (selectedEdge) {
      setEditEdgeLabel(selectedEdge.label);
      setEditEdgeRelation(selectedEdge.relationType);
    }
  }, [selectedEdge?.id]);

  // Filtered nodes
  const matchingNodeIds = useMemo(() => {
    if (!graph?.nodes) return new Set<string>();
    const hasSearch = searchQuery.trim().length > 0;
    const hasTypeFilter = filterType !== 'all';
    if (!hasSearch && !hasTypeFilter) {
      return new Set(graph.nodes.map((n) => n.id));
    }
    const q = searchQuery.trim().toLowerCase();
    return new Set(
      graph.nodes
        .filter((node) => {
          const matchesType =
            !hasTypeFilter || node.nodeType === filterType || node.nodeType === 'student';
          const matchesQuery =
            !hasSearch ||
            node.title.toLowerCase().includes(q) ||
            (node.notes && node.notes.toLowerCase().includes(q)) ||
            (node.domainTitle && node.domainTitle.toLowerCase().includes(q)) ||
            (node.category && node.category.toLowerCase().includes(q));
          return matchesType && matchesQuery;
        })
        .map((n) => n.id)
    );
  }, [graph?.nodes, searchQuery, filterType]);

  // Viewport transforms (identical to v1 GraphCanvasWorkspace)
  const viewportX = containerSize.width / 2 + panX;
  const viewportY = containerSize.height / 2 + panY;

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const localX = clientX - (rect?.left ?? 0);
    const localY = clientY - (rect?.top ?? 0);
    return {
      x: (localX - viewportX) / zoom + WORLD_CENTER_X,
      y: (localY - viewportY) / zoom + WORLD_CENTER_Y,
    };
  };

  const worldToScreen = (worldX: number, worldY: number) => ({
    x: (worldX - WORLD_CENTER_X) * zoom + viewportX,
    y: (worldY - WORLD_CENTER_Y) * zoom + viewportY,
  });

  // Pure-math world hit-testing (zero DOM layout reflow during mousemove!)
  const findNodeAtWorldPoint = (
    worldPt: { x: number; y: number },
    excludeNodeId?: string
  ): string | null => {
    if (!graph?.nodes) return null;
    const PAD = 18;
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const n = graph.nodes[i];
      if (n.id === excludeNodeId) continue;
      const halfW = SKILL_NODE_WIDTH / 2 + PAD;
      if (
        worldPt.x >= n.position.x - halfW &&
        worldPt.x <= n.position.x + halfW &&
        worldPt.y >= n.position.y - PAD &&
        worldPt.y <= n.position.y + SKILL_NODE_HEIGHT + PAD
      ) {
        return n.id;
      }
    }
    return null;
  };

  // Compute clamped screen coordinates for the box-adjacent popover
  const boxPopoverCoords = useMemo(() => {
    if (!isBoxPopoverOpen || !selectedNode) return null;
    const POPOVER_W = 288;
    const POPOVER_H = selectedNode.sourceType === 'system' ? 230 : 350;
    const topLeft = worldToScreen(
      selectedNode.position.x - SKILL_NODE_WIDTH / 2,
      selectedNode.position.y
    );
    const rightEdge = topLeft.x + SKILL_NODE_WIDTH * zoom;

    const preferRight = rightEdge + 14 + POPOVER_W <= containerSize.width - 12;
    const rawLeft = preferRight ? rightEdge + 14 : topLeft.x - POPOVER_W - 14;
    const left = Math.max(12, Math.min(containerSize.width - POPOVER_W - 12, Math.round(rawLeft)));
    const top = Math.max(64, Math.min(containerSize.height - POPOVER_H - 64, Math.round(topLeft.y - 8)));

    return { left, top };
  }, [isBoxPopoverOpen, selectedNode, zoom, panX, panY, containerSize]);

  // Compute clamped screen coordinates for the edge-midpoint popover
  const edgePopoverCoords = useMemo(() => {
    if (!isEdgePopoverOpen || !selectedEdge || !graph) return null;
    const s = nodeById.get(selectedEdge.source);
    const t = nodeById.get(selectedEdge.target);
    if (!s || !t) return null;
    const { midX, midY } = getEdgeCurveForEdge(s.position, t.position, selectedEdge);
    const screenMid = worldToScreen(midX, midY);
    const POPOVER_W = 264;
    const POPOVER_H = 210;
    const left = Math.max(
      12,
      Math.min(containerSize.width - POPOVER_W - 12, Math.round(screenMid.x - POPOVER_W / 2))
    );
    const top = Math.max(
      64,
      Math.min(containerSize.height - POPOVER_H - 64, Math.round(screenMid.y + 14))
    );
    return { left, top };
  }, [isEdgePopoverOpen, selectedEdge, graph, nodeById, zoom, panX, panY, containerSize]);

  // Smart default relation when connecting two boxes
  const inferSmartRelation = (
    sourceId: string,
    targetId: string
  ): { relationType: SkillRelationType; label: string } => {
    const s = graph?.nodes.find((n) => n.id === sourceId);
    const t = graph?.nodes.find((n) => n.id === targetId);
    if (s?.nodeType === 'student' && t?.nodeType === 'domain') {
      return { relationType: 'has_domain', label: 'علاقه‌مند به حوزه' };
    }
    if (s?.nodeType === 'student' && t?.nodeType === 'skill') {
      return { relationType: 'has_skill', label: 'مهارت ثبت‌شده' };
    }
    if (s?.nodeType === 'student' && t?.nodeType === 'achievement') {
      return { relationType: 'has_achievement', label: 'دارای دستاورد' };
    }
    if (s?.nodeType === 'skill' && t?.nodeType === 'domain') {
      return { relationType: 'belongs_to', label: 'متعلق به حوزه' };
    }
    if (s?.nodeType === 'domain' && t?.nodeType === 'skill') {
      return { relationType: 'belongs_to', label: 'شامل مهارت' };
    }
    if (s?.nodeType === 'achievement' && t?.nodeType === 'skill') {
      return { relationType: 'demonstrates', label: 'اثبات‌کننده مهارت' };
    }
    if (s?.nodeType === 'event' || t?.nodeType === 'event') {
      return { relationType: 'participated_in', label: 'مرتبط با رویداد' };
    }
    return { relationType: 'related_to', label: 'ارتباط مهارتی' };
  };

  const completeConnection = (targetNodeId: string, explicitTargetSide?: PortSide) => {
    if (!connectingFrom) return;
    const sourceId = connectingFrom.nodeId;
    const sourceHandle = connectingFrom.side;
    const targetNode = nodeById.get(targetNodeId);
    const targetHandle =
      explicitTargetSide ||
      hoveredTargetPort ||
      (targetNode && connectingCursor
        ? getClosestPort(targetNode.position, connectingCursor).side
        : undefined);

    setConnectingFrom(null);
    setConnectingCursor(null);
    setHoveredTargetNodeId(null);
    setHoveredTargetPort(null);
    setIsLinkMode(false);

    if (sourceId === targetNodeId) {
      return;
    }

    const { relationType, label } = inferSmartRelation(sourceId, targetNodeId);
    createEdgeMutation.mutate({
      source: sourceId,
      target: targetNodeId,
      relationType,
      label,
      sourceHandle,
      targetHandle,
    });
  };

  // Start or finish SeeNodes interactive wiring from any of the 4 port dots
  const handlePortMouseDown = (
    e: React.MouseEvent,
    node: SkillNodeDto,
    side: PortSide,
    portPos: { x: number; y: number }
  ) => {
    e.stopPropagation();
    e.preventDefault();

    // If user already started a wire from another box, clicking any port on target completes the edge on that exact port!
    if (connectingFrom && connectingFrom.nodeId !== node.id) {
      completeConnection(node.id, side);
      return;
    }

    // If user clicks a port on the same source box again, switch starting port or toggle off
    if (connectingFrom && connectingFrom.nodeId === node.id) {
      if (connectingFrom.side === side) {
        setConnectingFrom(null);
        setConnectingCursor(null);
        setHoveredTargetNodeId(null);
        setHoveredTargetPort(null);
        return;
      }
      setConnectingFrom({ nodeId: node.id, side, startX: portPos.x, startY: portPos.y });
      setConnectingCursor(portPos);
      return;
    }

    // Begin live wire from clicked port
    setIsBoxPopoverOpen(false);
    setIsEdgePopoverOpen(false);
    setQuickCreateAnchor(null);
    setIsDomainPickerOpen(false);
    setHoveredTargetPort(null);
    setConnectingFrom({ nodeId: node.id, side, startX: portPos.x, startY: portPos.y });
    setConnectingCursor(portPos);

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const onMouseMove = (moveEv: MouseEvent) => {
      const worldPt = clientToWorld(moveEv.clientX, moveEv.clientY);
      setConnectingCursor(worldPt);
      const portEl = (moveEv.target as HTMLElement | null)?.closest('[data-port-node-id]') as HTMLElement | null;
      const portNodeId = portEl?.dataset.portNodeId;
      const portSideAttr = portEl?.dataset.portSide as PortSide | undefined;
      if (portNodeId && portNodeId !== node.id && portSideAttr) {
        setHoveredTargetNodeId(portNodeId);
        setHoveredTargetPort(portSideAttr);
      } else {
        setHoveredTargetPort(null);
        setHoveredTargetNodeId(findNodeAtWorldPoint(worldPt, node.id));
      }
    };

    const onMouseUp = (upEv: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const dragDistance = Math.hypot(upEv.clientX - startClientX, upEv.clientY - startClientY);
      const worldPt = clientToWorld(upEv.clientX, upEv.clientY);
      const portEl = (upEv.target as HTMLElement | null)?.closest('[data-port-node-id]') as HTMLElement | null;
      const portNodeId = portEl?.dataset.portNodeId;
      const portSideAttr = portEl?.dataset.portSide as PortSide | undefined;
      const targetId =
        portNodeId && portNodeId !== node.id
          ? portNodeId
          : findNodeAtWorldPoint(worldPt, node.id);

      if (dragDistance > 8 && targetId) {
        // Drag-and-drop directly from source port to target box/port!
        const targetNode = nodeById.get(targetId);
        const targetHandle: PortSide | undefined =
          portNodeId === targetId && portSideAttr
            ? portSideAttr
            : targetNode
              ? getClosestPort(targetNode.position, worldPt).side
              : undefined;

        setConnectingFrom(null);
        setConnectingCursor(null);
        setHoveredTargetNodeId(null);
        setHoveredTargetPort(null);
        setIsLinkMode(false);
        const { relationType, label } = inferSmartRelation(node.id, targetId);
        createEdgeMutation.mutate({
          source: node.id,
          target: targetId,
          relationType,
          label,
          sourceHandle: side,
          targetHandle,
        });
      }
      // If dragDistance <= 8 (user clicked the dot), keep connectingFrom active so moving cursor draws the line and clicking target connects!
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Smooth Node Drag Handler WITH Real-Time Magnetic Repulsion (Anti-Overlap)
  const handleNodeStartDrag = (
    node: SkillNodeDto,
    clientX: number,
    clientY: number,
    isTouch = false
  ) => {
    // If user is currently drawing a line from a port, clicking this box completes the connection!
    if (connectingFrom) {
      const clickWorld = clientToWorld(clientX, clientY);
      const targetSide = getClosestPort(node.position, clickWorld).side;
      completeConnection(node.id, targetSide);
      return;
    }
    if (isLinkMode) {
      const clickWorld = clientToWorld(clientX, clientY);
      const closestSource = getClosestPort(node.position, clickWorld);
      setConnectingFrom({
        nodeId: node.id,
        side: closestSource.side,
        startX: closestSource.point.x,
        startY: closestSource.point.y,
      });
      setConnectingCursor(closestSource.point);
      showNotice('حالا روی باکس یا نقطه مقصد کلیک کنید');
      return;
    }

    setActiveDraggingNodeId(node.id);
    setQuickCreateAnchor(null);
    setIsDomainPickerOpen(false);
    setIsEdgePopoverOpen(false);

    const startX = clientX;
    const startY = clientY;
    const initialNodeX = node.position.x;
    const initialNodeY = node.position.y;
    let hasMoved = false;
    let latestNodes: SkillNodeDto[] | null = null;

    const onMove = (moveX: number, moveY: number) => {
      const dx = (moveX - startX) / zoom;
      const dy = (moveY - startY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3 || hasMoved) {
        hasMoved = true;
        setIsBoxPopoverOpen(false);
        const targetX = Math.round(initialNodeX + dx);
        const targetY = Math.round(initialNodeY + dy);

        queryClient.setQueryData<StudentSkillGraphResponseDto>(
          ['student-skills-graph', sessionToken],
          (old) => {
            if (!old) return old;
            const moved = old.nodes.map((n) =>
              n.id === node.id ? { ...n, position: { x: targetX, y: targetY } } : n
            );
            const magneticallySpaced = resolveMagneticSpacing(moved, node.id, 6);
            latestNodes = magneticallySpaced;
            return {
              ...old,
              nodes: magneticallySpaced,
            };
          }
        );
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      onMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const cleanup = () => {
      setActiveDraggingNodeId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };

    const finishInteraction = () => {
      cleanup();
      if (hasMoved && latestNodes) {
        void saveGraphLayoutApi(
          sessionToken,
          latestNodes.map((n) => ({
            nodeId: n.id,
            x: n.position.x,
            y: n.position.y,
          }))
        );
      } else if (!hasMoved) {
        // Single click opens compact edit popover right next to the clicked box!
        setSelection({ kind: 'node', id: node.id });
        setIsBoxPopoverOpen(true);
      }
    };

    const onMouseUp = () => finishInteraction();
    const onTouchEnd = () => finishInteraction();

    if (isTouch) {
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    } else {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  // Double-Click on Empty Canvas Background -> Open Quick-Create Card Right at Click Location
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.seenodes-node, .seenodes-port, .seenodes-edge-btn, .seenodes-popover, button, a, input, select, textarea, [role="button"]'
      )
    ) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const localX = e.clientX - (rect?.left ?? 0);
    const localY = e.clientY - (rect?.top ?? 0);
    const worldPt = clientToWorld(e.clientX, e.clientY);

    const CARD_W = 288;
    const CARD_H = 310;
    const clampedScreenX = Math.max(
      12,
      Math.min(containerSize.width - CARD_W - 12, Math.round(localX - CARD_W / 2))
    );
    const clampedScreenY = Math.max(
      64,
      Math.min(containerSize.height - CARD_H - 64, Math.round(localY - 24))
    );

    setConnectingFrom(null);
    setConnectingCursor(null);
    setHoveredTargetNodeId(null);
    setIsLinkMode(false);
    setSelection(null);
    setIsBoxPopoverOpen(false);
    setIsEdgePopoverOpen(false);
    setIsDomainPickerOpen(false);

    setNewTitle('');
    setNewNotes('');
    setNewNodeType('skill');
    setNewDomainId('none');
    setNewProficiency('intermediate');
    setQuickCreateAnchor({
      screenX: clampedScreenX,
      screenY: clampedScreenY,
      worldX: Math.round(worldPt.x),
      worldY: Math.round(worldPt.y - SKILL_NODE_HEIGHT / 2),
    });
  };

  // Open Quick-Create Card from Toolbar Button (Centered)
  const openToolbarQuickCreate = () => {
    if (quickCreateAnchor) {
      setQuickCreateAnchor(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const centerClientX = (rect?.left ?? 0) + containerSize.width / 2;
    const centerClientY = (rect?.top ?? 0) + containerSize.height / 2;
    const worldPt = clientToWorld(centerClientX, centerClientY);

    setIsBoxPopoverOpen(false);
    setIsEdgePopoverOpen(false);
    setIsDomainPickerOpen(false);
    setNewTitle('');
    setNewNotes('');
    setNewNodeType('skill');
    setNewDomainId('none');
    setQuickCreateAnchor({
      screenX: Math.max(12, Math.round(containerSize.width / 2 - 144)),
      screenY: Math.max(64, Math.round(containerSize.height / 2 - 160)),
      worldX: Math.round(worldPt.x),
      worldY: Math.round(worldPt.y - SKILL_NODE_HEIGHT / 2),
    });
  };

  // Canvas Panning Handler (identical to v1)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.seenodes-node, .seenodes-port, .seenodes-edge-btn, .seenodes-popover, button, a, input, select, textarea, [role="button"]'
      )
    ) {
      return;
    }

    if (connectingFrom) {
      setConnectingFrom(null);
      setConnectingCursor(null);
      setHoveredTargetNodeId(null);
      setHoveredTargetPort(null);
      setIsLinkMode(false);
    }
    setSelection(null);
    setIsBoxPopoverOpen(false);
    setIsEdgePopoverOpen(false);
    setQuickCreateAnchor(null);
    setIsDomainPickerOpen(false);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPanX = panX;
    const initialPanY = panY;

    const onMouseMove = (moveEv: MouseEvent) => {
      setPanX(Math.round(initialPanX + (moveEv.clientX - startX)));
      setPanY(Math.round(initialPanY + (moveEv.clientY - startY)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (connectingFrom) {
      const worldPt = clientToWorld(e.clientX, e.clientY);
      setConnectingCursor(worldPt);
      setHoveredTargetNodeId(findNodeAtWorldPoint(worldPt, connectingFrom.nodeId));
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const step = delta > 0 ? 0.08 : -0.08;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z + step).toFixed(2)))));
  };

  const handleFitView = () => {
    setZoom(0.78);
    setPanX(0);
    setPanY(0);
  };

  const handleFocusNode = (node: SkillNodeDto) => {
    setZoom(1.1);
    setPanX(Math.round((WORLD_CENTER_X - node.position.x) * 1.1));
    setPanY(Math.round((WORLD_CENTER_Y - (node.position.y + SKILL_NODE_HEIGHT / 2)) * 1.1));
  };

  const handleFocusStudent = () => {
    if (!graph) return;
    const studentNode = graph.nodes.find((n) => n.nodeType === 'student');
    if (studentNode) {
      handleFocusNode(studentNode);
      setSelection({ kind: 'node', id: studentNode.id });
    }
  };

  const handleExportSummary = () => {
    if (!graph) return;
    const lines = [
      '=== خلاصه نقشه مهارت‌ها و علایق دانشجو ===',
      `دانشجو: ${graph.studentDisplayName}`,
      `رشته: ${graph.major} · دانشکده: ${graph.faculty}`,
      `تعداد کل گره‌ها: ${toPersianDigits(graph.nodes.length)}`,
      `تعداد ارتباطات: ${toPersianDigits(graph.edges.length)}`,
      '',
      '--- فهرست مهارت‌ها و دستاوردها ---',
      ...graph.nodes
        .filter((n) => n.nodeType !== 'student')
        .map(
          (n) =>
            `- [${NODE_TYPE_LABELS[n.nodeType]}] ${n.title} (${
              n.sourceType === 'reference'
                ? 'تأییدشده مرجع'
                : n.sourceType === 'system'
                  ? 'سیستمی'
                  : 'شخصی'
            })`
        ),
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skills-graph-${graph.studentId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('فایل خلاصه مهارت‌ها صادر شد');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !quickCreateAnchor) return;
    const selectedDomain = newDomainId !== 'none' ? newDomainId : undefined;
    createSkillMutation.mutate({
      title: newTitle.trim(),
      nodeType: newNodeType,
      domainId: selectedDomain,
      proficiencyLevel: newNodeType === 'skill' ? newProficiency : undefined,
      learningStatus: 'learning',
      position: { x: quickCreateAnchor.worldX, y: quickCreateAnchor.worldY },
      notes: newNotes.trim() || undefined,
      autoConnect: Boolean(selectedDomain),
    });
  };

  const handleSaveBoxEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !editTitle.trim()) return;
    const trimmedNotes = editNotes.trim();
    updateNodeMutation.mutate({
      nodeId: selectedNode.id,
      updates: {
        title: editTitle.trim(),
        nodeType: editNodeType,
        proficiencyLevel: editNodeType === 'skill' ? editProficiency : undefined,
        numericLevel:
          editNodeType === 'skill' ? PROFICIENCY_LEVEL_MAP[editProficiency].numeric : undefined,
        learningStatus: editLearningStatus,
        notes: trimmedNotes || undefined,
        subtitle: trimmedNotes || '',
      },
    });
  };

  const handleSaveEdgeEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdge) return;
    updateEdgeMutation.mutate({
      edgeId: selectedEdge.id,
      updates: {
        label: editEdgeLabel.trim() || SKILL_RELATION_LABELS[editEdgeRelation],
        relationType: editEdgeRelation,
      },
    });
  };

  // Live preview curve geometry (snaps smoothly to exact hovered port or closest port on hovered target node)
  const previewWire = useMemo(() => {
    if (!connectingFrom || !connectingCursor) return null;
    let endPt = connectingCursor;
    let endSide: PortSide | undefined;

    if (hoveredTargetNodeId && graph) {
      const targetNode = nodeById.get(hoveredTargetNodeId);
      if (targetNode) {
        if (hoveredTargetPort) {
          endSide = hoveredTargetPort;
          endPt = getNodePorts(targetNode.position)[hoveredTargetPort];
        } else {
          const closest = getClosestPort(targetNode.position, connectingCursor);
          endPt = closest.point;
          endSide = closest.side;
        }
      }
    }

    const path = buildDirectionalBezier(
      { x: connectingFrom.startX, y: connectingFrom.startY },
      connectingFrom.side,
      endPt,
      endSide
    );

    return { path, endPt, endSide };
  }, [connectingFrom, connectingCursor, hoveredTargetNodeId, hoveredTargetPort, graph, nodeById]);

  return (
    <section
      aria-label="فضای کاری نقشه مهارت‌ها و علایق دانشجو"
      className="flex-1 w-full h-full flex flex-col bg-[#141414] relative overflow-hidden select-none"
    >
      {/* Loading State */}
      {skillsQuery.isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-[#333333] border-t-[#7f77dd] animate-spin" />
            <Layers className="w-5 h-5 text-[#7f77dd] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="mt-5 text-sm font-semibold text-[#e0e0e0]">
            در حال بارگذاری نقشه مهارت‌ها و علایق...
          </h2>
          <p className="mt-1.5 text-xs text-[#888888]">
            دریافت حوزه‌های دانشگاهی، مهارت‌های ثبت‌شده و چیدمان شخصی
          </p>
        </div>
      )}

      {/* Error State */}
      {skillsQuery.error && (
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#1e1e1e] border border-rose-900/60 rounded-[12px] p-6 shadow-2xl">
            <h2 className="text-base font-bold text-slate-100">خطا در بارگذاری نقشه مهارت‌ها</h2>
            <p className="mt-2 text-xs text-[#888888]">
              {skillsQuery.error instanceof Error
                ? skillsQuery.error.message
                : 'ارتباط با سرور برقرار نشد.'}
            </p>
            <button
              type="button"
              onClick={() => void skillsQuery.refetch()}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#7f77dd] hover:bg-[#6c64ca] text-white rounded-[8px] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تلاش مجدد</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Interactive Skills Graph Canvas (SeeNodes Style) */}
      {!skillsQuery.isLoading && !skillsQuery.error && graph && (
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onDoubleClick={handleCanvasDoubleClick}
          onWheel={handleWheel}
          className={`flex-1 w-full h-full relative overflow-hidden bg-[#141414] ${
            connectingFrom || isLinkMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          {/* Authentic SeeNodes 40px Grid Pattern Canvas */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <defs>
              <pattern
                id="seenodes-skills-grid"
                x={panX % 40}
                y={panY % 40}
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f1f1f" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#seenodes-skills-grid)" />
          </svg>

          {/* Compact Top-Left Search & Filter Bar */}
          <div className="hidden sm:flex items-center gap-1.5 absolute top-16 left-4 z-20 bg-[#1e1e1e] border border-[#333333] rounded-[8px] px-2.5 py-1 shadow-lg">
            <Search className="w-3.5 h-3.5 text-[#777777]" />
            <input
              type="text"
              placeholder="جست‌وجو..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-[#e0e0e0] placeholder:text-[#666666] focus:outline-none w-28 md:w-36"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#777777] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <div className="w-px h-3.5 bg-[#333333] mx-0.5" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#141414] text-[#b0b0b0] text-[11px] rounded-[5px] px-1.5 py-0.5 border border-[#2c2c2c] focus:outline-none"
            >
              <option value="all">همه</option>
              <option value="domain">حوزه‌ها</option>
              <option value="skill">مهارت‌ها</option>
              <option value="achievement">دستاوردها</option>
              <option value="event">رویدادها</option>
            </select>
          </div>

          {/* Interactive Transformed Viewport Layer */}
          <div
            className="absolute top-0 left-0 w-full h-full pointer-events-none origin-top-left"
            style={{
              transform: `translate(${viewportX}px, ${viewportY}px) scale(${zoom}) translate(${-WORLD_CENTER_X}px, ${-WORLD_CENTER_Y}px)`,
            }}
          >
            {/* Edges SVG Layer */}
            <svg
              className="absolute overflow-visible pointer-events-none"
              style={{ left: 0, top: 0, width: 1, height: 1 }}
              aria-label="روابط گراف مهارت‌ها"
            >
              <defs>
                <filter id="seenodes-skills-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7f77dd" floodOpacity="0.85" />
                </filter>
              </defs>

              {graph.edges.map((edge) => {
                const sourceNode = nodeById.get(edge.source);
                const targetNode = nodeById.get(edge.target);
                if (!sourceNode || !targetNode) return null;

                const { edgePath, x2, y2, midX, midY } = getEdgeCurveForEdge(
                  sourceNode.position,
                  targetNode.position,
                  edge
                );
                const isSelected = selection?.kind === 'edge' && selection.id === edge.id;
                const isDimmed =
                  !matchingNodeIds.has(sourceNode.id) && !matchingNodeIds.has(targetNode.id);

                return (
                  <g
                    key={edge.id}
                    className="seenodes-edge-group"
                    style={{ opacity: isDimmed ? 0.25 : 1, transition: 'opacity 0.15s ease' }}
                  >
                    {/* Invisible Wide Hit Area for Edge Selection */}
                    <path
                      d={edgePath}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={22}
                      className="cursor-pointer pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBoxPopoverOpen(false);
                        setQuickCreateAnchor(null);
                        setSelection({ kind: 'edge', id: edge.id });
                        setIsEdgePopoverOpen(true);
                      }}
                    />
                    {/* Rendered Visible Edge */}
                    <path
                      d={edgePath}
                      fill="none"
                      stroke={isSelected ? '#7f77dd' : '#333333'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeLinecap="round"
                      filter={isSelected ? 'url(#seenodes-skills-edge-glow)' : undefined}
                      className="transition-colors pointer-events-none"
                    />
                    {/* Connection End Dot */}
                    <circle
                      cx={x2}
                      cy={y2}
                      r={2.5}
                      fill={isSelected ? '#7f77dd' : '#555555'}
                      className="pointer-events-none"
                    />
                    {/* Edge Label Pill */}
                    <foreignObject
                      x={midX - 46}
                      y={midY - 11}
                      width={92}
                      height={22}
                      className="overflow-visible pointer-events-none"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBoxPopoverOpen(false);
                          setQuickCreateAnchor(null);
                          setSelection({ kind: 'edge', id: edge.id });
                          setIsEdgePopoverOpen(true);
                        }}
                        style={{
                          background: isSelected ? '#7f77dd' : '#222222',
                          borderColor: isSelected ? '#9f97ff' : '#333333',
                          color: isSelected ? '#ffffff' : '#888888',
                        }}
                        className="seenodes-edge-btn w-full h-full px-1.5 rounded-[4px] border text-[10px] font-mono leading-none truncate flex items-center justify-center shadow-md cursor-pointer pointer-events-auto hover:border-[#666666] transition-colors"
                      >
                        {edge.label}
                      </button>
                    </foreignObject>
                  </g>
                );
              })}

              {/* Live SeeNodes Bezier Wire Preview While Connecting */}
              {previewWire && (
                <g className="pointer-events-none">
                  <path
                    d={previewWire.path}
                    fill="none"
                    stroke="#7f77dd"
                    strokeWidth={2.5}
                    strokeDasharray={hoveredTargetNodeId ? undefined : '6 4'}
                    strokeLinecap="round"
                    filter="url(#seenodes-skills-edge-glow)"
                  />
                  <circle
                    cx={previewWire.endPt.x}
                    cy={previewWire.endPt.y}
                    r={hoveredTargetNodeId ? 5 : 3.5}
                    fill="#9f97ff"
                  />
                </g>
              )}
            </svg>

            {/* Nodes HTML Layer (Exact v1 Boxes + Proximity '+' 4-Port Handles + Magnetic Repulsion) */}
            <div className="absolute inset-0 pointer-events-none" aria-label="گره‌های گراف مهارت‌ها">
              {graph.nodes.map((node) => {
                const isSelected = selection?.kind === 'node' && selection.id === node.id;
                const isDragging = activeDraggingNodeId === node.id;
                const isConnectSource = connectingFrom?.nodeId === node.id;
                const isConnectTargetHovered = hoveredTargetNodeId === node.id;
                const isDimmed = !matchingNodeIds.has(node.id);
                const theme = getSkillNodeTheme(node.nodeType);
                const ports = getNodePorts(node.position);

                const portConfigs: Array<{
                  side: PortSide;
                  label: string;
                  wrapperStyle: React.CSSProperties;
                }> = [
                  {
                    side: 'top',
                    label: 'نقطه اتصال بالا',
                    wrapperStyle: { left: '50%', top: '-14px', transform: 'translateX(-50%)' },
                  },
                  {
                    side: 'bottom',
                    label: 'نقطه اتصال پایین',
                    wrapperStyle: { left: '50%', bottom: '-14px', transform: 'translateX(-50%)' },
                  },
                  {
                    side: 'left',
                    label: 'نقطه اتصال چپ',
                    wrapperStyle: { left: '-14px', top: '50%', transform: 'translateY(-50%)' },
                  },
                  {
                    side: 'right',
                    label: 'نقطه اتصال راست',
                    wrapperStyle: { right: '-14px', top: '50%', transform: 'translateY(-50%)' },
                  },
                ];

                return (
                  <div
                    key={node.id}
                    data-skill-node-id={node.id}
                    onMouseDown={(e) => handleNodeStartDrag(node, e.clientX, e.clientY, false)}
                    onTouchStart={(e) => {
                      if (e.touches.length > 0) {
                        handleNodeStartDrag(
                          node,
                          e.touches[0].clientX,
                          e.touches[0].clientY,
                          true
                        );
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${node.position.x - SKILL_NODE_WIDTH / 2}px`,
                      top: `${node.position.y}px`,
                      width: `${SKILL_NODE_WIDTH}px`,
                      height: `${SKILL_NODE_HEIGHT}px`,
                      background: '#1e1e1e',
                      border:
                        isSelected || isConnectSource || isConnectTargetHovered
                          ? `1.5px solid ${theme.accent}`
                          : '1.5px solid #3a3a3a',
                      borderRadius: '10px',
                      boxShadow: isDragging
                        ? `0 20px 40px rgba(0, 0, 0, 0.75), 0 0 0 2px ${theme.accent}`
                        : isConnectTargetHovered
                          ? `0 0 0 3px ${theme.accent}, 0 10px 28px rgba(127, 119, 221, 0.35)`
                          : isSelected || isConnectSource
                            ? `0 0 0 2px ${theme.border}, 0 8px 24px rgba(0, 0, 0, 0.5)`
                            : '0 4px 12px rgba(0, 0, 0, 0.35)',
                      cursor:
                        connectingFrom || isLinkMode
                          ? 'crosshair'
                          : isDragging
                            ? 'grabbing'
                            : 'grab',
                      transform: isDragging ? 'scale(1.03)' : 'none',
                      opacity: isDimmed ? 0.25 : 1,
                      transition: isDragging
                        ? 'box-shadow 0.12s ease, transform 0.12s ease'
                        : 'left 0.16s cubic-bezier(0.16, 1, 0.3, 1), top 0.16s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease',
                      zIndex: isDragging ? 50 : isSelected || isConnectTargetHovered ? 40 : 10,
                      pointerEvents: 'auto',
                    }}
                    className="seenodes-node group p-2.5 flex flex-col justify-between select-none"
                  >
                    {/* 4 SeeNodes Proximity Port Handles (28x28 hit zone -> cursor turns into '+' crosshair!) */}
                    {portConfigs.map((port) => {
                      const isActiveStartPort =
                        isConnectSource && connectingFrom?.side === port.side;
                      const isSnapTargetPort =
                        isConnectTargetHovered && previewWire?.endSide === port.side;
                      return (
                        <button
                          key={port.side}
                          type="button"
                          data-port-node-id={node.id}
                          data-port-side={port.side}
                          aria-label={port.label}
                          title="کلیک یا درگ کنید تا خط اتصال ایجاد شود"
                          onMouseEnter={() => {
                            if (connectingFrom && connectingFrom.nodeId !== node.id) {
                              setHoveredTargetNodeId(node.id);
                              setHoveredTargetPort(port.side);
                            }
                          }}
                          onMouseLeave={() => {
                            if (hoveredTargetNodeId === node.id && hoveredTargetPort === port.side) {
                              setHoveredTargetPort(null);
                            }
                          }}
                          onMouseDown={(e) =>
                            handlePortMouseDown(e, node, port.side, ports[port.side])
                          }
                          style={port.wrapperStyle}
                          className="seenodes-port group/port absolute w-7 h-7 flex items-center justify-center cursor-crosshair z-30 focus:outline-none"
                        >
                          <span
                            style={{
                              background:
                                isActiveStartPort || isSnapTargetPort ? '#ffffff' : theme.handle,
                              borderColor:
                                isActiveStartPort || isSnapTargetPort ? theme.accent : '#141414',
                            }}
                            className={`rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                              isActiveStartPort || isSnapTargetPort
                                ? 'w-4 h-4 scale-110 shadow-[0_0_10px_rgba(127,119,221,0.9)]'
                                : connectingFrom && !isConnectSource
                                  ? 'w-3 h-3 ring-2 ring-[#7f77dd]/45 group-hover/port:w-4 group-hover/port:h-4 group-hover/port:ring-[#7f77dd]'
                                  : 'w-2.5 h-2.5 group-hover/port:w-4 group-hover/port:h-4 group-hover/port:shadow-[0_0_8px_rgba(127,119,221,0.75)]'
                            }`}
                          >
                            <Plus className="w-2.5 h-2.5 text-[#141414] stroke-[3] opacity-0 group-hover/port:opacity-100 transition-opacity" />
                          </span>
                        </button>
                      );
                    })}

                    {/* Top Row: Title + Compact Status */}
                    <div className="flex items-start justify-between gap-1.5 min-w-0">
                      <div className="text-xs font-semibold text-[#e0e0e0] truncate tracking-tight">
                        {toPersianDigits(node.title)}
                      </div>
                      {node.nodeType === 'student' && (
                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-[#f59e0b]/20 text-[#fbbf24] shrink-0 border border-[#f59e0b]/30">
                          شما
                        </span>
                      )}
                      {node.nodeType === 'skill' && node.numericLevel && (
                        <span className="flex items-center gap-0.5 text-[10px] font-mono text-amber-400 shrink-0">
                          {toPersianDigits(node.numericLevel)}
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        </span>
                      )}
                      {(node.nodeType === 'achievement' || node.nodeType === 'event') &&
                        node.verificationStatus === 'verified' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                    </div>

                    {/* Bottom Row: Description / Subtitle + Type Tag */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#2a2a2a] text-[11px] text-[#888888] min-w-0">
                      <div className="truncate text-[10px] text-[#999999]">
                        {toPersianDigits(
                          node.notes ||
                            node.subtitle ||
                            (node.learningStatus
                              ? LEARNING_STATUS_LABELS[node.learningStatus]
                              : node.domainTitle || node.category)
                        )}
                      </div>
                      <span
                        style={{ background: theme.tagBg, color: theme.tagText }}
                        className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono shrink-0"
                      >
                        {NODE_TYPE_LABELS[node.nodeType]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Canvas Hint (bottom right) */}
          <div className="hidden lg:block absolute bottom-3 right-4 pointer-events-none z-10 text-[11px] text-[#555555] font-mono select-none">
            دابل‌کلیک فضای خالی: باکس جدید · کلیک باکس: ویرایش · کلیک ۴ نقطه اطراف: اتصال
          </div>

          {/* Active Connection Guidance Banner */}
          {(connectingFrom || isLinkMode) && (
            <div className="seenodes-popover absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-[#1e1e1e] border border-[#7f77dd] text-[#e0e0e0] text-xs px-3 py-1.5 rounded-[8px] shadow-xl flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-[#7f77dd]" />
              <span>
                {connectingFrom
                  ? 'روی باکس مقصد یا یکی از ۴ نقطه آن کلیک کنید تا متصل شوند'
                  : 'روی یک باکس یا نقطه اتصال کلیک کنید'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setConnectingFrom(null);
                  setConnectingCursor(null);
                  setHoveredTargetNodeId(null);
                  setHoveredTargetPort(null);
                  setIsLinkMode(false);
                }}
                className="text-[11px] text-[#888888] hover:text-white px-1.5 py-0.5 rounded bg-[#282828]"
              >
                لغو
              </button>
            </div>
          )}

          {/* Quick-Create Card at Double-Clicked Canvas Location */}
          {quickCreateAnchor && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                left: `${quickCreateAnchor.screenX}px`,
                top: `${quickCreateAnchor.screenY}px`,
              }}
              className="seenodes-popover absolute z-40 w-72 bg-[#1e1e1e] border border-[#3a3a3a] rounded-[10px] p-3.5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#2a2a2a]">
                <span className="text-xs font-bold text-[#e0e0e0]">ساخت باکس جدید</span>
                <button
                  type="button"
                  onClick={() => setQuickCreateAnchor(null)}
                  className="p-1 rounded-[6px] text-[#888888] hover:text-white hover:bg-[#2a2a2a]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <form onSubmit={handleCreateSubmit} className="space-y-2.5">
                <div className="grid grid-cols-4 gap-1">
                  {EDITABLE_NODE_TYPES.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setNewNodeType(item.type)}
                      className={`py-1 rounded-[6px] text-[11px] font-medium border transition-colors ${
                        newNodeType === item.type
                          ? 'bg-[#7f77dd]/20 border-[#7f77dd] text-white'
                          : 'bg-[#141414] border-[#2c2c2c] text-[#888888] hover:text-[#cccccc]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="نام باکس (مثلاً: پایتون، هوش مصنوعی...)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333333] rounded-[6px] px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                />
                <textarea
                  rows={2}
                  placeholder="توضیحات کوتاه (اختیاری)"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333333] rounded-[6px] px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={newDomainId}
                    onChange={(e) => setNewDomainId(e.target.value)}
                    className="bg-[#141414] border border-[#333333] rounded-[6px] px-2 py-1 text-[11px] text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                  >
                    <option value="none">اتصال دستی بعداً</option>
                    {availableDomains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                  {newNodeType === 'skill' && (
                    <select
                      value={newProficiency}
                      onChange={(e) => setNewProficiency(e.target.value as SkillProficiencyLevel)}
                      className="bg-[#141414] border border-[#333333] rounded-[6px] px-2 py-1 text-[11px] text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                    >
                      <option value="beginner">مقدماتی (۱★)</option>
                      <option value="elementary">آشنا (۲★)</option>
                      <option value="intermediate">متوسط (۳★)</option>
                      <option value="advanced">پیشرفته (۴★)</option>
                      <option value="expert">متخصص (۵★)</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuickCreateAnchor(null)}
                    className="px-2.5 py-1 text-xs text-[#999999] hover:text-white rounded-[6px]"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={createSkillMutation.isPending || !newTitle.trim()}
                    className="px-3 py-1.5 bg-[#7f77dd] hover:bg-[#6c64ca] disabled:opacity-50 text-white rounded-[6px] text-xs font-medium transition-colors"
                  >
                    {createSkillMutation.isPending ? 'در حال ساخت...' : 'ایجاد باکس'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Box-Adjacent Click-to-Edit Popover (Next to Selected Box) */}
          {boxPopoverCoords && selectedNode && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                left: `${boxPopoverCoords.left}px`,
                top: `${boxPopoverCoords.top}px`,
              }}
              className="seenodes-popover absolute z-40 w-72 bg-[#1e1e1e] border border-[#3a3a3a] rounded-[10px] p-3.5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-1.5 min-w-0">
                  {renderSkillNodeIcon(selectedNode.nodeType)}
                  <span className="text-xs font-bold text-[#e0e0e0] truncate">
                    {selectedNode.sourceType === 'system' ? 'مشخصات گره رسمی' : 'ویرایش باکس'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBoxPopoverOpen(false)}
                  aria-label="بستن"
                  className="p-1 rounded-[6px] text-[#888888] hover:text-white hover:bg-[#2a2a2a]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedNode.sourceType === 'system' ? (
                <div className="space-y-2.5">
                  <div>
                    <div className="text-[10px] text-[#777777]">عنوان</div>
                    <div className="text-xs font-semibold text-[#e0e0e0] mt-0.5">
                      {toPersianDigits(selectedNode.title)}
                    </div>
                  </div>
                  {(selectedNode.notes || selectedNode.subtitle) && (
                    <div>
                      <div className="text-[10px] text-[#777777]">توضیحات</div>
                      <div className="text-[11px] text-[#b0b0b0] mt-0.5 leading-relaxed">
                        {toPersianDigits(selectedNode.notes || selectedNode.subtitle || '')}
                      </div>
                    </div>
                  )}
                  <div className="text-[10px] text-[#888888] bg-[#141414] border border-[#2c2c2c] rounded-[6px] px-2 py-1.5">
                    گره‌های رسمی دانشگاه فقط‌خواندنی هستند، اما می‌توانید از ۴ نقطه اطراف آن‌ها خط اتصال بکشید.
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const rightPort = getNodePorts(selectedNode.position).right;
                        setIsBoxPopoverOpen(false);
                        setConnectingFrom({
                          nodeId: selectedNode.id,
                          side: 'right',
                          startX: rightPort.x,
                          startY: rightPort.y,
                        });
                        setConnectingCursor(rightPort);
                      }}
                      className="flex-1 py-1.5 bg-[#7f77dd] hover:bg-[#6c64ca] text-white rounded-[6px] text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>اتصال به باکس دیگر</span>
                    </button>
                    {selectedNode.nodeType === 'domain' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmDeleteId === selectedNode.id) {
                            detachDomainMutation.mutate(selectedNode.domainId || selectedNode.id);
                          } else {
                            setConfirmDeleteId(selectedNode.id);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-[6px] text-xs border transition-colors ${
                          confirmDeleteId === selectedNode.id
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-[#282828] border-[#3a3a3a] text-rose-400 hover:bg-rose-950/60'
                        }`}
                      >
                        {confirmDeleteId === selectedNode.id ? 'تایید؟' : 'جداکردن'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveBoxEdit} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] text-[#888888] block mb-1">اسم باکس</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-[#141414] border border-[#333333] rounded-[6px] px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#888888] block mb-1">نوع باکس</label>
                    <div className="grid grid-cols-4 gap-1">
                      {EDITABLE_NODE_TYPES.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setEditNodeType(item.type)}
                          className={`py-1 rounded-[6px] text-[11px] font-medium border transition-colors ${
                            editNodeType === item.type
                              ? 'bg-[#7f77dd]/20 border-[#7f77dd] text-white'
                              : 'bg-[#141414] border-[#2c2c2c] text-[#888888] hover:text-[#cccccc]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#888888] block mb-1">توضیحات</label>
                    <textarea
                      rows={2}
                      placeholder="توضیحات درباره این مهارت یا حوزه..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-[#141414] border border-[#333333] rounded-[6px] p-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                    />
                  </div>

                  {editNodeType === 'skill' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editProficiency}
                        onChange={(e) =>
                          setEditProficiency(e.target.value as SkillProficiencyLevel)
                        }
                        className="bg-[#141414] border border-[#333333] rounded-[6px] px-2 py-1 text-[11px] text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                      >
                        <option value="beginner">مقدماتی (۱★)</option>
                        <option value="elementary">آشنا (۲★)</option>
                        <option value="intermediate">متوسط (۳★)</option>
                        <option value="advanced">پیشرفته (۴★)</option>
                        <option value="expert">متخصص (۵★)</option>
                      </select>
                      <select
                        value={editLearningStatus}
                        onChange={(e) =>
                          setEditLearningStatus(e.target.value as SkillLearningStatus)
                        }
                        className="bg-[#141414] border border-[#333333] rounded-[6px] px-2 py-1 text-[11px] text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                      >
                        <option value="interested">علاقه‌مند</option>
                        <option value="learning">در حال یادگیری</option>
                        <option value="practiced">تجربه عملی</option>
                        <option value="proficient">مسلط</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={updateNodeMutation.isPending || !editTitle.trim()}
                      className="flex-1 py-1.5 bg-[#7f77dd] hover:bg-[#6c64ca] text-white rounded-[6px] text-xs font-medium transition-colors"
                    >
                      {updateNodeMutation.isPending ? 'ذخیره...' : 'ذخیره'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmDeleteId === selectedNode.id) {
                          deleteNodeMutation.mutate(selectedNode.id);
                        } else {
                          setConfirmDeleteId(selectedNode.id);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-[6px] text-xs border transition-colors flex items-center gap-1 ${
                        confirmDeleteId === selectedNode.id
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-[#282828] border-[#3a3a3a] text-rose-400 hover:bg-rose-950/60'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{confirmDeleteId === selectedNode.id ? 'تایید؟' : 'حذف'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Edge-Midpoint Click-to-Edit Popover */}
          {edgePopoverCoords && selectedEdge && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                left: `${edgePopoverCoords.left}px`,
                top: `${edgePopoverCoords.top}px`,
              }}
              className="seenodes-popover absolute z-40 w-64 bg-[#1e1e1e] border border-[#3a3a3a] rounded-[10px] p-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-1.5">
                  <GitCommitHorizontal className="w-3.5 h-3.5 text-[#7f77dd]" />
                  <span className="text-xs font-bold text-[#e0e0e0]">ویرایش خط ارتباطی</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEdgePopoverOpen(false)}
                  className="p-1 rounded-[6px] text-[#888888] hover:text-white hover:bg-[#2a2a2a]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <form onSubmit={handleSaveEdgeEdit} className="space-y-2">
                <input
                  type="text"
                  value={editEdgeLabel}
                  onChange={(e) => setEditEdgeLabel(e.target.value)}
                  placeholder="عنوان خط (مثلاً: مکمل فنی)"
                  className="w-full bg-[#141414] border border-[#333333] rounded-[6px] px-2.5 py-1.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                />
                <select
                  value={editEdgeRelation}
                  onChange={(e) => {
                    const rel = e.target.value as SkillRelationType;
                    setEditEdgeRelation(rel);
                    setEditEdgeLabel(SKILL_RELATION_LABELS[rel]);
                  }}
                  className="w-full bg-[#141414] border border-[#333333] rounded-[6px] px-2 py-1 text-[11px] text-[#e0e0e0] focus:outline-none focus:border-[#7f77dd]"
                >
                  {(Object.keys(SKILL_RELATION_LABELS) as SkillRelationType[]).map((rel) => (
                    <option key={rel} value={rel}>
                      {SKILL_RELATION_LABELS[rel]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="submit"
                    disabled={updateEdgeMutation.isPending}
                    className="flex-1 py-1.5 bg-[#7f77dd] hover:bg-[#6c64ca] text-white rounded-[6px] text-xs font-medium transition-colors"
                  >
                    ذخیره
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === selectedEdge.id) {
                        deleteEdgeMutation.mutate(selectedEdge.id);
                      } else {
                        setConfirmDeleteId(selectedEdge.id);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-[6px] text-xs border transition-colors flex items-center gap-1 ${
                      confirmDeleteId === selectedEdge.id
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-[#282828] border-[#3a3a3a] text-rose-400 hover:bg-rose-950/60'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{confirmDeleteId === selectedEdge.id ? 'تایید؟' : 'حذف'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Quick Attach Official Domains Popover */}
          {isDomainPickerOpen && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="seenodes-popover absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-80 sm:w-96 bg-[#1e1e1e] border border-[#333333] rounded-[10px] p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#2a2a2a]">
                <span className="text-xs font-bold text-[#e0e0e0]">حوزه‌های فعالیت دانشگاهی</span>
                <button
                  type="button"
                  onClick={() => setIsDomainPickerOpen(false)}
                  className="p-1 rounded-[6px] text-[#888888] hover:text-white hover:bg-[#2a2a2a]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
                {availableDomains.map((domain) => {
                  const attached = graph.nodes.some((n) => n.id === `node-domain-${domain.id}`);
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => {
                        if (attached) {
                          detachDomainMutation.mutate(domain.id);
                        } else {
                          attachDomainMutation.mutate(domain.id);
                        }
                      }}
                      className={`p-2 rounded-[6px] border text-right text-xs transition-colors flex items-center justify-between gap-1 ${
                        attached
                          ? 'bg-[#589bf6]/15 border-[#589bf6]/60 text-white'
                          : 'bg-[#141414] border-[#2c2c2c] text-[#b0b0b0] hover:border-[#444444]'
                      }`}
                    >
                      <span className="truncate">{domain.title}</span>
                      <span className="text-[10px] shrink-0 text-[#888888]">
                        {attached ? 'حذف' : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SeeNodes Floating Bottom Toolbar Pill (NO Mini Map) */}
          <div
            role="toolbar"
            aria-label="ابزارهای کنترل نمای بوم مهارت‌ها"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-[#333333] rounded-[10px] px-2 py-1.5 flex items-center gap-1 shadow-2xl z-20 select-none max-w-[95vw] overflow-x-auto"
          >
            <button
              type="button"
              onClick={openToolbarQuickCreate}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap ${
                quickCreateAnchor
                  ? 'bg-[#7f77dd] text-white'
                  : 'text-[#a78bfa] hover:text-white hover:bg-[#282828]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>باکس جدید</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDomainPickerOpen(!isDomainPickerOpen)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap ${
                isDomainPickerOpen
                  ? 'bg-[#589bf6] text-white'
                  : 'text-[#60a5fa] hover:text-white hover:bg-[#282828]'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>حوزه‌ها</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLinkMode(!isLinkMode);
                setConnectingFrom(null);
                setConnectingCursor(null);
                setHoveredTargetNodeId(null);
              }}
              title="حالت رسم خط ارتباطی بین باکس‌ها"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap ${
                isLinkMode || connectingFrom
                  ? 'bg-[#7f77dd] text-white'
                  : 'text-[#b0b0b0] hover:text-white hover:bg-[#282828]'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>اتصال</span>
            </button>

            <div className="w-px h-4 bg-[#333333] mx-1 shrink-0" />

            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.15).toFixed(2))))
              }
              title="بزرگ‌نمایی"
              className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828] transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-xs font-mono tabular-nums text-[#b0b0b0] select-none">
              {formatZoomPercent(zoom)}
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.15).toFixed(2))))
              }
              title="کوچک‌نمایی"
              className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828] transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-[#333333] mx-1 shrink-0" />

            <button
              type="button"
              onClick={handleFitView}
              title="نمای کامل (Fit View)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-[#b0b0b0] hover:text-white hover:bg-[#282828] transition-colors whitespace-nowrap"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden md:inline">نمای کامل</span>
            </button>
            <button
              type="button"
              onClick={handleFocusStudent}
              title="تمرکز روی گره دانشجو"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-[#fbbf24] hover:bg-[#282828] transition-colors whitespace-nowrap"
            >
              <Crosshair className="w-3 h-3" />
              <span className="hidden md:inline">مکان من</span>
            </button>
            <button
              type="button"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              title="بازنشانی چیدمان و داده‌ها به حالت ثبت‌نام"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-[#f59e0b] hover:bg-[#282828] transition-colors whitespace-nowrap"
            >
              <RotateCcw className={`w-3 h-3 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">بازنشانی</span>
            </button>

            <div className="w-px h-4 bg-[#333333] mx-1 shrink-0" />

            <button
              type="button"
              onClick={() => setIsDirectoryOpen(!isDirectoryOpen)}
              title="فهرست همه باکس‌های نقشه"
              className={`p-1.5 rounded-[6px] transition-colors ${
                isDirectoryOpen
                  ? 'text-[#7f77dd] bg-[#282828]'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportSummary}
              title="خروجی متنی مهارت‌ها"
              className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Optional Docked Directory Drawer (Only opened via toolbar Info button) */}
          {isDirectoryOpen && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="seenodes-popover absolute top-16 right-4 z-30 w-72 max-h-[calc(100vh-5.5rem)] shadow-2xl rounded-[10px] overflow-hidden border border-[#333333] flex flex-col bg-[#1e1e1e]"
            >
              <aside className="w-full bg-[#1e1e1e] p-3.5 flex flex-col overflow-y-auto max-h-[calc(100vh-5.5rem)]">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#333333]">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#7f77dd]" />
                    <h2 className="text-xs font-bold text-[#e0e0e0]">
                      فهرست باکس‌ها ({toPersianDigits(graph.nodes.length)})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDirectoryOpen(false)}
                    aria-label="بستن"
                    className="p-1 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2 divide-y divide-[#2a2a2a]">
                  {graph.nodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setSelection({ kind: 'node', id: node.id });
                        handleFocusNode(node);
                        setIsBoxPopoverOpen(true);
                      }}
                      className="w-full py-2 px-1 text-right hover:bg-[#252525] transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderSkillNodeIcon(node.nodeType)}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#e0e0e0] truncate">
                            {toPersianDigits(node.title)}
                          </div>
                          <div className="text-[10px] text-[#888888] truncate">
                            {NODE_TYPE_LABELS[node.nodeType]}
                          </div>
                        </div>
                      </div>
                      <ArrowLeft className="w-3.5 h-3.5 text-[#666666] shrink-0" />
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#2a2a2a] text-[10px] text-[#777777] leading-relaxed flex items-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>داده‌های شخصی شما به‌صورت خودکار ذخیره می‌شوند.</span>
                </div>
              </aside>
            </div>
          )}

          {/* Subtle Non-Intrusive Feedback Toast */}
          {notice && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-[#282828] border border-[#3a3a3a] text-emerald-400 text-xs px-3 py-1.5 rounded-[6px] shadow-lg font-mono">
              {notice}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
