import { useQuery } from '@tanstack/react-query';
import { AccommodationSummaryView } from './components/AccommodationSummaryView';
import { ContractDocsView } from './components/ContractDocsView';
import { GraphCanvasWorkspace } from './components/GraphCanvasWorkspace';
import { SecurityPrivacyView } from './components/SecurityPrivacyView';
import { SessionSwitcherModal } from './components/SessionSwitcherModal';
import { SkillsGraphWorkspace } from './components/SkillsGraphWorkspace';
import { TopNavHeader } from './components/TopNavHeader';
import { WorkspaceTab } from './domain/types';
import { fetchMyDormitoryGraph } from './services/api';
import { useGraphStore } from './store/useGraphStore';

export default function App() {
  const sessionToken = useGraphStore((s) => s.sessionToken);
  const activeTab = useGraphStore((s) => s.activeTab);
  const simulateServerOutage = useGraphStore((s) => s.simulateServerOutage);

  const graphQuery = useQuery({
    queryKey: ['dormitory-graph-me', sessionToken, simulateServerOutage],
    queryFn: () => fetchMyDormitoryGraph(sessionToken, simulateServerOutage),
    retry: false,
  });

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#141414] text-[#e0e0e0] overflow-hidden relative">
      <TopNavHeader />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeTab === WorkspaceTab.Skills && (
          <SkillsGraphWorkspace sessionToken={sessionToken} />
        )}

        {activeTab === WorkspaceTab.Graph && (
          <GraphCanvasWorkspace
            graph={graphQuery.data}
            isLoading={graphQuery.isLoading}
            isFetching={graphQuery.isFetching}
            error={graphQuery.error instanceof Error ? graphQuery.error : null}
            onRefetch={() => {
              void graphQuery.refetch();
            }}
          />
        )}

        {activeTab === WorkspaceTab.Summary && (
          <AccommodationSummaryView
            graph={graphQuery.data}
            isLoading={graphQuery.isLoading}
            error={graphQuery.error instanceof Error ? graphQuery.error : null}
            onRefetch={() => {
              void graphQuery.refetch();
            }}
          />
        )}

        {activeTab === WorkspaceTab.Security && <SecurityPrivacyView />}

        {activeTab === WorkspaceTab.Contract && <ContractDocsView graph={graphQuery.data} />}
      </main>

      <SessionSwitcherModal />
    </div>
  );
}
