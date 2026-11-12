import { useEffect } from 'react';
import { X } from 'lucide-react';
import { SESSION_ACCOUNTS } from '../domain/mockDatabase';
import { AccommodationStatus } from '../domain/types';
import { useGraphStore } from '../store/useGraphStore';
import { toPersianDigits } from '../utils/persianFormat';

const STATUS_DESCRIPTIONS: Record<AccommodationStatus, string> = {
  [AccommodationStatus.Active]: 'اسکان فعال',
  [AccommodationStatus.NotAssigned]: 'بدون تخصیص اتاق',
  [AccommodationStatus.AssignmentPending]: 'در انتظار تأیید',
  [AccommodationStatus.AssignmentEnded]: 'پایان‌یافته',
  [AccommodationStatus.DataIncomplete]: 'داده ناقص در مرجع',
};

export function SessionSwitcherModal() {
  const isOpen = useGraphStore((s) => s.isSessionDialogOpen);
  const setOpen = useGraphStore((s) => s.setSessionDialogOpen);
  const activeToken = useGraphStore((s) => s.sessionToken);
  const setSessionToken = useGraphStore((s) => s.setSessionToken);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-dialog-title"
        className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 id="session-dialog-title" className="text-lg font-bold text-slate-100">
              انتخاب نشست احراز هویت دانشجو
            </h2>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              طبق بند ۶.۳ سند، شناسه دانشجو صرفاً از توکن نشست Backend استخراج می‌شود. برای بررسی
              سناریوهای مختلف اسکان، یکی از حساب‌های آزمایشی زیر را انتخاب کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="بستن پنجره انتخاب نشست"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
          {SESSION_ACCOUNTS.map((account, idx) => {
            const isSelected = account.sessionToken === activeToken;
            return (
              <button
                key={account.sessionToken}
                type="button"
                onClick={() => setSessionToken(account.sessionToken)}
                className={`w-full text-right py-3.5 px-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  isSelected ? 'bg-sky-950/40' : 'hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <span className="font-mono tabular-nums text-slate-500">
                      {toPersianDigits(idx + 1)}.
                    </span>
                    <span>{account.displayName}</span>
                    {isSelected && <span className="text-xs text-sky-400">· نشست فعال</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {toPersianDigits(account.roleLabel)} · {account.scenarioTitle}
                  </p>
                </div>
                <span className="text-xs text-slate-300 whitespace-nowrap shrink-0">
                  وضعیت: {STATUS_DESCRIPTIONS[account.expectedStatus]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
