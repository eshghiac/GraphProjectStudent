import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building,
  Building2,
  DoorOpen,
  GitCommitHorizontal,
  Layers,
  ShieldCheck,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import {
  EntityType,
  GraphEdgeDto,
  GraphNodeDto,
  GraphResponseDto,
} from '../domain/types';
import {
  fetchAuthorizedRoomDetails,
  fetchAuthorizedStudentDetails,
} from '../services/api';
import { useGraphStore } from '../store/useGraphStore';
import { toPersianDigits } from '../utils/persianFormat';

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  [EntityType.Dormitory]: 'خوابگاه',
  [EntityType.Building]: 'ساختمان',
  [EntityType.Floor]: 'طبقه',
  [EntityType.Room]: 'اتاق اسکان',
  [EntityType.Student]: 'دانشجو',
};

function renderEntityIcon(entityType: EntityType, isCurrentStudent?: boolean) {
  if (entityType === EntityType.Dormitory) {
    return <Building2 className="w-5 h-5 text-sky-400 shrink-0" />;
  }
  if (entityType === EntityType.Building) {
    return <Building className="w-5 h-5 text-blue-400 shrink-0" />;
  }
  if (entityType === EntityType.Floor) {
    return <Layers className="w-5 h-5 text-violet-400 shrink-0" />;
  }
  if (entityType === EntityType.Room) {
    return <DoorOpen className="w-5 h-5 text-emerald-400 shrink-0" />;
  }
  if (isCurrentStudent) {
    return <UserCheck className="w-5 h-5 text-amber-400 shrink-0" />;
  }
  return <User className="w-5 h-5 text-slate-300 shrink-0" />;
}

interface NodeEdgeDetailsPanelProps {
  graph: GraphResponseDto;
  onFocusNode: (node: GraphNodeDto) => void;
  onClose?: () => void;
}

