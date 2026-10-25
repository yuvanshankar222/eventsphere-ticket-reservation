import React, { useState, useEffect } from 'react';
import { AdminMetrics, User, Event, AuditLog } from '../types';
import { apiRequest } from '../services/api';
import {
  ShieldAlert,
  Users,
  Calendar,
  DollarSign,
  Search,
  CheckCircle,
  AlertTriangle,
  History,
  Lock,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';

export const AdminDashboardPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'events' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [metricsRes, usersRes, eventsRes, auditRes] = await Promise.all([
        apiRequest<{ metrics: AdminMetrics }>('/admin/dashboard'),
        apiRequest<{ users: User[] }>('/admin/users'),
        apiRequest<{ events: Event[] }>('/admin/events'),
        apiRequest<{ auditLogs: AuditLog[] }>('/admin/audit-logs'),
      ]);

      setMetrics(metricsRes.metrics);
      setUsers(usersRes.users || []);
      setEvents(eventsRes.events || []);
      setAuditLogs(auditRes.auditLogs || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const toggleUserStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiRequest(`/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reason: `Admin toggled status to ${nextStatus}` }),
      });
      setStatusMsg(`User ${user.email} status updated to ${nextStatus}.`);
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <div className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Platform Governance & Administration</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Suite</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Platform-wide observability, user account moderation, and tamper-evident audit logs.
          </p>
        </div>

        {statusMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)} className="font-bold underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Global Platform Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Registered Users</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{metrics.totalUsers}</div>
              <div className="text-[11px] text-slate-500">
                {metrics.totalOrganizers} Organizers • {metrics.totalAttendees} Attendees
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Platform Events</span>
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{metrics.totalEvents}</div>
              <div className="text-[11px] text-emerald-600 font-semibold">{metrics.publishedEvents} published live</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Settled Transactions</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{metrics.successfulTransactions}</div>
              <div className="text-[11px] text-slate-500">{metrics.failedTransactions} declined simulations</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Platform Volume</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatCurrency(metrics.platformRevenue, metrics.currency)}
              </div>
              <div className="text-[11px] text-slate-500">Total gross settlements</div>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 transition-colors ${
              activeTab === 'users' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            User Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`pb-3 transition-colors ${
              activeTab === 'events' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            All Events Moderation ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 transition-colors ${
              activeTab === 'audit' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
        </div>

        {/* Tab Content: Users */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, email, or role..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Moderation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-slate-400 text-[11px]">{u.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {u.role !== 'ADMIN' && (
                          <button
                            onClick={() => toggleUserStatus(u)}
                            className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                              u.status === 'ACTIVE'
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Events Moderation */}
        {activeTab === 'events' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Organizer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tickets Sold</th>
                    <th className="px-4 py-3">Start Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{e.title}</div>
                        <div className="text-slate-400 text-[11px]">{e.venue}, {e.city}</div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {e.organizerName}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            e.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : e.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {e.totalSold || 0} / {e.totalCapacity || 0}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {new Date(e.startDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-600">{log.action}</td>
                      <td className="px-4 py-3 text-slate-800">{log.resourceType}</td>
                      <td className="px-4 py-3 text-slate-600">{log.userName || log.userId || 'System'}</td>
                      <td className="px-4 py-3 font-sans text-slate-600">{log.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
