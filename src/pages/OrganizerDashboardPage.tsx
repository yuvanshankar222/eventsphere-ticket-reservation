import React, { useState, useEffect } from 'react';
import { Event, OrganizerMetrics } from '../types';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Ticket,
  DollarSign,
  TrendingUp,
  Plus,
  Edit,
  Clock,
  Layers,
  CheckCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface OrganizerDashboardPageProps {
  navigate: (path: string) => void;
}

export const OrganizerDashboardPage: React.FC<OrganizerDashboardPageProps> = ({ navigate }) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<OrganizerMetrics | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, eventsRes] = await Promise.all([
        apiRequest<{ metrics: OrganizerMetrics }>('/organizer/dashboard'),
        apiRequest<{ events: Event[] }>('/organizer/events'),
      ]);
      setMetrics(metricsRes.metrics);
      setEvents(eventsRes.events || []);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handlePublish = async (eventId: string) => {
    try {
      await apiRequest(`/events/${eventId}/publish`, { method: 'POST' });
      setActionMsg('Event published successfully to public catalog!');
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Could not publish event.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              Tenant Dashboard: {user?.name}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Organizer Hub</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Manage your event catalog, ticket categories, and live capacity allocations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/organizer/analytics')}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-sm transition-colors"
            >
              View Analytics
            </button>
            <button
              onClick={() => navigate('/organizer/events/new')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg(null)} className="font-bold underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Metrics Overview Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Events</span>
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{metrics.totalEvents}</div>
              <div className="text-[11px] text-slate-500">{metrics.publishedEvents} published</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Tickets Sold</span>
                <Ticket className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{metrics.totalSoldTickets}</div>
              <div className="text-[11px] text-indigo-600 font-semibold">{metrics.totalHeldTickets} currently held</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Completed Orders</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{metrics.completedOrders}</div>
              <div className="text-[11px] text-slate-500">{metrics.pendingOrders} pending checkout</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Gross Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatCurrency(metrics.grossRevenue, metrics.currency)}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold">{metrics.conversionRate}% conversion</div>
            </div>
          </div>
        )}

        {/* Events Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Managed Events</h2>
            <span className="text-xs text-slate-400 font-medium">Tenant Isolated (ID: {user?.id})</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No events found for this organizer</p>
              <button
                onClick={() => navigate('/organizer/events/new')}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
              >
                Create First Event
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Event Date</th>
                    <th className="px-6 py-3">Capacity Sold</th>
                    <th className="px-6 py-3">Revenue</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">{evt.title}</div>
                        <div className="text-slate-400 text-[11px]">{evt.venue}, {evt.city}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            evt.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : evt.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {evt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(evt.startDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{evt.totalSold || 0}</span> / {evt.totalCapacity || 0}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {formatCurrency(evt.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => navigate(`/organizer/events/${evt.id}/tickets`)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-[11px] text-slate-700"
                        >
                          Tickets
                        </button>
                        <button
                          onClick={() => navigate(`/organizer/events/${evt.id}/edit`)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-[11px] text-slate-700"
                        >
                          Edit
                        </button>
                        {evt.status === 'DRAFT' && (
                          <button
                            onClick={() => handlePublish(evt.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold text-[11px] text-white shadow-sm"
                          >
                            Publish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
