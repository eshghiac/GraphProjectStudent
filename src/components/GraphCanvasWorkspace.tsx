import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building,
  Building2,
  Crosshair,
  DoorOpen,
  Download,
  Info,
  Layers,
  Lock,
  Maximize2,
  RefreshCw,
  RotateCcw,
  User,
  UserCheck,
  WifiOff,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AccommodationStatus,
  EntityType,
  GraphNodeDto,
  GraphResponseDto,
} from '../domain/types';
import { ApiRequestError } from '../services/api';
import { MAX_ZOOM, MIN_ZOOM, useGraphStore } from '../store/useGraphStore';
import { formatZoomPercent, toPersianDigits } from '../utils/persianFormat';
import { NodeEdgeDetailsPanel } from './NodeEdgeDetailsPanel';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 82;
const WORLD_CENTER_X = 560;
const WORLD_CENTER_Y = 410;

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  [EntityType.Dormitory]: 'خوابگاه',
  [EntityType.Building]: 'ساختمان',
  [EntityType.Floor]: 'طبقه',
  [EntityType.Room]: 'اتاق',
  [EntityType.Student]: 'دانشجو',
};

// SeeNodes authentic badge and accent colors
function getNodeTheme(entityType: EntityType, isCurrentStudent?: boolean) {
  if (isCurrentStudent) {
    return {
      accent: '#f59e0b',
      border: '#f59e0b',
      handle: '#f59e0b',
      tagBg: 'rgba(245, 158, 11, 0.15)',
      tagText: '#fbbf24',
    };
  }
  switch (entityType) {
    case EntityType.Dormitory:
      return {
        accent: '#589bf6',
        border: '#589bf6',
        handle: '#589bf6',
        tagBg: 'rgba(88, 155, 246, 0.15)',
        tagText: '#60a5fa',
      };
    case EntityType.Building:
      return {
        accent: '#3b82f6',
        border: '#3b82f6',
        handle: '#3b82f6',
        tagBg: 'rgba(59, 130, 246, 0.15)',
        tagText: '#93c5fd',
      };
    case EntityType.Floor:
      return {
        accent: '#8b5cf6',
        border: '#8b5cf6',
        handle: '#8b5cf6',
        tagBg: 'rgba(139, 92, 246, 0.15)',
        tagText: '#c4b5fd',
      };
    case EntityType.Room:
      return {
        accent: '#10b981',
        border: '#10b981',
        handle: '#10b981',
        tagBg: 'rgba(16, 185, 129, 0.15)',
        tagText: '#6ee7b7',
      };
    case EntityType.Student:
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

interface GraphCanvasWorkspaceProps {
  graph?: GraphResponseDto;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRefetch: () => void;
}

export function GraphCanvasWorkspace({
  graph,
  isLoading,
  isFetching,
  error,
  onRefetch,
}: GraphCanvasWorkspaceProps) {
  const zoom = useGraphStore((s) => s.zoom);
  const panX = useGraphStore((s) => s.panX);
  const panY = useGraphStore((s) => s.panY);
  const selection = useGraphStore((s) => s.selection);
  const simulateServerOutage = useGraphStore((s) => s.simulateServerOutage);
  const nodeOffsets = useGraphStore((s) => s.nodeOffsets);

  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const clearSelection = useGraphStore((s) => s.clearSelection);
  const setCamera = useGraphStore((s) => s.setCamera);
  const zoomIn = useGraphStore((s) => s.zoomIn);
  const zoomOut = useGraphStore((s) => s.zoomOut);
  const setSimulateServerOutage = useGraphStore((s) => s.setSimulateServerOutage);
  const setSessionDialogOpen = useGraphStore((s) => s.setSessionDialogOpen);
  const setNodeOffset = useGraphStore((s) => s.setNodeOffset);
  const resetNodePositions = useGraphStore((s) => s.resetNodePositions);

  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [activeDraggingNodeId, setActiveDraggingNodeId] = useState<string | null>(null);

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

  // Compute node effective position with user drag offset
  const getNodePos = (node: GraphNodeDto) => {
    const offset = nodeOffsets[node.id] || { x: 0, y: 0 };
    return {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    };
  };

  const hasCustomPositions = Object.keys(nodeOffsets).length > 0;

  const handleFitView = () => {
    setCamera({ zoom: 0.8, panX: 0, panY: 0 });
  };

  const handleFocusNode = (node: GraphNodeDto) => {
    const pos = getNodePos(node);
    setCamera({
      zoom: 1.15,
      panX: (WORLD_CENTER_X - pos.x) * 1.15,
      panY: (WORLD_CENTER_Y - (pos.y + NODE_HEIGHT / 2)) * 1.15,
    });
  };

  const handleFocusCurrentStudent = () => {
    if (!graph) return;
    const currentStudentNode = graph.nodes.find((n) => n.isCurrentStudent);
    if (currentStudentNode) {
      handleFocusNode(currentStudentNode);
      selectNode(currentStudentNode.id);
      setIsInspectorOpen(true);
    }
  };

  // Node Drag Handler (Uses window listeners for 100% smooth, uninterrupted drag)
  const handleNodeStartDrag = (
    nodeId: string,
    clientX: number,
    clientY: number,
    isTouch = false
  ) => {
    setActiveDraggingNodeId(nodeId);
    const startX = clientX;
    const startY = clientY;
    const initialOffset = nodeOffsets[nodeId] || { x: 0, y: 0 };
    let hasMoved = false;

    const onMove = (moveX: number, moveY: number) => {
      const dx = (moveX - startX) / zoom;
      const dy = (moveY - startY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2 || hasMoved) {
        hasMoved = true;
        setNodeOffset(nodeId, {
          x: Math.round(initialOffset.x + dx),
          y: Math.round(initialOffset.y + dy),
        });
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

    const onMouseUp = () => {
      cleanup();
      if (!hasMoved) {
        selectNode(nodeId);
        setIsInspectorOpen(true);
      }
    };

    const onTouchEnd = () => {
      cleanup();
      if (!hasMoved) {
        selectNode(nodeId);
        setIsInspectorOpen(true);
      }
    };

    if (isTouch) {
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    } else {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  // Background Canvas Pan Handler
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.seenodes-node, button, a, [role="button"]')) return;

    clearSelection();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPanX = panX;
    const initialPanY = panY;

    const onMouseMove = (moveEv: MouseEvent) => {
      setCamera({
        panX: initialPanX + (moveEv.clientX - startX),
        panY: initialPanY + (moveEv.clientY - startY),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Wheel Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const step = delta > 0 ? 0.08 : -0.08;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom + step).toFixed(2))));
    setCamera({ zoom: newZoom });
  };

  const handleExportSummary = () => {
    if (!graph) return;
    const lines = [
      `=== خلاصه گراف اسکان دانشجویی ===`,
      `شناسه دانشجو: ${graph.currentStudent.studentId}`,
      `نام: ${graph.currentStudent.displayName}`,
      `رشته: ${graph.currentStudent.major ?? '—'}`,
      `دانشکده: ${graph.currentStudent.faculty ?? '—'}`,
      `نیم‌سال: ${graph.currentStudent.academicSemester}`,
      `وضعیت اسکان: ${graph.status}`,
      `تعداد کل گره‌های قابل مشاهده: ${toPersianDigits(graph.nodes.length)}`,
      `تعداد کل یال‌های ارتباطی: ${toPersianDigits(graph.edges.length)}`,
      `هم‌اتاقی‌های فعال: ${toPersianDigits(
        graph.nodes.filter((n) => n.entityType === EntityType.Student).length
      )} نفر`,
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dormitory-graph-${graph.currentStudent.studentId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('خروجی صادر شد.');
    window.setTimeout(() => setExportNotice(null), 3000);
  };

  // Calculated viewport center offsets
  const viewportX = containerSize.width / 2 + panX;
  const viewportY = containerSize.height / 2 + panY;

  return (
    <section
      aria-label="فضای کاری نقشه تعاملی خوابگاه"
      className="flex-1 w-full h-full flex flex-col bg-[#141414] relative overflow-hidden select-none"
    >
      {/* Loading Skeleton */}
      {isLoading && (
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
            در حال بازیابی گراف امن اسکان خوابگاه...
          </h2>
          <p className="mt-1.5 text-xs text-[#888888]">
            استخراج ساختار درختی، اعمال پالایش حریم خصوصی و محاسبه چیدمان
          </p>
        </div>
      )}

      {/* Network / Outage Error View */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full bg-[#1e1e1e] border border-rose-900/60 rounded-[12px] p-6 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              {simulateServerOutage ||
              (error instanceof ApiRequestError && error.status === 503) ? (
                <WifiOff className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-100">
              {simulateServerOutage ||
              (error instanceof ApiRequestError && error.status === 503)
                ? 'ارتباط با سرویس اطلاعات خوابگاه برقرار نشد'
                : 'خطا در بارگذاری نقشه خوابگاه'}
            </h2>
            <p className="mt-2 text-xs text-[#888888] leading-relaxed">
              {error.message ||
                'دریافت اطلاعات خوابگاه با مشکل مواجه شد. لطفاً دوباره تلاش کنید.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRefetch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#7f77dd] hover:bg-[#6c64ca] text-white rounded-[8px] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span>تلاش مجدد</span>
              </button>
              {simulateServerOutage && (
                <button
                  type="button"
                  onClick={() => {
                    setSimulateServerOutage(false);
                    onRefetch();
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-[8px] border border-amber-500/30 transition-colors"
                >
                  غیرفعال‌سازی شبیه‌سازی قطعی
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Non-Active Accommodation Notice */}
      {!isLoading && !error && graph && graph.status !== AccommodationStatus.Active && (
        <div className="flex-1 w-full h-full flex items-center justify-center p-6 text-center">
          <div className="max-w-lg w-full bg-[#1e1e1e] border border-[#333333] rounded-[12px] p-8 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Info className="w-7 h-7" />
            </div>
            <h2 className="mt-4 text-base font-bold text-[#e0e0e0]">
              {graph.status === AccommodationStatus.NotAssigned && 'تخصیص اتاقی برای شما ثبت نشده است'}
              {graph.status === AccommodationStatus.AssignmentPending && 'درخواست اسکان در انتظار تایید'}
              {graph.status === AccommodationStatus.AssignmentEnded && 'مهلت اسکان این نیم‌سال به پایان رسیده است'}
              {graph.status === AccommodationStatus.DataIncomplete && 'پرونده اسکان شما ناقص است'}
            </h2>
            <p className="mt-2 text-xs text-[#888888] leading-relaxed">
              {graph.message}
            </p>
            <div className="mt-6 pt-5 border-t border-[#333333] flex items-center justify-between text-xs text-[#888888]">
              <span>
                دانشجو: <strong className="text-[#e0e0e0]">{graph.currentStudent.displayName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSessionDialogOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium bg-[#7f77dd] hover:bg-[#6c64ca] text-white rounded-[6px] transition-colors whitespace-nowrap"
              >
                انتخاب نشست دانشجویی دیگر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Interactive Dormitory Graph Canvas (SeeNodes App Replica) */}
      {!isLoading && !error && graph && graph.status === AccommodationStatus.Active && (
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
          className="flex-1 w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#141414]"
        >
          {/* Authentic SeeNodes 40px Grid Pattern Canvas */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <defs>
              <pattern
                id="seenodes-grid-pattern"
                x={panX % 40}
                y={panY % 40}
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f1f1f" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#seenodes-grid-pattern)" />
          </svg>

          {/* Interactive Transformed Viewport Layer (Exact React Flow / SeeNodes Architecture) */}
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
              aria-label="روابط گراف خوابگاه"
            >
              <defs>
                <filter id="seenodes-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7f77dd" floodOpacity="0.8" />
                </filter>
              </defs>

              {graph.edges.map((edge) => {
                const sourceNode = graph.nodes.find((n) => n.id === edge.source);
                const targetNode = graph.nodes.find((n) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sourcePos = getNodePos(sourceNode);
                const targetPos = getNodePos(targetNode);

                // Connect from bottom handle of source to top handle of target
                const x1 = sourcePos.x;
                const y1 = sourcePos.y + NODE_HEIGHT;
                const x2 = targetPos.x;
                const y2 = targetPos.y;

                const dy = y2 - y1;
                const controlYOffset = Math.max(30, Math.min(120, Math.abs(dy) * 0.5));
                const isSelected = selection?.kind === 'edge' && selection.id === edge.id;

                const edgePath = `M ${x1} ${y1} C ${x1} ${y1 + controlYOffset}, ${x2} ${y2 - controlYOffset}, ${x2} ${y2}`;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={edge.id} className="seenodes-edge-group">
                    {/* Invisible Wide Hit Area for Edge Selection */}
                    <path
                      d={edgePath}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={22}
                      className="cursor-pointer pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectEdge(edge.id);
                        setIsInspectorOpen(true);
                      }}
                    />
                    {/* Rendered Visible Edge */}
                    <path
                      d={edgePath}
                      fill="none"
                      stroke={isSelected ? '#7f77dd' : '#333333'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeLinecap="round"
                      filter={isSelected ? 'url(#seenodes-edge-glow)' : undefined}
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
                      x={midX - 40}
                      y={midY - 11}
                      width={80}
                      height={22}
                      className="overflow-visible pointer-events-none"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectEdge(edge.id);
                          setIsInspectorOpen(true);
                        }}
                        style={{
                          background: isSelected ? '#7f77dd' : '#222222',
                          borderColor: isSelected ? '#9f97ff' : '#333333',
                          color: isSelected ? '#ffffff' : '#888888',
                        }}
                        className="seenodes-edge-btn w-full h-full px-1.5 rounded-[4px] border text-[10px] font-mono leading-none truncate flex items-center justify-center shadow-md cursor-pointer pointer-events-auto hover:border-[#555555] transition-colors"
                      >
                        {edge.label}
                      </button>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {/* Nodes HTML Layer (Real DOM elements with direct mouse dragging) */}
            <div className="absolute inset-0 pointer-events-none" aria-label="گره‌های گراف خوابگاه">
              {graph.nodes.map((node) => {
                const pos = getNodePos(node);
                const isSelected = selection?.kind === 'node' && selection.id === node.id;
                const isDragging = activeDraggingNodeId === node.id;
                const theme = getNodeTheme(node.entityType, node.isCurrentStudent);

                return (
                  <div
                    key={node.id}
                    data-testid={`node-${node.id}`}
                    onMouseDown={(e) => handleNodeStartDrag(node.id, e.clientX, e.clientY, false)}
                    onTouchStart={(e) => {
                      if (e.touches.length > 0) {
                        handleNodeStartDrag(
                          node.id,
                          e.touches[0].clientX,
                          e.touches[0].clientY,
                          true
                        );
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${pos.x - NODE_WIDTH / 2}px`,
                      top: `${pos.y}px`,
                      width: `${NODE_WIDTH}px`,
                      height: `${NODE_HEIGHT}px`,
                      background: '#1e1e1e',
                      border: isSelected
                        ? `1.5px solid ${theme.accent}`
                        : `1.5px solid #3a3a3a`,
                      borderRadius: '10px',
                      boxShadow: isDragging
                        ? '0 20px 40px rgba(0, 0, 0, 0.75), 0 0 0 2px ' + theme.accent
                        : isSelected
                          ? `0 0 0 2px ${theme.border}, 0 8px 24px rgba(0, 0, 0, 0.5)`
                          : '0 4px 12px rgba(0, 0, 0, 0.35)',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      transform: isDragging ? 'scale(1.03)' : 'none',
                      transition: isDragging ? 'none' : 'box-shadow 0.15s ease, transform 0.15s ease',
                      zIndex: isDragging ? 50 : isSelected ? 40 : 10,
                      pointerEvents: 'auto',
                    }}
                    className="seenodes-node p-2.5 flex flex-col justify-between select-none"
                  >
                    {/* 4 SeeNodes Circular Port Handles (Top, Bottom, Left, Right) */}
                    <span
                      aria-hidden="true"
                      style={{
                        background: theme.handle,
                        borderColor: '#141414',
                        left: '50%',
                        top: '-5px',
                        transform: 'translateX(-50%)',
                      }}
                      className="absolute w-2.5 h-2.5 rounded-full border-2 pointer-events-none"
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        background: theme.handle,
                        borderColor: '#141414',
                        left: '50%',
                        bottom: '-5px',
                        transform: 'translateX(-50%)',
                      }}
                      className="absolute w-2.5 h-2.5 rounded-full border-2 pointer-events-none"
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        background: theme.handle,
                        borderColor: '#141414',
                        left: '-5px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                      className="absolute w-2.5 h-2.5 rounded-full border-2 pointer-events-none"
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        background: theme.handle,
                        borderColor: '#141414',
                        right: '-5px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                      className="absolute w-2.5 h-2.5 rounded-full border-2 pointer-events-none"
                    />

                    {/* Top Row: Title + Status Pill */}
                    <div className="flex items-start justify-between gap-1.5 min-w-0">
                      <div className="text-xs font-semibold text-[#e0e0e0] truncate tracking-tight">
                        {toPersianDigits(node.label)}
                      </div>
                      {node.isCurrentStudent && (
                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-[#f59e0b]/20 text-[#fbbf24] shrink-0 border border-[#f59e0b]/30">
                          شما
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Subtitle + Category Tag */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#2a2a2a] text-[11px] text-[#888888] min-w-0">
                      <div className="truncate text-[10px] text-[#999999]">
                        {toPersianDigits(node.subtitle)}
                      </div>
                      <span
                        style={{ background: theme.tagBg, color: theme.tagText }}
                        className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono shrink-0 uppercase"
                      >
                        {ENTITY_TYPE_LABELS[node.entityType]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Canvas Hint (bottom right) */}
          <div className="hidden sm:block absolute bottom-3 right-4 pointer-events-none z-10 text-[11px] text-[#555555] font-mono select-none">
            برای جابجایی هر باکس آن را با ماوس بکشید (درگ) · برای پیمایش بوم را جابجا کنید
          </div>

          {/* SeeNodes Floating Bottom Toolbar Pill */}
          <div
            role="toolbar"
            aria-label="ابزارهای کنترل نمای بوم گراف"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-[#333333] rounded-[10px] px-2 py-1.5 flex items-center gap-1 shadow-2xl z-20 select-none"
          >
            <button
              type="button"
              onClick={zoomIn}
              aria-label="بزرگ‌نمایی گراف"
              title="بزرگ‌نمایی"
              className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828] transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span
              aria-label="درصد بزرگ‌نمایی"
              className="px-2 text-xs font-mono tabular-nums text-[#b0b0b0] select-none"
            >
              {formatZoomPercent(zoom)}
            </span>
            <button
              type="button"
              onClick={zoomOut}
              aria-label="کوچک‌نمایی گراف"
              title="کوچک‌نمایی"
              className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828] transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-[#333333] mx-1" />
            <button
              type="button"
              onClick={handleFitView}
              aria-label="نمای کامل گراف"
              title="نمای کامل (Fit View)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-[#b0b0b0] hover:text-white hover:bg-[#282828] transition-colors whitespace-nowrap"
            >
              <Maximize2 className="w-3 h-3" />
              <span>نمای کامل</span>
            </button>
            <button
              type="button"
              onClick={handleFocusCurrentStudent}
              aria-label="تمرکز روی گره من"
              title="تمرکز روی گره دانشجوی جاری"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-[#fbbf24] hover:bg-[#282828] transition-colors whitespace-nowrap"
            >
              <Crosshair className="w-3 h-3" />
              <span>مکان من</span>
            </button>
            {hasCustomPositions && (
              <button
                type="button"
                onClick={resetNodePositions}
                title="بازنشانی موقعیت همه باکس‌ها به چیدمان اولیه"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs text-[#f59e0b] hover:bg-[#282828] transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>بازنشانی چیدمان</span>
              </button>
            )}
            <div className="w-px h-4 bg-[#333333] mx-1" />
            <button
              type="button"
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              aria-label="پنل جزئیات موجودیت"
              title="پنل جزئیات گره/یال"
              className={`p-1.5 rounded-[6px] transition-colors ${
                isInspectorOpen
                  ? 'text-[#7f77dd] bg-[#282828]'
                  : 'text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportSummary}
              aria-label="دریافت گزارش ساختاری"
              title="دریافت فایل متنی مشخصات اسکان"
              className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#282828] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Floating Contextual Inspector Panel */}
          {isInspectorOpen && (
            <div className="absolute top-16 right-4 z-30 w-80 max-h-[calc(100vh-5.5rem)] shadow-2xl rounded-[10px] overflow-hidden border border-[#333333] flex flex-col bg-[#1e1e1e]">
              <NodeEdgeDetailsPanel
                graph={graph}
                onFocusNode={handleFocusNode}
                onClose={() => setIsInspectorOpen(false)}
              />
            </div>
          )}

          {exportNotice && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-[#282828] border border-[#3a3a3a] text-emerald-400 text-xs px-3 py-1.5 rounded-[6px] shadow-lg font-mono">
              {exportNotice}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
