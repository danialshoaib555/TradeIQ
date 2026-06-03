import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import RiskCalculator from '@/components/tools/RiskCalculator';

export default function RiskPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-screen-xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Risk Calculator</h1>
              <p className="text-slate-500 text-sm">Calculate position size, potential profit/loss, and leverage for any trade</p>
            </div>
            <RiskCalculator />
          </div>
        </main>
      </div>
    </div>
  );
}
