import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import {
  TrendingUp,
  DollarSign,
  Ticket,
  Percent,
  Calendar,
  Filter,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

export const OrganizerAnalyticsPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [data, setData] = useState<{
    revenueOverTime: Array<{ date: string; revenue: number; orders: number }>;
    ticketsByCategory: Array<{ category: string; sold: number; held: number; available: number }>;
    revenueByEvent: Array<{ id: string; title: string; revenue: number; ordersCount: number }>;
    bookingAttempts: Array<{ status: string; count: number }>;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await apiRequest<any>('/organizer/analytics');
        setData(res);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const totalRevenue = data?.revenueByEvent.reduce((sum, e) => sum + Number(e.revenue), 0) || 0;
  const totalTicketsSold = data?.ticketsByCategory.reduce((sum, c) => sum + Number(c.sold), 0) || 0;

  const totalAttempts = data?.bookingAttempts.reduce((sum, a) => sum + Number(a.count), 0) || 0;
  const confirmedAttempts = data?.bookingAttempts.find((a) => a.status === 'CONFIRMED')?.count || 0;
  const conversionRate = totalAttempts > 0 ? ((confirmedAttempts / totalAttempts) * 100).toFixed(1) : '0.0';

  const BAR_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981'];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
            Performance Analytics
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Revenue & Conversion Hub</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Aggregated conversion rates, historical revenue velocity, and category capacity distributions.
          </p>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Conversion Rate</span>
              <Percent className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-600">{conversionRate}%</div>
            <div className="text-[11px] text-slate-500">{confirmedAttempts} of {totalAttempts} attempts settled</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Gross Settled Revenue</span>
              <DollarSign className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-500">Confirmed orders only</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Tickets Sold</span>
              <Ticket className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{totalTicketsSold}</div>
            <div className="text-[11px] text-slate-500">Across active events</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Booking Attempts</span>
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{totalAttempts}</div>
            <div className="text-[11px] text-slate-500">Recorded booking sessions</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Over Time Line Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Revenue Velocity (Daily Settlement)</h3>
            <div className="h-64 w-full">
              {data?.revenueOverTime && data.revenueOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenueOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${val}`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(val), 'Revenue']}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#6366f1' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No historical revenue datapoints yet.
                </div>
              )}
            </div>
          </div>

          {/* Tickets by Category Bar Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Tickets Sold by Category</h3>
            <div className="h-64 w-full">
              {data?.ticketsByCategory && data.ticketsByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ticketsByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="sold" name="Sold" radius={[6, 6, 0, 0]}>
                      {data.ticketsByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No ticket category breakdown yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Revenue by Event Breakdown Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Event Revenue & Conversion Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Event Title</th>
                  <th className="px-6 py-3">Completed Orders</th>
                  <th className="px-6 py-3 text-right">Settled Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data?.revenueByEvent.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{item.title}</td>
                    <td className="px-6 py-3.5">{item.ordersCount}</td>
                    <td className="px-6 py-3.5 font-extrabold text-indigo-600 text-right">
                      {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
