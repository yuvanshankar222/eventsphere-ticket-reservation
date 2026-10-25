import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { apiRequest } from '../services/api';
import { CheckCircle2, Calendar, MapPin, Ticket, ArrowRight, Download, Share2 } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface ConfirmationPageProps {
  orderId: string;
  navigate: (path: string) => void;
}

export const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ orderId, navigate }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await apiRequest<{ order: Order }>(`/orders/${orderId}`);
        setOrder(res.order);
      } catch (err) {
        console.error('Failed to load order:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 px-4 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-slate-500 text-sm mt-3">Loading confirmation...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
        <button
          onClick={() => navigate('/events')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          Explore Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Booking Confirmed!
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Your ticket reservation is confirmed. We've recorded this transaction in your account.
          </p>

          <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Order Number: </span>
              <strong className="text-indigo-600 font-mono text-sm">{order.orderNumber}</strong>
            </div>
            {order.payment?.paymentReference && (
              <div>
                <span className="text-slate-400 font-medium">Payment Ref: </span>
                <strong className="text-slate-700 font-mono">{order.payment.paymentReference}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Ticket Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start justify-between border-b border-slate-100 pb-5 gap-4">
            <div>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase">
                Confirmed Ticket
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{order.eventTitle}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    {order.startDate
                      ? new Date(order.startDate).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Date confirmed'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-500" />
                  <span>{order.venue}, {order.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Summary</h4>
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-bold text-slate-900">{item.ticketNameSnapshot}</div>
                  <div className="text-slate-500">
                    {item.quantity} × {formatCurrency(item.unitPriceSnapshot, order.currency)}
                  </div>
                </div>
                <div className="font-extrabold text-slate-900">
                  {formatCurrency(item.subtotal, order.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
            <span className="font-bold text-slate-700 text-sm">Total Paid</span>
            <span className="text-xl font-extrabold text-indigo-600">
              {formatCurrency(order.totalAmount, order.currency)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/my-bookings')}
              className="w-full sm:flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm text-center"
            >
              View in My Bookings
            </button>
            <button
              onClick={() => navigate('/events')}
              className="w-full sm:flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors text-center"
            >
              Explore More Events
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
