import React, { useState, useEffect } from 'react';
import { Event } from '../types';
import { apiRequest } from '../services/api';
import { Calendar, MapPin, ArrowLeft, AlertCircle, Save } from 'lucide-react';

interface OrganizerEventFormPageProps {
  eventId?: string; // If provided, edit mode
  navigate: (path: string) => void;
}

export const OrganizerEventFormPage: React.FC<OrganizerEventFormPageProps> = ({ eventId, navigate }) => {
  const isEdit = Boolean(eventId);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Technology',
    venue: '',
    city: 'Bengaluru',
    fullAddress: '',
    startDate: '',
    endDate: '',
    timeZone: 'Asia/Kolkata',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    salesStartTime: '',
    salesCutoffTime: '',
  });

  useEffect(() => {
    if (!eventId) {
      // Default dates: starts next month, ends 2 days later, sales start now, cutoff 1 day before
      const now = new Date();
      const start = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
      const cutoff = new Date(start.getTime() - 24 * 60 * 60 * 1000);

      setFormData((prev) => ({
        ...prev,
        startDate: start.toISOString().slice(0, 16),
        endDate: end.toISOString().slice(0, 16),
        salesStartTime: now.toISOString().slice(0, 16),
        salesCutoffTime: cutoff.toISOString().slice(0, 16),
      }));
      return;
    }

    async function loadEvent() {
      try {
        const res = await apiRequest<{ event: Event }>(`/events/${eventId}`);
        const e = res.event;
        setFormData({
          title: e.title,
          description: e.description,
          category: e.category,
          venue: e.venue,
          city: e.city,
          fullAddress: e.fullAddress,
          startDate: new Date(e.startDate).toISOString().slice(0, 16),
          endDate: new Date(e.endDate).toISOString().slice(0, 16),
          timeZone: e.timeZone,
          imageUrl: e.imageUrl,
          salesStartTime: new Date(e.salesStartTime).toISOString().slice(0, 16),
          salesCutoffTime: new Date(e.salesCutoffTime).toISOString().slice(0, 16),
        });
      } catch (err: any) {
        setErrorMsg(err.message || 'Could not load event data.');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        salesStartTime: new Date(formData.salesStartTime).toISOString(),
        salesCutoffTime: new Date(formData.salesCutoffTime).toISOString(),
      };

      if (isEdit) {
        await apiRequest(`/events/${eventId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        navigate('/organizer/dashboard');
      } else {
        const res = await apiRequest<{ event: Event }>('/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        // Prompt to add ticket tiers immediately
        navigate(`/organizer/events/${res.event.id}/tickets`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading form...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/organizer/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organizer Hub</span>
        </button>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isEdit ? 'Edit Event Details' : 'Create New Event'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Provide event metadata, venue address, and sales window.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. NextGen AI & Cloud Summit 2026"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="Technology">Technology</option>
                  <option value="Music & Concerts">Music & Concerts</option>
                  <option value="Business & Finance">Business & Finance</option>
                  <option value="Food & Drink">Food & Drink</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Bengaluru"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Venue Name</label>
              <input
                type="text"
                required
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="e.g. BIEC Convention Centre"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Physical Address</label>
              <input
                type="text"
                required
                value={formData.fullAddress}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                placeholder="Complete street address, postal code"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed conference overview, speaker agenda, guidelines..."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Banner Image URL</label>
              <input
                type="url"
                required
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Start Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event End Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ticket Sales Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.salesStartTime}
                  onChange={(e) => setFormData({ ...formData, salesStartTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ticket Sales Cutoff Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.salesCutoffTime}
                  onChange={(e) => setFormData({ ...formData, salesCutoffTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/organizer/dashboard')}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{submitting ? 'Saving...' : isEdit ? 'Update Event' : 'Create & Add Tickets'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
