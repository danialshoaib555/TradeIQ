import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import EconomicCalendar from '@/components/tools/EconomicCalendar';

export default function CalendarPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Economic Calendar</h1>
              <p className="text-slate-500 text-sm">Avoid trading 30 minutes before and after high-impact events</p>
            </div>
            <EconomicCalendar />
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-6">
              <h3 className="font-semibold text-blue-400 mb-3">How to use the economic calendar</h3>
              <div className="space-y-3 text-sm text-slate-400">
                <p><span className="text-red-400 font-medium">High Impact</span> events move markets significantly. Avoid all open trades 30 minutes before these events.</p>
                <p><span className="text-amber-400 font-medium">Medium Impact</span> events can cause temporary spikes. Consider tightening stops.</p>
                <p><span className="text-slate-400 font-medium">Low Impact</span> events rarely move markets significantly. Normal trading is usually fine.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
