import { useState } from 'react';
import { ArrowUpLeft, Search } from 'lucide-react';
import {
  AccommodationStatus,
  EntityType,
  GraphResponseDto,
  WorkspaceTab,
} from '../domain/types';
import { useGraphStore } from '../store/useGraphStore';
import { toPersianDigits } from '../utils/persianFormat';

interface AccommodationSummaryViewProps {
  graph?: GraphResponseDto;
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
}

export function AccommodationSummaryView({
  graph,
  isLoading,
  error,
  onRefetch,
}: AccommodationSummaryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const setActiveTab = useGraphStore((s) => s.setActiveTab);
  const selectNode = useGraphStore((s) => s.selectNode);
  const setCamera = useGraphStore((s) => s.setCamera);
  const setSessionDialogOpen = useGraphStore((s) => s.setSessionDialogOpen);

  if (isLoading) {
    return (
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="h-8 w-64 bg-slate-900 rounded-lg border border-slate-800" />
        <div className="h-28 bg-slate-900 rounded-xl border border-slate-800" />
        <div className="h-56 bg-slate-900 rounded-xl border border-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-base font-bold text-slate-100">خطا در دریافت مشخصات اسکان</h2>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
        <button
          type="button"
          onClick={onRefetch}
          className="mt-5 px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  if (!graph || graph.status !== AccommodationStatus.Active) {
    return (
      <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-16">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-bold text-slate-100">عدم وجود تخصیص اتاق فعال</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            {graph?.message ?? 'اطلاعات اسکان فعالی یافت نشد.'}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSessionDialogOpen(true)}
              className="px-4 py-2 text-xs sm:text-sm font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
            >
              تغییر نشست دانشجویی
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dormNode = graph.nodes.find((n) => n.entityType === EntityType.Dormitory);
  const buildingNode = graph.nodes.find((n) => n.entityType === EntityType.Building);
  const floorNode = graph.nodes.find((n) => n.entityType === EntityType.Floor);
  const roomNode = graph.nodes.find((n) => n.entityType === EntityType.Room);
  const studentNodes = graph.nodes.filter((n) => n.entityType === EntityType.Student);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredResidents = studentNodes.filter((stu) => {
    if (!normalizedQuery) return true;
    return (
      stu.label.toLowerCase().includes(normalizedQuery) ||
      (stu.metadata.major ?? '').toLowerCase().includes(normalizedQuery)
    );
  });

  const jumpToNodeInGraph = (nodeId: string, x: number, y: number) => {
    selectNode(nodeId);
    setCamera({
      zoom: 1.15,
      panX: 560 - x,
      panY: 445 - (y + 42),
    });
    setActiveTab(WorkspaceTab.Graph);
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-20 pb-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
            مشخصات یکپارچه محل اسکان
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            اطلاعات زیر مستقیماً از تخصیص فعال سامانه مرجع خوابگاه استخراج شده و صرفاً جنبه نمایشی
            دارد.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {graph.currentStudent.displayName} · {graph.currentStudent.academicSemester}
        </div>
      </div>

      {/* Hierarchy Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-800 rounded-xl bg-slate-900/60 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-800">
        {[
          { title: 'مجتمع خوابگاهی', node: dormNode },
          { title: 'ساختمان / بلوک', node: buildingNode },
          { title: 'طبقه', node: floorNode },
          { title: 'اتاق اسکان', node: roomNode },
        ].map(({ title, node }) => (
          <div key={title} className="p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">{title}</div>
              <div className="text-sm font-bold text-slate-100 mt-1">
                {node ? toPersianDigits(node.label) : '—'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {node ? toPersianDigits(node.subtitle) : ''}
              </div>
            </div>
            {node && (
              <button
                type="button"
                onClick={() => jumpToNodeInGraph(node.id, node.position.x, node.position.y)}
                className="self-start inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
              >
                <span>نمایش در گراف</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Permitted Residents Roster Table */}
      <section aria-labelledby="residents-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="residents-heading" className="text-base font-bold text-slate-100">
              فهرست ساکنان فعال اتاق ({toPersianDigits(studentNodes.length)} نفر)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تخصیص‌های پایان‌یافته قبلی و اطلاعات تماس شخصی طبق قواعد بند ۶.۵ و ۱۳.۲ حذف شده‌اند.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <label htmlFor="resident-search" className="sr-only">
              جستجوی نام یا رشته هم‌اتاقی
            </label>
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="resident-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام یا رشته تحصیلی..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
            />
          </div>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-900/50">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
              <tr>
                <th scope="col" className="py-3 px-4 font-medium">
                  نام نمایشی دانشجو
                </th>
                <th scope="col" className="py-3 px-4 font-medium">
                  جایگاه در گراف
                </th>
                <th scope="col" className="py-3 px-4 font-medium">
                  رشته و دانشکده (مجاز)
                </th>
                <th scope="col" className="py-3 px-4 font-medium text-left">
                  سال ورود
                </th>
                <th scope="col" className="py-3 px-4 font-medium text-left">
                  مختصات پایدار (X, Y)
                </th>
                <th scope="col" className="py-3 px-4 font-medium text-left">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                    هیچ ساکنی مطابق عبارت جستجوشده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredResidents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100 whitespace-nowrap">
                      {stu.label}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {stu.isCurrentStudent ? 'دانشجوی جاری · شما' : 'هم‌اتاقی فعال'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {stu.metadata.major
                        ? `${stu.metadata.major} · ${stu.metadata.faculty ?? ''}`
                        : 'محدودشده در تنظیمات حریم خصوصی'}
                    </td>
                    <td className="py-3 px-4 text-left tabular-nums text-slate-300 whitespace-nowrap">
                      {stu.metadata.entryYear ? toPersianDigits(stu.metadata.entryYear) : '—'}
                    </td>
                    <td className="py-3 px-4 text-left font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      ({stu.position.x}, {stu.position.y})
                    </td>
                    <td className="py-3 px-4 text-left whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          jumpToNodeInGraph(stu.id, stu.position.x, stu.position.y)
                        }
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium transition-colors"
                      >
                        <span>مشاهده در گراف</span>
                        <ArrowUpLeft className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
