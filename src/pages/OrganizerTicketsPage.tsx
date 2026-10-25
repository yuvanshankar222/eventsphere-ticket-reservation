import React, { useState, useEffect } from 'react';
import { TicketType, Event } from '../types';
import { apiRequest } from '../services/api';
import { Ticket, Plus, ArrowLeft, AlertCircle, CheckCircle2, Edit2, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface OrganizerTicketsPageProps {
  eventId: string;
  navigate: (path: string) => void;
}

export const OrganizerTicketsPage: React.FC<OrganizerTicketsPageProps> = ({ eventId, navigate }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 2500,
    totalQuantity: 100,
    purchaseLimit: 5,
    salesStartTime: '',
    salesCutoffTime: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [evtRes, tktRes] = await Promise.all([
        apiRequest<{ event: Event }>(`/events/${eventId}`),
        apiRequest<{ ticketTypes: TicketType[] }>(`/events/${eventId}/tickets`),
      ]);
      setEvent(evtRes.event);
      setTicketTypes(tktRes.ticketTypes || []);

      // Default sales window based on event
      if (evtRes.event) {
        setForm((prev) => ({
          ...prev,
          salesStartTime: new Date(evtRes.event.salesStartTime).toISOString().slice(0, 16),
          salesCutoffTime: new Date(evtRes.event.salesCutoffTime).toISOString().slice(0, 16),
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiRequest(`/events/${eventId}/tickets`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          totalQuantity: Number(form.totalQuantity),
          purchaseLimit: Number(form.purchaseLimit),
          salesStartTime: new Date(form.salesStartTime).toISOString(),
          salesCutoffTime: new Date(form.salesCutoffTime).toISOString(),
        }),
      });
      setShowAddModal(false);
      setForm({
        name: '',
        description: '',
        price: 2500,
        totalQuantity: 100,
        purchaseLimit: 5,
        salesStartTime: event?.salesStartTime ? new Date(event.salesStartTime).toISOString().slice(0, 16) : '',
        salesCutoffTime: event?.salesCutoffTime ? new Date(event.salesCutoffTime).toISOString().slice(0, 16) : '',
      });
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating ticket category.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    setErrorMsg(null);
    try {
      await apiRequest(`/tickets/${editingTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingTicket.name,
          description: editingTicket.description,
          price: Number(editingTicket.price),
          totalQuantity: Number(editingTicket.totalQuantity),
          purchaseLimit: Number(editingTicket.purchaseLimit),
        }),
      });
      setEditingTicket(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating ticket category.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/organizer/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organizer Hub</span>
        </button>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Event Inventory Control
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {event?.title || 'Manage Ticket Categories'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure tiered ticket categories, pricing, capacities, and purchase limits.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Ticket Category</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* List of Tiers */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading tickets...</div>
          ) : ticketTypes.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No ticket categories yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Add at least one ticket category (e.g. VIP, Standard, Early Bird) before publishing.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl"
              >
                Create First Ticket
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {ticketTypes.map((tkt) => {
                const available = tkt.totalQuantity - tkt.soldQuantity - tkt.heldQuantity;
                return (
                  <div
                    key={tkt.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{tkt.name}</span>
                        <span className="text-xs font-bold text-indigo-600">
                          {formatCurrency(tkt.price, tkt.currency)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{tkt.description}</p>
                      <div className="text-[11px] text-slate-400">
                        Max {tkt.purchaseLimit} per user
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                      {/* Capacity metrics */}
                      <div className="flex items-center gap-4 text-center text-xs">
                        <div>
                          <div className="font-extrabold text-slate-900">{tkt.totalQuantity}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Total</div>
                        </div>
                        <div>
                          <div className="font-extrabold text-emerald-600">{tkt.soldQuantity}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Sold</div>
                        </div>
                        <div>
                          <div className="font-extrabold text-indigo-600">{tkt.heldQuantity}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Held</div>
                        </div>
                        <div>
                          <div className="font-extrabold text-purple-600">{available}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Avail</div>
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingTicket(tkt)}
                        className="p-2 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Edit Category Capacity"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Ticket Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add Ticket Category</h3>
            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tier Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. VIP Backstage Pass"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is included with this pass"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Capacity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.totalQuantity}
                    onChange={(e) => setForm({ ...form, totalQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Purchase Limit Per User</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={20}
                  value={form.purchaseLimit}
                  onChange={(e) => setForm({ ...form, purchaseLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingTicket && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Edit Category: {editingTicket.name}</h3>
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-slate-600 space-y-1">
              <div>Committed: <strong>{editingTicket.soldQuantity} sold</strong> + <strong>{editingTicket.heldQuantity} held</strong></div>
              <div className="text-slate-400">Total capacity cannot be reduced below committed count ({editingTicket.soldQuantity + editingTicket.heldQuantity}).</div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tier Name</label>
                <input
                  type="text"
                  required
                  value={editingTicket.name}
                  onChange={(e) => setEditingTicket({ ...editingTicket, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={editingTicket.description}
                  onChange={(e) => setEditingTicket({ ...editingTicket, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingTicket.price}
                    onChange={(e) => setEditingTicket({ ...editingTicket, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Capacity</label>
                  <input
                    type="number"
                    required
                    min={editingTicket.soldQuantity + editingTicket.heldQuantity}
                    value={editingTicket.totalQuantity}
                    onChange={(e) => setEditingTicket({ ...editingTicket, totalQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Purchase Limit</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={20}
                  value={editingTicket.purchaseLimit}
                  onChange={(e) => setEditingTicket({ ...editingTicket, purchaseLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                >
                  Update Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
