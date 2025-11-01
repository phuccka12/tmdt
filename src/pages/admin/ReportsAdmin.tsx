import React, { useState } from 'react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

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

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Báo cáo Doanh thu</h2>
      <div className="mb-4 flex items-center gap-3">
        <select value={reportMonth} onChange={e=>setReportMonth(Number(e.target.value))} className="border rounded px-3 py-2">
          {Array.from({length:12}).map((_,i)=> <option key={i+1} value={i+1}>{i+1}</option>)}
        </select>
        <input type="number" value={reportYear} onChange={e=>setReportYear(Number(e.target.value))} className="border rounded px-3 py-2 w-28" />
        <button onClick={fetchReport} className="px-4 py-2 bg-black text-white rounded">Xem báo cáo</button>
      </div>

      {reportLoading ? <div>Đang tải...</div> : report ? (
        <div>
          <div className="mb-3">Tổng doanh thu ước tính: <strong className="text-green-600">{report.totals?.revenue || 0}</strong></div>
          <div className="mb-3">Tổng số mặt hàng bán: <strong>{report.totals?.items || 0}</strong></div>
          <h4 className="font-semibold mt-4">Phân bố theo ngày</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {report.breakdown?.map((b:any) => (
              <div key={b.day} className="p-2 bg-white rounded shadow-sm">
                <div className="text-sm text-gray-500">{b.day}</div>
                <div className="font-bold">Doanh thu: {b.revenue}</div>
                <div className="text-sm">Số lượng: {b.items}</div>
              </div>
            ))}
          </div>
        </div>
      ) : <div className="text-gray-500">Chưa có báo cáo</div>}
    </div>
  );
};

export default ReportsAdmin;