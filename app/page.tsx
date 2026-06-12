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
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 tracking-tight">
                  Trade<span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">IQ</span> Dashboard
                </h1>
                <p className="text-slate-500 text-sm">Live signals · {new Date().toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
              </div>
              <a href="/demo"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500/20 to-teal-500/15 text-emerald-400 border border-emerald-500/30 hover:from-emerald-500/30 hover:to-teal-500/25 transition-all glow-emerald cursor-pointer w-fit">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Practice Trading — $10K Demo
              </a>
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
