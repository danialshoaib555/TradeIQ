import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import NewsWarningBanner from '@/components/layout/NewsWarningBanner';
import SignalFeed from '@/components/signals/SignalFeed';
import SessionClock from '@/components/tools/SessionClock';
import MetricCards from '@/components/dashboard/MetricCards';

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <NewsWarningBanner />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-screen-xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Trade<span className="text-emerald-400">IQ</span> Dashboard
              </h1>
              <p className="text-slate-500 text-sm">Live signals across Forex, Crypto, Stocks &amp; Commodities</p>
            </div>
            <MetricCards />
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3">
                <SignalFeed />
              </div>
              <div className="space-y-6">
                <SessionClock />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
