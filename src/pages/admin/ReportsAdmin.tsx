import React, { useState, useMemo, useRef } from 'react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

// Enhanced SVG bar chart component
const EnhancedRevenueChart: React.FC<{ data: any[]; height?: number }> = ({ data, height = 240 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const n = data.length;
  const margin = { top: 20, right: 16, bottom: 40, left: 64 };
  const viewW = Math.max(600, n * 28 + margin.left + margin.right);
  const viewH = height;

  const maxRevenue = useMemo(() => Math.max(...data.map((d: any) => Number(d.revenue) || 0), 0) || 1, [data]);
  const innerW = viewW - margin.left - margin.right;
  const innerH = viewH - margin.top - margin.bottom;

  const [hover, setHover] = useState<number | null>(null);

  const fmt = (v: number) => v.toLocaleString('vi-VN') + '₫';

  // grid ticks (4 lines + 0)
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={containerRef} className="w-full relative">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height={viewH}>
        <defs>
          <linearGradient id="barGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="barGradHover" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* Y grid lines and labels */}
        {ticks.map((t, i) => {
          const y = margin.top + (1 - t) * innerH;
          const val = Math.round(maxRevenue * t);
          return (
            <g key={i}>
              <line x1={margin.left} x2={viewW - margin.right} y1={y} y2={y} stroke="#e6eefb" strokeWidth={1} />
              <text x={margin.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill="#6b7280">{fmt(val)}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d: any, i: number) => {
          const value = Number(d.revenue) || 0;
          const barW = Math.max(6, innerW / n * 0.72);
          const step = innerW / n;
          const x = margin.left + i * step + (step - barW) / 2;
          const h = (value / maxRevenue) * innerH;
          const y = margin.top + (innerH - h);
          const isHover = hover === i;
          const label = (d.day || '').split('-')[2] || '';
          return (
            <g key={d.day || i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(1, h)}
                rx={4}
                fill={isHover ? 'url(#barGradHover)' : 'url(#barGrad)'}
                style={{ transition: 'fill 150ms, transform 150ms' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
              />

              {/* day label */}
              <text x={x + barW / 2} y={viewH - 8} fontSize={11} fill="#4b5563" textAnchor="middle">{label}</text>
            </g>
          );
        })}
      </svg>

      {/* tooltip */}
      {hover !== null && data[hover] && (
        <div className="absolute z-10 pointer-events-none" style={{ left: `${((hover + 0.5) / n) * 100}%`, transform: 'translateX(-50%)', top: 8 }}>
          <div className="bg-white border rounded-md shadow px-3 py-1 text-sm text-gray-800">
            <div className="font-semibold">{data[hover].day}</div>
            <div className="text-sm text-green-600">{fmt(Number(data[hover].revenue) || 0)}</div>
            <div className="text-xs text-gray-600">{data[hover].orders} đơn • {data[hover].items} sp</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportsAdmin: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/admin/reports/monthly?year=${reportYear}&month=${reportMonth}`, { headers: headersWithKey() });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status} - ${text.slice(0,200)}`);
      }
      if (!ct.includes('application/json')) {
        const text = await resp.text();
        throw new Error('Expected JSON from backend but received: ' + text.slice(0,200));
      }
      const body = await resp.json();
      setReport(body);
    } catch (e: any) {
      console.error('fetchReport', e);
      alert('Không thể tải báo cáo: ' + (e.message || e));
    } finally { setReportLoading(false); }
  };

  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">📊 Báo cáo Doanh thu</h2>
      
      <div className="mb-6 flex items-center gap-3 bg-gray-50 p-4 rounded-lg">
        <label className="font-semibold text-gray-700">Chọn tháng:</label>
        <select value={reportMonth} onChange={e=>setReportMonth(Number(e.target.value))} className="border rounded-lg px-4 py-2 bg-white">
          {Array.from({length:12}).map((_,i)=> <option key={i+1} value={i+1}>{monthNames[i]}</option>)}
        </select>
        <input type="number" value={reportYear} onChange={e=>setReportYear(Number(e.target.value))} className="border rounded-lg px-4 py-2 w-32 bg-white" placeholder="Năm" />
        <button onClick={fetchReport} className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold">
          Xem báo cáo
        </button>
      </div>

      {reportLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Đang tải báo cáo...</p>
        </div>
      ) : report ? (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
              <div className="text-sm opacity-90 mb-1">Tổng doanh thu</div>
              <div className="text-3xl font-black">{Number(report.totals?.revenue || 0).toLocaleString('vi-VN')}₫</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
              <div className="text-sm opacity-90 mb-1">Tổng đơn hàng</div>
              <div className="text-3xl font-black">{report.totals?.orders || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
              <div className="text-sm opacity-90 mb-1">Sản phẩm bán ra</div>
              <div className="text-3xl font-black">{report.totals?.items || 0}</div>
            </div>
          </div>

          {/* Daily Breakdown */}
          <h4 className="text-lg font-bold mb-4">📅 Phân bố theo ngày</h4>
          {report.breakdown && report.breakdown.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.breakdown.map((b:any) => (
                <div key={b.day} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-sm text-gray-500 mb-2">{b.day}</div>
                  <div className="text-xl font-bold text-green-600">{Number(b.revenue).toLocaleString('vi-VN')}₫</div>
                  <div className="text-sm text-gray-600 mt-1">{b.orders} đơn • {b.items} sản phẩm</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Không có dữ liệu trong tháng này</p>
          )}

          {/* Enhanced SVG Bar Chart */}
          {report.breakdown && report.breakdown.length > 0 && (
            <div className="mt-8">
              <h4 className="text-lg font-bold mb-4">📈 Biểu đồ doanh thu</h4>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                {/* chart container */}
                <div className="relative w-full">
                  <EnhancedRevenueChart data={report.breakdown} height={240} />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Chọn tháng và nhấn "Xem báo cáo" để xem dữ liệu</p>
        </div>
      )}
    </div>
  );
};

export default ReportsAdmin;
