import { useState } from 'react';
import { Lock, Play, ShieldAlert, ShieldCheck } from 'lucide-react';
import { runSecurityProbe, SecurityProbeResult } from '../services/api';
import { useGraphStore } from '../store/useGraphStore';
import { toPersianDigits } from '../utils/persianFormat';

interface ProbeScenario {
  id: string;
  title: string;
  srsRef: string;
  description: string;
  method: 'GET' | 'POST' | 'DELETE';
  endpoint: string;
  useSessionToken: boolean;
  expectedHttp: number;
}

const PROBE_SCENARIOS: ProbeScenario[] = [
  {
    id: 'authorized-room',
    title: '۱. دریافت مجاز جزئیات اتاق مرتبط با نشست فعلی',
    srsRef: 'بند ۱۲.۲ · AT-10',
    description: 'بررسی دسترسی مجاز به اتاق ۲۰۵ هنگامی که دانشجوی جاری ساکن فعال آن است.',
    method: 'GET',
    endpoint: '/api/v1/graph/dormitory/rooms/room-205',
    useSessionToken: true,
    expectedHttp: 200,
  },
  {
    id: 'forbidden-other-room',
    title: '۲. تلاش برای مشاهده اتاق غیرمجاز (اتاق ۳۱۲ خوابگاه دیگر)',
    srsRef: 'بند ۱۳.۳ · AT-09',
    description:
      'صرف دانستن شناسه اتاق ۳۱۲ نباید مجوز دسترسی ایجاد کند؛ سرور درخواست را با کد ۴۰۳ رد می‌کند.',
    method: 'GET',
    endpoint: '/api/v1/graph/dormitory/rooms/room-312',
    useSessionToken: true,
    expectedHttp: 403,
  },
  {
    id: 'forbidden-ended-roommate',
    title: '۳. تلاش برای دریافت اطلاعات دانشجوی دارای اسکان پایان‌یافته',
    srsRef: 'بند ۶.۵ · AT-04',
    description:
      'دانشجو stu-105 در نیم‌سال قبل در اتاق ۲۰۵ بوده اما اکنون اسکان فعال ندارد؛ دسترسی رد می‌شود.',
    method: 'GET',
    endpoint: '/api/v1/graph/dormitory/students/stu-105',
    useSessionToken: true,
    expectedHttp: 403,
  },
  {
    id: 'query-spoofing',
    title: '۴. تلاش برای دستکاری شناسه دانشجو در Query String',
    srsRef: 'بند ۶.۳ · AT-09',
    description:
      'ارسال ?studentId=stu-201 به Endpoint گراف توسط سرور شناسایی و با کد ۴۰۳ مسدود می‌شود.',
    method: 'GET',
    endpoint: '/api/v1/graph/dormitory/me?studentId=stu-201',
    useSessionToken: true,
    expectedHttp: 403,
  },
  {
    id: 'mutation-blocked',
    title: '۵. تلاش برای حذف یا تغییر گره از طریق API (فقط‌خواندنی)',
    srsRef: 'بند ۱۰.۱ · AT-07 / AT-08',
    description:
      'غیرفعال بودن دکمه‌ها در رابط کاربری کافی نیست؛ Backend نیز تمام متدهای تغییردهنده را رد می‌کند.',
    method: 'DELETE',
    endpoint: '/api/v1/graph/dormitory/nodes/node-room-room-205',
    useSessionToken: true,
    expectedHttp: 403,
  },
  {
    id: 'unauthenticated-call',
    title: '۶. ارسال درخواست بدون توکن نشست احراز هویت',
    srsRef: 'بند ۱۲.۴ · ۱۳.۱',
    description: 'ارسال درخواست فاقد هدر Authorization با پاسخ ۴۰۱ روبه‌رو می‌شود.',
    method: 'GET',
    endpoint: '/api/v1/graph/dormitory/me',
    useSessionToken: false,
    expectedHttp: 401,
  },
];

