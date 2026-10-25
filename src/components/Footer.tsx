import React from 'react';
import { Ticket, Shield, Cpu, Lock, Github } from 'lucide-react';

export const Footer: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                <Ticket className="w-4 h-4 transform -rotate-12" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">EventSphere</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-concurrency multi-tenant event & ticket reservation platform. Built with PostgreSQL transactional locking, automated hold expiration, and Redis caching.
            </p>
          </div>

          {/* Platform Columns */}
          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Discovery</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('/events')} className="hover:text-white transition-colors">
                  All Events
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/events?category=Technology')} className="hover:text-white transition-colors">
                  Technology & Cloud
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/events?category=Music')} className="hover:text-white transition-colors">
                  Concerts & Festivals
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/events?category=Business')} className="hover:text-white transition-colors">
                  Business Conclaves
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">For Organizers</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('/organizer/dashboard')} className="hover:text-white transition-colors">
                  Organizer Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/organizer/analytics')} className="hover:text-white transition-colors">
                  Conversion Analytics
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/organizer/events/new')} className="hover:text-white transition-colors">
                  Host an Event
                </button>
              </li>
              <li>
                <a href="/api/docs" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  OpenAPI / Swagger
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Architecture & Safety</h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>PostgreSQL `SELECT FOR UPDATE`</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>10-Minute Asynchronous Expiration</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Multi-Tenant Row-Level Isolation</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>© 2026 EventSphere Inc. All rights reserved. Precision ticket reservation system.</div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Concurrency Engine
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
