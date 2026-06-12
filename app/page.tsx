import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import NewsWarningBanner from '@/components/layout/NewsWarningBanner';
import SignalFeed from '@/components/signals/SignalFeed';
import SessionClock from '@/components/tools/SessionClock';
import MetricCards from '@/components/dashboard/MetricCards';
import NewsPanel from '@/components/news/NewsPanel';
import WhaleTracker from '@/components/whales/WhaleTracker';

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <NewsWarningBanner />
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">
          <div className="max-w-screen-2xl mx-auto space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Trade<span className="text-emerald-400">IQ</span> Dashboard
              </h1>
              <p className="text-slate-500 text-sm">Live signals · {new Date().toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
            </div>
            <MetricCards />
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
              {/* Signal feed — 3 cols */}
              <div className="xl:col-span-3">
                <SignalFeed />
              </div>
              {/* Right column — 2 cols */}
              <div className="xl:col-span-2 flex flex-col gap-5">
                <SessionClock />
                <WhaleTracker />
                <div className="flex-1 min-h-[400px]">
                  <NewsPanel />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
