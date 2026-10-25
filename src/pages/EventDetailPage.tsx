import React, { useState, useEffect } from 'react';
import { Event, TicketType } from '../types';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Ticket,
  AlertCircle,
  Plus,
  Minus,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface EventDetailPageProps {
  eventId: string;
  navigate: (path: string) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({ eventId, navigate }) => {
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadEventData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiRequest<{ event: Event; ticketTypes: TicketType[] }>(`/events/${eventId}`);
        setEvent(res.event);
        setTicketTypes(res.ticketTypes || []);
        // Initialize 0 quantities
        const initialQty: Record<string, number> = {};
        res.ticketTypes?.forEach((t) => {
          initialQty[t.id] = 0;
        });
        setQuantities(initialQty);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load event details.');
      } finally {
        setLoading(false);
      }
    }
    loadEventData();
  }, [eventId]);

  const updateQuantity = (ticketId: string, delta: number, limit: number, available: number) => {
    const current = quantities[ticketId] || 0;
    const next = Math.max(0, Math.min(Math.min(limit, available), current + delta));
    setQuantities((prev) => ({ ...prev, [ticketId]: next }));
  };

  const selectedItems = Object.entries(quantities)
    .filter(([_, qty]) => qty > 0)
    .map(([tktId, qty]) => {
      const ticket = ticketTypes.find((t) => t.id === tktId)!;
      return {
        ticketTypeId: tktId,
        ticketName: ticket.name,
        unitPrice: parseFloat(String(ticket.price)),
        quantity: qty,
        subtotal: parseFloat(String(ticket.price)) * qty,
      };
    });

  const totalAmount = selectedItems.reduce((acc, i) => acc + i.subtotal, 0);
  const totalTickets = selectedItems.reduce((acc, i) => acc + i.quantity, 0);

  const handleReserve = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (totalTickets === 0) {
      setErrorMsg('Please select at least one ticket before proceeding.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        eventId: event!.id,
        items: selectedItems.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity })),
      };

      const res = await apiRequest<{
        message: string;
        reservation: { reservationId: string; expiresInSeconds: number };
      }>('/reservations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Navigate to checkout with reservation ID
      navigate(`/checkout/${res.reservation.reservationId}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not complete reservation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-slate-200 rounded-3xl"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
          <div className="h-32 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Event Not Found</h2>
        <p className="text-slate-500 text-sm mt-1">{errorMsg || 'The requested event could not be located.'}</p>
        <button
          onClick={() => navigate('/events')}
          className="mt-5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner Card */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="relative h-72 sm:h-96 w-full bg-slate-900">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>

            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-900 shadow">
                {event.category}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow">
                Sales Active
              </span>
            </div>

            <div className="absolute bottom-6 left-6 right-6 text-white">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>
                    {new Date(event.startDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span>{event.venue}, {event.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Host Info */}
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">About this Event</h3>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{event.description}</p>

              <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  {event.organizerName ? event.organizerName[0] : 'O'}
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Hosted by</div>
                  <div className="text-sm font-bold text-slate-800">{event.organizerName}</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3.5 text-xs text-slate-600">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Guaranteed Reservation
              </h4>
              <p className="text-slate-500 leading-relaxed">
                When you proceed to checkout, tickets are atomically locked for <strong>10 minutes</strong> using PostgreSQL row-level locking to prevent oversell.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-slate-200 text-slate-500">
                <div>Venue: <strong className="text-slate-700">{event.venue}</strong></div>
                <div>Address: <strong className="text-slate-700">{event.fullAddress}</strong></div>
                <div>Time Zone: <strong className="text-slate-700">{event.timeZone}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Tier Selection */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                Select Ticket Categories
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Choose ticket quantities. Instant inventory availability is verified in real-time.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Reservation Notice:</strong> {errorMsg}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {ticketTypes.map((tkt) => {
              const available = tkt.availableQuantity !== undefined ? tkt.availableQuantity : tkt.totalQuantity - tkt.soldQuantity - tkt.heldQuantity;
              const isSoldOut = available <= 0;
              const currentQty = quantities[tkt.id] || 0;

              return (
                <div
                  key={tkt.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    currentQty > 0
                      ? 'border-indigo-500 bg-indigo-50/20 shadow-sm'
                      : isSoldOut
                      ? 'border-slate-200 bg-slate-50/60 opacity-60'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{tkt.name}</span>
                        {isSoldOut ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">
                            Sold Out
                          </span>
                        ) : available <= 10 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                            Only {available} Left!
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            {available} Available
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{tkt.description}</p>
                      <div className="text-[11px] text-slate-400">
                        Purchase limit: {tkt.purchaseLimit} per user
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6">
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-slate-900">
                          {formatCurrency(tkt.price, tkt.currency)}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Per Ticket</div>
                      </div>

                      {/* Stepper */}
                      {!isSoldOut ? (
                        <div className="flex items-center gap-2 border border-slate-300 rounded-xl p-1 bg-white">
                          <button
                            type="button"
                            onClick={() => updateQuantity(tkt.id, -1, tkt.purchaseLimit, available)}
                            disabled={currentQty === 0}
                            aria-label={`Decrease quantity for ${tkt.name}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm text-slate-900">
                            {currentQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(tkt.id, 1, tkt.purchaseLimit, available)}
                            disabled={currentQty >= Math.min(tkt.purchaseLimit, available)}
                            aria-label={`Increase quantity for ${tkt.name}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Unavailable</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout Bar */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 font-medium">Selected: {totalTickets} tickets</div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatCurrency(totalAmount)}
              </div>
            </div>

            <button
              onClick={handleReserve}
              disabled={totalTickets === 0 || submitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Locking Inventory...</span>
              ) : (
                <>
                  <span>Reserve & Checkout (10 Min Hold)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
