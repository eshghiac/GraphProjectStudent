import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Users, X } from 'lucide-react';
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  const currentAccount =
    SESSION_ACCOUNTS.find((a) => a.sessionToken === sessionToken) ?? SESSION_ACCOUNTS[0];
  const activeNavItem = NAV_ITEMS.find((item) => item.tab === activeTab) ?? NAV_ITEMS[0];

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleSelectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      ref={headerRef}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-1.5rem)] max-w-md md:w-auto md:max-w-[94vw]"
    >
      {/* Top Bar */}
      <div className="bg-[#1e1e1e] border border-[#333333] rounded-[10px] px-3 py-1.5 flex items-center justify-between md:justify-start gap-2 md:gap-4 shadow-xl backdrop-blur-md">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleSelectTab(WorkspaceTab.Skills)}
          className="text-xs sm:text-sm font-semibold tracking-tight text-[#e0e0e0] hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-[#7f77dd]" />
          <span>گراف دانشگاه</span>
        </button>

        <div className="w-px h-4 bg-[#333333] hidden md:block" />

        {/* Zone 2: Desktop Navigation Links */}
        <nav
          aria-label="ناوبری اصلی"
          className="hidden md:flex items-center gap-1.5 lg:gap-2 text-xs font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => handleSelectTab(item.tab)}
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

        <div className="w-px h-4 bg-[#333333] hidden md:block" />

        {/* Zone 3: Desktop Session Switcher Button */}
        <div className="hidden md:flex items-center shrink-0">
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

        {/* Mobile Compact Trigger (Active Tab Pill + Dropdown Toggle) */}
        <div className="flex md:hidden items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-top-nav-menu"
            aria-label={isMobileMenuOpen ? 'بستن منو' : 'باز کردن منو'}
            className={`px-2.5 py-1 rounded-[7px] border text-xs font-medium transition-colors flex items-center gap-1.5 min-w-0 ${
              isMobileMenuOpen
                ? 'bg-[#7f77dd]/20 border-[#7f77dd] text-white'
                : 'bg-[#252525] border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#2e2e2e]'
            }`}
          >
            <span className="truncate max-w-[130px]">{activeNavItem.label}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#a78bfa] shrink-0 transition-transform duration-200 ${
                isMobileMenuOpen ? 'rotate-180' : ''
              }`}
            />
            <span className="w-px h-3.5 bg-[#3a3a3a] mx-0.5 shrink-0" />
            {isMobileMenuOpen ? (
              <X className="w-4 h-4 text-[#e0e0e0] shrink-0" />
            ) : (
              <Menu className="w-4 h-4 text-[#e0e0e0] shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Dropdown Menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-top-nav-menu"
          role="dialog"
          aria-label="منوی ناوبری موبایل"
          className="md:hidden mt-2 bg-[#1e1e1e]/95 border border-[#333333] rounded-[10px] p-2 shadow-2xl backdrop-blur-md space-y-1"
        >
          <nav aria-label="گزینه‌های منوی موبایل" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => handleSelectTab(item.tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full px-3 py-2 rounded-[7px] text-right text-xs transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-[#2a2a2a] text-white font-semibold border border-[#7f77dd]/45'
                      : 'text-[#b0b0b0] hover:text-white hover:bg-[#252525] border border-transparent'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#7f77dd] shrink-0" />}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[#2c2c2c] pt-2 mt-1.5">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setSessionDialogOpen(true);
              }}
              className="w-full px-3 py-2 rounded-[7px] bg-[#252525] hover:bg-[#2e2e2e] border border-[#3a3a3a] text-xs text-[#e0e0e0] transition-colors flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-1.5 text-[#a78bfa]">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>تغییر نشست دانشجو</span>
              </span>
              <span className="text-[11px] text-[#b0b0b0] truncate">{currentAccount.displayName}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