export function NodeEdgeDetailsPanel({
  graph,
  onFocusNode,
  onClose,
}: NodeEdgeDetailsPanelProps) {
  const sessionToken = useGraphStore((s) => s.sessionToken);
  const selection = useGraphStore((s) => s.selection);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const clearSelection = useGraphStore((s) => s.clearSelection);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      clearSelection();
    }
  };

  const selectedNode: GraphNodeDto | undefined =
    selection?.kind === 'node'
      ? graph.nodes.find((n) => n.id === selection.id)
      : undefined;

  const selectedEdge: GraphEdgeDto | undefined =
    selection?.kind === 'edge'
      ? graph.edges.find((e) => e.id === selection.id)
      : undefined;

  const roomDetailQuery = useQuery({
    queryKey: ['dormitory-room-detail', sessionToken, selectedNode?.entityId],
    queryFn: () => fetchAuthorizedRoomDetails(sessionToken, selectedNode!.entityId),
    enabled: Boolean(selectedNode && selectedNode.entityType === EntityType.Room),
  });

  const studentDetailQuery = useQuery({
    queryKey: ['dormitory-student-detail', sessionToken, selectedNode?.entityId],
    queryFn: () => fetchAuthorizedStudentDetails(sessionToken, selectedNode!.entityId),
    enabled: Boolean(selectedNode && selectedNode.entityType === EntityType.Student),
  });

  // Overview state when no specific node or edge is selected
  if (!selectedNode && !selectedEdge) {
    return (
      <aside
        aria-label="پنل جزئیات گراف خوابگاه"
        className="w-full shrink-0 bg-[#1e1e1e] p-4 flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-6rem)]"
      >
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
            <h2 className="text-xs font-bold text-[#e0e0e0] uppercase tracking-wider">راهنمای اجزای گراف</h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="بستن"
              className="p-1 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#888888] leading-relaxed">
            برای مشاهده جزئیات مجاز روی هر گره یا یال در بوم کلیک کنید. گره‌ها را با ماوس بکشید و رها کنید.
          </p>

          <div className="mt-5 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 mb-3">
              موجودیت‌های فعال در گراف ({toPersianDigits(graph.nodes.length)} گره)
            </h3>
            <div className="divide-y divide-slate-800/80 border-y border-slate-800">
              {graph.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    selectNode(node.id);
                    onFocusNode(node);
                  }}
                  className="w-full py-2.5 px-2 text-right hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderEntityIcon(node.entityType, node.isCurrentStudent)}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {toPersianDigits(node.label)}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {ENTITY_TYPE_LABELS[node.entityType]}
                        {node.isCurrentStudent ? ' · دانشجوی جاری (شما)' : ''}
                      </div>
                    </div>
                  </div>
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            موقعیت گره‌ها برای همه کاربران یکسان و فقط‌خواندنی است. اطلاعات خصوصی ساکنان در سرور حذف
            شده‌اند.
          </span>
        </div>
      </aside>
    );
  }

  // Selected Edge Details View (SRS Section 9: Select Edge)
  if (selectedEdge) {
    const sourceNode = graph.nodes.find((n) => n.id === selectedEdge.source);
    const targetNode = graph.nodes.find((n) => n.id === selectedEdge.target);

    return (
      <aside
        aria-label="جزئیات رابطه انتخاب‌شده"
        className="w-full shrink-0 bg-[#1e1e1e] p-4 overflow-y-auto max-h-[calc(100vh-6rem)]"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#333333]">
          <div className="flex items-center gap-2.5">
            <GitCommitHorizontal className="w-4 h-4 text-[#7f77dd] shrink-0" />
            <div>
              <div className="text-[10px] text-[#888888] uppercase tracking-wider">رابطه ساختاری گراف</div>
              <h2 className="text-xs font-bold text-[#e0e0e0]">{selectedEdge.label}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="بستن جزئیات رابطه"
            className="p-1 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <dl className="mt-4 divide-y divide-slate-800 text-xs">
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-slate-400">کد استاندارد رابطه</dt>
            <dd className="font-mono text-slate-200">{selectedEdge.relationType}</dd>
          </div>
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-slate-400">شناسه یال در گراف</dt>
            <dd className="font-mono text-slate-300 truncate max-w-[180px]">{selectedEdge.id}</dd>
          </div>
        </dl>

        <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300">گره‌های متصل در این رابطه</h3>
          {sourceNode && (
            <button
              type="button"
              onClick={() => {
                selectNode(sourceNode.id);
                onFocusNode(sourceNode);
              }}
              className="w-full p-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 text-right flex items-center justify-between gap-2 transition-colors"
            >
              <div>
                <div className="text-[11px] text-slate-400">گره مبدأ (والد سلسله‌مراتب)</div>
                <div className="text-xs font-semibold text-slate-100 mt-0.5">
                  {toPersianDigits(sourceNode.label)}
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          )}
          {targetNode && (
            <button
              type="button"
              onClick={() => {
                selectNode(targetNode.id);
                onFocusNode(targetNode);
              }}
              className="w-full p-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 text-right flex items-center justify-between gap-2 transition-colors"
            >
              <div>
                <div className="text-[11px] text-slate-400">گره مقصد (زیرمجموعه)</div>
                <div className="text-xs font-semibold text-slate-100 mt-0.5">
                  {toPersianDigits(targetNode.label)}
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // Selected Node Details View (SRS Sections 8.4 & 8.5)
  const connectedEdges = graph.edges.filter(
    (e) => e.source === selectedNode!.id || e.target === selectedNode!.id
  );

  return (
    <aside
      aria-label="جزئیات گره انتخاب‌شده"
      className="w-full shrink-0 bg-[#1e1e1e] p-4 overflow-y-auto max-h-[calc(100vh-6rem)]"
    >
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#333333]">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5">
            {renderEntityIcon(selectedNode!.entityType, selectedNode!.isCurrentStudent)}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#888888] uppercase tracking-wider">
              {ENTITY_TYPE_LABELS[selectedNode!.entityType]}
              {selectedNode!.isCurrentStudent ? ' · دانشجوی جاری (شما)' : ''}
            </div>
            <h2 className="text-xs font-bold text-[#e0e0e0] mt-0.5 break-words">
              {toPersianDigits(selectedNode!.label)}
            </h2>
            <p className="text-[11px] text-[#888888] mt-0.5">
              {toPersianDigits(selectedNode!.subtitle)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="بستن پنل جزئیات"
          className="p-1 rounded-[6px] text-[#888888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Entity-Specific Permitted Details (Section 8.5) */}
      {selectedNode!.entityType === EntityType.Dormitory && (
        <dl className="mt-4 divide-y divide-slate-800 text-xs">
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">نام مجتمع خوابگاهی</dt>
            <dd className="text-slate-100 font-medium">{selectedNode!.label}</dd>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">موقعیت پردیس</dt>
            <dd className="text-slate-200">{selectedNode!.subtitle}</dd>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">شناسه مرجع</dt>
            <dd className="font-mono text-slate-300">{selectedNode!.entityId}</dd>
          </div>
        </dl>
      )}

      {selectedNode!.entityType === EntityType.Building && (
        <dl className="mt-4 divide-y divide-slate-800 text-xs">
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">نام ساختمان</dt>
            <dd className="text-slate-100 font-medium">{selectedNode!.label}</dd>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">خوابگاه مرتبط</dt>
            <dd className="text-slate-200">{selectedNode!.metadata.dormitoryName}</dd>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">کد ساختمان</dt>
            <dd className="font-mono tabular-nums text-slate-200">
              {selectedNode!.metadata.buildingCode}
            </dd>
          </div>
          {selectedNode!.metadata.totalFloors !== undefined && (
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-400">تعداد کل طبقات</dt>
              <dd className="tabular-nums text-slate-200">
                {toPersianDigits(selectedNode!.metadata.totalFloors)} طبقه
              </dd>
            </div>
          )}
        </dl>
      )}

      {selectedNode!.entityType === EntityType.Floor && (
        <dl className="mt-4 divide-y divide-slate-800 text-xs">
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">عنوان طبقه</dt>
            <dd className="text-slate-100 font-medium">{selectedNode!.label}</dd>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">شماره طبقه</dt>
            <dd className="tabular-nums text-slate-200">
              {toPersianDigits(selectedNode!.metadata.floorNumber)}
            </dd>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-4">
            <dt className="text-slate-400">ساختمان مربوطه</dt>
            <dd className="text-slate-200">{selectedNode!.metadata.buildingName}</dd>
          </div>
          {selectedNode!.metadata.visibleRoomsCount !== undefined && (
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-400">تعداد اتاق‌های ثبت‌شده طبقه</dt>
              <dd className="tabular-nums text-slate-200">
                {toPersianDigits(selectedNode!.metadata.visibleRoomsCount)} اتاق
              </dd>
            </div>
          )}
        </dl>
      )}

      {selectedNode!.entityType === EntityType.Room && (
        <div className="mt-4">
          {roomDetailQuery.isLoading ? (
            <div className="py-4 text-xs text-slate-400">در حال دریافت جزئیات مجاز اتاق...</div>
          ) : roomDetailQuery.data ? (
            <>
              <dl className="divide-y divide-slate-800 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">شماره اتاق</dt>
                  <dd className="tabular-nums font-semibold text-slate-100">
                    {toPersianDigits(roomDetailQuery.data.roomNumber)}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">طبقه</dt>
                  <dd className="text-slate-200">{roomDetailQuery.data.floorLabel}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">ساختمان</dt>
                  <dd className="text-slate-200">{roomDetailQuery.data.buildingName}</dd>
                </div>
                {roomDetailQuery.data.capacity !== undefined && (
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-slate-400">ظرفیت ثبت‌شده اتاق</dt>
                    <dd className="tabular-nums text-slate-200">
                      {toPersianDigits(roomDetailQuery.data.activeOccupancy)} از{' '}
                      {toPersianDigits(roomDetailQuery.data.capacity)} نفر
                    </dd>
                  </div>
                )}
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">نیم‌سال اسکان</dt>
                  <dd className="text-slate-200">{roomDetailQuery.data.academicSemester}</dd>
                </div>
              </dl>

              <div className="mt-4 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  فهرست ساکنان فعال مجاز ({toPersianDigits(roomDetailQuery.data.residents.length)}{' '}
                  نفر)
                </h3>
                <div className="divide-y divide-slate-800 border-y border-slate-800">
                  {roomDetailQuery.data.residents.map((res) => {
                    const targetNode = graph.nodes.find((n) => n.id === res.nodeId);
                    return (
                      <button
                        key={res.studentId}
                        type="button"
                        onClick={() => {
                          selectNode(res.nodeId);
                          if (targetNode) onFocusNode(targetNode);
                        }}
                        className="w-full py-2.5 px-2 text-right hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-100">
                            {res.displayName}
                            {res.isCurrentStudent ? ' · شما' : ''}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {res.major
                              ? `${res.major} · ورودی ${toPersianDigits(res.entryYear)}`
                              : 'رشته تحصیلی محدود شده توسط دانشجو'}
                          </div>
                        </div>
                        <ArrowLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="py-3 text-xs text-rose-400">خطا در دریافت جزئیات اتاق.</p>
          )}
        </div>
      )}

      {selectedNode!.entityType === EntityType.Student && (
        <div className="mt-4">
          {studentDetailQuery.isLoading ? (
            <div className="py-4 text-xs text-slate-400">در حال بررسی مجوز و دریافت مشخصات...</div>
          ) : studentDetailQuery.data ? (
            <>
              <div className="flex items-center gap-3 py-3 border-b border-slate-800">
                <div
                  aria-hidden="true"
                  className={`w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 border ${
                    studentDetailQuery.data.isCurrentStudent
                      ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {studentDetailQuery.data.avatarInitials ?? 'کاربر'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {studentDetailQuery.data.displayName}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {studentDetailQuery.data.isCurrentStudent
                      ? 'نشان: دانشجوی جاری (شما)'
                      : 'هم‌اتاقی دارای تخصیص فعال'}
                  </div>
                </div>
              </div>

              <dl className="divide-y divide-slate-800 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">رشته و گرایش</dt>
                  <dd className="text-slate-100">
                    {studentDetailQuery.data.major ?? 'محدودشده در تنظیمات حریم خصوصی'}
                  </dd>
                </div>
                {studentDetailQuery.data.faculty && (
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-slate-400">دانشکده</dt>
                    <dd className="text-slate-200">{studentDetailQuery.data.faculty}</dd>
                  </div>
                )}
                {studentDetailQuery.data.entryYear && (
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-slate-400">سال ورود</dt>
                    <dd className="tabular-nums text-slate-200">
                      {toPersianDigits(studentDetailQuery.data.entryYear)}
                    </dd>
                  </div>
                )}
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-400">محل اسکان فعلی</dt>
                  <dd className="text-slate-200">
                    {toPersianDigits(studentDetailQuery.data.roomLabel)} ·{' '}
                    {studentDetailQuery.data.buildingName}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                {studentDetailQuery.data.privacyNote}
              </p>
            </>
          ) : (
            <p className="py-3 text-xs text-rose-400">شما مجوز مشاهده این اطلاعات را ندارید.</p>
          )}
        </div>
      )}

      {/* Direct Graph Connections */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
          ارتباطات مستقیم در گراف ({toPersianDigits(connectedEdges.length)} رابطه)
        </h3>
        <div className="divide-y divide-slate-800 border-y border-slate-800">
          {connectedEdges.map((edge) => {
            const isOutgoing = edge.source === selectedNode!.id;
            const neighborId = isOutgoing ? edge.target : edge.source;
            const neighbor = graph.nodes.find((n) => n.id === neighborId);
            if (!neighbor) return null;

            return (
              <div
                key={edge.id}
                className="py-2 px-1 flex items-center justify-between gap-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    selectNode(neighbor.id);
                    onFocusNode(neighbor);
                  }}
                  className="text-right hover:text-sky-300 transition-colors min-w-0 flex-1"
                >
                  <span className="text-slate-400">
                    {isOutgoing ? `${edge.label}: ` : `زیرمجموعه (${edge.label}): `}
                  </span>
                  <span className="font-medium text-slate-100">
                    {toPersianDigits(neighbor.label)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectEdge(edge.id)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 shrink-0"
                >
                  جزئیات یال
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
