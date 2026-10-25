import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { apiRequest } from '../services/api';
import { Ticket, Calendar, MapPin, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface MyBookingsPageProps {
  navigate: (path: string) => void;
}

export const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ navigate }) => {
  const [bookings, setBookings] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookings() {
      try {
        const res = await apiRequest<{ bookings: Order[] }>('/orders/attendee/bookings');
        setBookings(res.bookings || []);
      } catch (err) {
        console.error('Error fetching bookings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Bookings</h1>
            <p className="text-slate-500 text-sm mt-1">
              Review your confirmed event tickets, references, and transaction histories.
            </p>
          </div>
          <button
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
          >
            Find Events
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse space-y-3">
                <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto">
            <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No Bookings Yet</h3>
            <p className="text-slate-500 text-sm mt-1">
              You haven't reserved any tickets yet. Explore upcoming events to book your passes.
            </p>
            <button
              onClick={() => navigate('/events')}
              className="mt-5 px-5 py-2.5 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Discover Events
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const isConfirmed = booking.status === 'CONFIRMED';
              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {booking.status}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        Ref: {booking.orderNumber}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {booking.eventTitle}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>
                          {booking.startDate
                            ? new Date(booking.startDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Date TBA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-purple-500" />
                        <span>{booking.venue}, {booking.city}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">Total Paid</div>
                      <div className="text-lg font-extrabold text-slate-900">
                        {formatCurrency(booking.totalAmount, booking.currency)}
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/booking-confirmation/${booking.id}`)}
                      className="px-4 py-2 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-indigo-700 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1"
                    >
                      <span>Receipt</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
