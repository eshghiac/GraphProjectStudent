import { useState } from 'react';
import { Check, Copy, FileText, X } from 'lucide-react';
import { GraphResponseDto } from '../domain/types';
import { toPersianDigits } from '../utils/persianFormat';

interface ContractDocsViewProps {
  graph?: GraphResponseDto;
}

export function ContractDocsView({ graph }: ContractDocsViewProps) {
  const [copied, setCopied] = useState(false);
  const [srsContent, setSrsContent] = useState<string | null>(null);
  const [isLoadingSrs, setIsLoadingSrs] = useState(false);

  const handleCopyDto = async () => {
    if (!graph) return;
    await navigator.clipboard.writeText(JSON.stringify(graph, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleSrsViewer = async () => {
    if (srsContent !== null) {
      setSrsContent(null);
      return;
    }
    setIsLoadingSrs(true);
    try {
      const response = await fetch('/assets/aistudio/Dormitory_Graph_Module_SRS_f816063a.md');
      const text = await response.text();
      setSrsContent(text);
    } catch {
      setSrsContent('خطا در بارگذاری فایل سند نیازمندی‌ها.');
    } finally {
      setIsLoadingSrs(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-20 pb-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
            مستندات معماری و قرارداد Graph DTO
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-3xl leading-relaxed">
            پیاده‌سازی کامل نسخه ۱.۰ ماژول Dormitory Graph بر پایه سند نیازمندی‌های سامانه
            University Graph با الگوریتم چیدمان سلسله‌مراتبی قطعی و جداسازی کامل شناسه گره از شناسه
            دیتابیس.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleSrsViewer}
          disabled={isLoadingSrs}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          {srsContent !== null ? (
            <>
              <X className="w-4 h-4 text-slate-400" />
              <span>بستن متن کامل سند نیازمندی‌ها</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-sky-400" />
              <span>{isLoadingSrs ? 'در حال دریافت سند...' : 'مطالعه متن کامل سند (SRS)'}</span>
            </>
          )}
        </button>
      </div>

      {srsContent !== null && (
        <section
          aria-label="متن کامل سند نیازمندی‌های ماژول خوابگاه"
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-100">
              متن مرجع سند تحلیل و طراحی ماژول اول: نقشه تعاملی خوابگاه دانشجویان
            </h2>
            <button
              type="button"
              onClick={() => setSrsContent(null)}
              aria-label="بستن متن سند"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 leading-7 max-h-96 overflow-y-auto px-1">
            {srsContent}
          </pre>
        </section>
      )}

      {/* Node & Edge Specification Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
            <h2 className="text-sm font-bold text-slate-100">انواع گره‌های استاندارد (بند ۵.۲)</h2>
          </div>
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-medium">موجودیت</th>
                <th className="py-2.5 px-4 font-medium">کد entityType</th>
                <th className="py-2.5 px-4 font-medium">سطح عمودی (Y)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">خوابگاه</td>
                <td className="py-2.5 px-4 font-mono">dormitory</td>
                <td className="py-2.5 px-4 tabular-nums">{toPersianDigits(50)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">ساختمان</td>
                <td className="py-2.5 px-4 font-mono">building</td>
                <td className="py-2.5 px-4 tabular-nums">{toPersianDigits(220)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">طبقه</td>
                <td className="py-2.5 px-4 font-mono">floor</td>
                <td className="py-2.5 px-4 tabular-nums">{toPersianDigits(390)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">اتاق</td>
                <td className="py-2.5 px-4 font-mono">room</td>
                <td className="py-2.5 px-4 tabular-nums">{toPersianDigits(560)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">دانشجو</td>
                <td className="py-2.5 px-4 font-mono">student</td>
                <td className="py-2.5 px-4 tabular-nums">{toPersianDigits(750)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
            <h2 className="text-sm font-bold text-slate-100">انواع یال‌های ارتباطی (بند ۵.۳)</h2>
          </div>
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-medium">عنوان رابطه</th>
                <th className="py-2.5 px-4 font-medium">کد relationType</th>
                <th className="py-2.5 px-4 font-medium">مبدأ به مقصد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">شامل ساختمان</td>
                <td className="py-2.5 px-4 font-mono">contains_building</td>
                <td className="py-2.5 px-4">خوابگاه ← ساختمان</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">شامل طبقه</td>
                <td className="py-2.5 px-4 font-mono">contains_floor</td>
                <td className="py-2.5 px-4">ساختمان ← طبقه</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">شامل اتاق</td>
                <td className="py-2.5 px-4 font-mono">contains_room</td>
                <td className="py-2.5 px-4">طبقه ← اتاق</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-100">دارای ساکن</td>
                <td className="py-2.5 px-4 font-mono">has_resident</td>
                <td className="py-2.5 px-4">اتاق ← دانشجو</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Graph DTO Payload Inspector */}
      <section aria-labelledby="live-dto-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="live-dto-heading" className="text-base font-bold text-slate-100">
              خروجی زنده Graph DTO برای نشست فعلی
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              پاسخ دریافتی از <span className="font-mono">GET /api/v1/graph/dormitory/me</span> پس
              از پالایش فیلدهای حریم خصوصی و محاسبه مختصات ثابت:
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyDto}
            disabled={!graph}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'کپی شد' : 'کپی JSON'}</span>
          </button>
        </div>

        <pre
          dir="ltr"
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto max-h-[460px] leading-relaxed"
        >
          {graph ? JSON.stringify(graph, null, 2) : 'در حال بارگذاری قرارداد داده...'}
        </pre>
      </section>
    </div>
  );
}