export function SecurityPrivacyView() {
  const sessionToken = useGraphStore((s) => s.sessionToken);
  const [probeResult, setProbeResult] = useState<{
    scenarioId: string;
    result: SecurityProbeResult;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunScenario = async (scenario: ProbeScenario) => {
    setIsRunning(true);
    try {
      const res = await runSecurityProbe({
        sessionToken: scenario.useSessionToken ? sessionToken : undefined,
        endpoint: scenario.endpoint,
        method: scenario.method,
      });
      setProbeResult({ scenarioId: scenario.id, result: res });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-20 pb-12 space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
          کنترل دسترسی، امنیت و سیاست حریم خصوصی
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 leading-relaxed max-w-3xl">
          مطابق بخش‌های ۱۰.۲ و ۱۳ سند نیازمندی‌ها، حفاظت از داده‌های شخصی دانشجویان در لایه Backend
          اعمال می‌شود و هیچ فیلد خصوصی حتی به‌صورت مخفی به مرورگر ارسال نمی‌گردد.
        </p>
      </div>

      {/* Field Policy Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>فیلدهای مجاز در قرارداد Graph DTO</span>
          </div>
          <ul className="mt-4 divide-y divide-slate-800 text-xs text-slate-300">
            <li className="py-2.5 flex justify-between gap-4">
              <span>نام نمایشی دانشجو</span>
              <span className="text-slate-400">مجاز برای هم‌اتاقی‌های فعال</span>
            </li>
            <li className="py-2.5 flex justify-between gap-4">
              <span>رشته، دانشکده و سال ورود</span>
              <span className="text-slate-400">تابع تنظیم حریم خصوصی فرد</span>
            </li>
            <li className="py-2.5 flex justify-between gap-4">
              <span>آواتار / نمایه</span>
              <span className="text-slate-400">اختیاری و قابل محدودسازی</span>
            </li>
            <li className="py-2.5 flex justify-between gap-4">
              <span>ساختمان، طبقه، شماره و ظرفیت اتاق</span>
              <span className="text-slate-400">صرفاً برای اتاق دارای تخصیص فعال</span>
            </li>
          </ul>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>فیلدهای حذف‌شده در مرز سرور (هرگز ارسال نمی‌شوند)</span>
          </div>
          <ul className="mt-4 divide-y divide-slate-800 text-xs text-slate-300">
            <li className="py-2.5 flex justify-between gap-4">
              <span>کد ملی (nationalId)</span>
              <span className="text-rose-300">حذف کامل در Backend</span>
            </li>
            <li className="py-2.5 flex justify-between gap-4">
              <span>شماره دانشجویی (studentCode)</span>
              <span className="text-rose-300">عدم نمایش پیش‌فرض (بند ۱۳.۲)</span>
            </li>
            <li className="py-2.5 flex justify-between gap-4">
              <span>شماره تلفن همراه (phoneNumber)</span>
              <span className="text-rose-300">حذف کامل در Backend</span>
            </li>
            <li className="py-2.5 flex justify-between gap-4">
              <span>نشانی منزل و تماس اضطراری</span>
              <span className="text-rose-300">حذف کامل در Backend</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Interactive Live Backend Security Verifier */}
      <section aria-labelledby="security-probes-heading" className="space-y-4">
        <div>
          <h2 id="security-probes-heading" className="text-base font-bold text-slate-100">
            آزمایشگر زنده قوانین امنیتی روی سرور Express
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            هر دکمه یک درخواست واقعی HTTP به سرور ارسال می‌کند تا معیارهای پذیرش AT-04، AT-07،
            AT-08 و AT-09 به‌صورت عینی بررسی شوند.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 border border-slate-800 rounded-xl divide-y divide-slate-800 bg-slate-900/50">
            {PROBE_SCENARIOS.map((sc) => {
              const isCurrent = probeResult?.scenarioId === sc.id;
              return (
                <div
                  key={sc.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrent ? 'bg-slate-800/60' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-100">{sc.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {sc.srsRef} · انتظار وضعیت HTTP {toPersianDigits(sc.expectedHttp)}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{sc.description}</p>
                    <div className="text-[11px] font-mono text-slate-500 pt-0.5" dir="ltr">
                      {sc.method} {sc.endpoint}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleRunScenario(sc)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    <Play className="w-3.5 h-3.5 text-sky-400" />
                    <span>اجرای آزمون</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-100">پاسخ واقعی دریافتی از سرور</h3>
              {probeResult && (
                <span
                  className={`text-xs font-mono tabular-nums font-semibold ${
                    probeResult.result.ok ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  HTTP {probeResult.result.httpStatus}
                </span>
              )}
            </div>

            {!probeResult ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <ShieldAlert className="w-6 h-6 text-slate-500 mx-auto" />
                <p>یکی از سناریوهای سمت راست را اجرا کنید تا خروجی سرور نمایش داده شود.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="text-[11px] font-mono text-left text-slate-400 break-all" dir="ltr">
                  {probeResult.result.method} {probeResult.result.endpoint}
                </div>
                <pre
                  dir="ltr"
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-left text-slate-200 overflow-x-auto max-h-96 leading-relaxed"
                >
                  {JSON.stringify(probeResult.result.responseBody, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
