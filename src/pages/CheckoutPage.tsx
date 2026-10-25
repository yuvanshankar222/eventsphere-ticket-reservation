import React, { useState, useEffect } from 'react';
import { Reservation } from '../types';
import { apiRequest } from '../services/api';
import { CountdownTimer } from '../components/CountdownTimer';
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface CheckoutPageProps {
  reservationId: string;
  navigate: (path: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ reservationId, navigate }) => {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NET_BANKING'>('UPI');
  const [forceOutcome, setForceOutcome] = useState<'SUCCEEDED' | 'FAILED'>('SUCCEEDED');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const loadReservation = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ reservation: Reservation }>(`/reservations/${reservationId}`);
      setReservation(res.reservation);
      if (res.reservation.status === 'EXPIRED' || (res.reservation.remainingSeconds ?? 0) <= 0) {
        setIsExpired(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load reservation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservation();
  }, [reservationId]);

  const handleExpiration = () => {
    setIsExpired(true);
  };

  const handlePay = async () => {
    if (isExpired) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Create order from reservation
      const orderRes = await apiRequest<{ order: { id: string; orderNumber: string } }>('/orders', {
        method: 'POST',
        body: JSON.stringify({ reservationId }),
      });

      // 2. Process simulated payment
      const payRes = await apiRequest<{
        status: string;
        orderId: string;
        paymentReference: string;
        message: string;
      }>('/payments/process', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderRes.order.id,
          paymentMethod,
          forceOutcome,
        }),
      });

      if (payRes.status === 'SUCCEEDED') {
        navigate(`/booking-confirmation/${orderRes.order.id}`);
      } else {
        setErrorMsg(payRes.message || 'Payment simulation was declined.');
      }
    } catch (err: any) {
      if (err.status === 410) {
        setIsExpired(true);
        setErrorMsg('Reservation expired during checkout. Inventory was safely released.');
      } else {
        setErrorMsg(err.message || 'Payment processing encountered an error.');
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded-xl"></div>
          <div className="h-12 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 px-4 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Reservation Not Found</h2>
        <p className="text-slate-500 text-sm mt-1">{errorMsg || 'Could not retrieve this reservation.'}</p>
        <button
          onClick={() => navigate('/events')}
          className="mt-5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          Explore Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with 10-Minute Countdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Checkout & Settlement</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Reservation ID: <code className="font-mono text-indigo-600">{reservation.id}</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">Hold Expiration:</span>
            <CountdownTimer
              initialSeconds={reservation.remainingSeconds || 0}
              onExpire={handleExpiration}
            />
          </div>
        </div>

        {/* Expiration Notice if expired */}
        {isExpired && (
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 text-rose-800 text-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-base">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Reservation Hold Expired
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              The 10-minute reservation window has elapsed. Held tickets have been released back to available inventory to prevent hoarding. Please return to the event page to initiate a fresh reservation.
            </p>
            <button
              onClick={() => navigate(`/events/${reservation.eventId}`)}
              className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
            >
              Start New Reservation
            </button>
          </div>
        )}

        {errorMsg && !isExpired && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-800 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Payment Error:</strong> {errorMsg}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Payment Form */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Select Payment Method
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === 'UPI'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">UPI / QR</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Instant Transfer</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === 'CARD'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">Credit/Debit</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Visa / Mastercard</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('NET_BANKING')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === 'NET_BANKING'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">Net Banking</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Major Indian Banks</div>
                </button>
              </div>

              {/* Simulation Testing Control */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Simulated Gateway Outcome:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForceOutcome('SUCCEEDED')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        forceOutcome === 'SUCCEEDED'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      Force Success
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceOutcome('FAILED')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        forceOutcome === 'FAILED'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      Force Decline
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  This mock payment gateway simulates asynchronous settlement without collecting real card numbers.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePay}
                disabled={isExpired || processing}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {processing ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Settling Payment...
                  </span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay {formatCurrency(reservation.totalAmount, reservation.currency)} & Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                Order Summary
              </h3>

              <div className="space-y-3 text-xs">
                {reservation.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-slate-800">{item.ticketName}</div>
                      <div className="text-slate-400">
                        {item.quantity} × {formatCurrency(item.unitPrice, reservation.currency)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      {formatCurrency(item.subtotal, reservation.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">Total Amount</span>
                <span className="font-extrabold text-slate-900 text-lg">
                  {formatCurrency(reservation.totalAmount, reservation.currency)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-slate-600 space-y-1.5">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Atomic Concurrency Protection
              </div>
              <div>
                Inventory status: <strong>HELD</strong>. Upon payment success, held inventory is permanently converted to <strong>SOLD</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
