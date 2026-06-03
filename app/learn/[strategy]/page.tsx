import { use } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import StrategyExplainer from '@/components/education/StrategyExplainer';

export default function LearnPage({ params }: { params: Promise<{ strategy: string }> }) {
  const { strategy } = use(params);
  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <StrategyExplainer strategyKey={strategy} />
        </main>
      </div>
    </div>
  );
}
