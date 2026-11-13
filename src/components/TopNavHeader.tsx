import { SESSION_ACCOUNTS } from '../domain/mockDatabase';
import { WorkspaceTab } from '../domain/types';
import { useGraphStore } from '../store/useGraphStore';

const NAV_ITEMS: Array<{ tab: WorkspaceTab; label: string }> = [
  { tab: WorkspaceTab.Skills, label: 'نقشه مهارت‌ها' },
  { tab: WorkspaceTab.Graph, label: 'نقشه خوابگاه' },
  { tab: WorkspaceTab.Summary, label: 'مشخصات اسکان' },
  { tab: WorkspaceTab.Security, label: 'امنیت و دسترسی' },
  { tab: WorkspaceTab.Contract, label: 'مستندات' },
];

export function TopNavHeader() {
  const activeTab = useGraphStore((s) => s.activeTab);
  const setActiveTab = useGraphStore((s) => s.setActiveTab);
  const sessionToken = useGraphStore((s) => s.sessionToken);
  const setSessionDialogOpen = useGraphStore((s) => s.setSessionDialogOpen);

  const currentAccount =
    SESSION_ACCOUNTS.find((a) => a.sessionToken === sessionToken) ?? SESSION_ACCOUNTS[0];

  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-40 max-w-[94vw] w-auto">
      <div className="bg-[#1e1e1e] border border-[#333333] rounded-[10px] px-3 py-1.5 flex items-center gap-3 sm:gap-4 shadow-xl backdrop-blur-md">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab(WorkspaceTab.Skills)}
          className="text-xs sm:text-sm font-semibold tracking-tight text-[#e0e0e0] hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-[#7f77dd]" />
          <span>گراف دانشگاه</span>
        </button>

        <div className="w-px h-4 bg-[#333333] hidden sm:block" />

        {/* Zone 2: Navigation Links */}
        <nav
          aria-label="ناوبری اصلی ماژول خوابگاه"
          className="flex items-center gap-1 sm:gap-2 text-xs font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => setActiveTab(item.tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-2.5 py-1 rounded-[6px] transition-colors whitespace-nowrap shrink-0 text-xs ${
                  isActive
                    ? 'bg-[#2a2a2a] text-white font-medium shadow-sm'
                    : 'text-[#888888] hover:text-[#cccccc] hover:bg-[#252525]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="w-px h-4 bg-[#333333]" />

        {/* Zone 3: Session Switcher Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setSessionDialogOpen(true)}
            title="تغییر نشست دانشجو"
            className="px-2.5 py-1 text-xs text-[#b0b0b0] hover:text-white bg-[#252525] hover:bg-[#2e2e2e] border border-[#3a3a3a] rounded-[6px] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <span className="text-[10px] text-[#7f77dd] font-mono">نشست:</span>
            <span>{currentAccount.displayName}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
