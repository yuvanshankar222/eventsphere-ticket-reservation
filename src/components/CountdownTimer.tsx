import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  initialSeconds: number;
  onExpire?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ initialSeconds, onExpire }) => {
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, initialSeconds));

  useEffect(() => {
    setSecondsLeft(Math.max(0, initialSeconds));
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isCritical = secondsLeft < 120;
  const isExpired = secondsLeft === 0;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
        isExpired
          ? 'bg-rose-50 border-rose-300 text-rose-700'
          : isCritical
          ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
          : 'bg-indigo-50 border-indigo-200 text-indigo-700'
      }`}
    >
      {isCritical || isExpired ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      <span>
        {isExpired ? 'Reservation Expired' : `${formatted} remaining`}
      </span>
    </div>
  );
};
