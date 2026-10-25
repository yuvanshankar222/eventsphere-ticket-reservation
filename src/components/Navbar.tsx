import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Ticket,
  Calendar,
  Layers,
  BarChart3,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  FileCode,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate }) => {
  const { user, logout, quickLoginAs } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 text-left focus:outline-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Ticket className="w-5 h-5 transform -rotate-12" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 bg-clip-text text-transparent">
                EventSphere
              </span>
              <span className="hidden sm:block text-[10px] tracking-wider uppercase font-semibold text-indigo-600">
                Multi-Tenant Ticket Platform
              </span>
            </div>
          </button>

          {/* Primary Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => handleNav('/events')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPath === '/events'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Explore Events
            </button>

            {user?.role === 'ATTENDEE' && (
              <button
                onClick={() => handleNav('/my-bookings')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPath === '/my-bookings'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                My Bookings
              </button>
            )}

            {(user?.role === 'ORGANIZER' || user?.role === 'ADMIN') && (
              <>
                <button
                  onClick={() => handleNav('/organizer/dashboard')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPath.startsWith('/organizer/dashboard')
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Organizer Hub
                </button>
                <button
                  onClick={() => handleNav('/organizer/analytics')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === '/organizer/analytics'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Analytics
                </button>
              </>
            )}

            {user?.role === 'ADMIN' && (
              <button
                onClick={() => handleNav('/admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPath.startsWith('/admin')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Admin Suite
              </button>
            )}

            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              API Docs
            </a>
          </nav>
        </div>

        {/* Right Action Menu */}
        <div className="flex items-center gap-3">
          {/* Quick Persona Switcher Modal Trigger */}
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
              title="Switch demo persona (Admin, Organizers, Attendee)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Role Switcher</span>
              <span className="sm:hidden">Persona</span>
            </button>

            {switcherOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  Instant Demo Login
                </div>
                <div className="space-y-1.5 text-xs">
                  <button
                    onClick={() => {
                      quickLoginAs('ATTENDEE');
                      setSwitcherOpen(false);
                      handleNav('/events');
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Yuvan Shankar</div>
                      <div className="text-slate-500 text-[11px]">Role: ATTENDEE</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Buyer</span>
                  </button>

                  <button
                    onClick={() => {
                      quickLoginAs('ORGANIZER_APEX');
                      setSwitcherOpen(false);
                      handleNav('/organizer/dashboard');
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Apex Event Management</div>
                      <div className="text-slate-500 text-[11px]">Role: ORGANIZER (Tenant 1)</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">Tenant</span>
                  </button>

                  <button
                    onClick={() => {
                      quickLoginAs('ORGANIZER_SOUNDWAVE');
                      setSwitcherOpen(false);
                      handleNav('/organizer/dashboard');
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">SoundWave Global Live</div>
                      <div className="text-slate-500 text-[11px]">Role: ORGANIZER (Tenant 2)</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Tenant</span>
                  </button>

                  <button
                    onClick={() => {
                      quickLoginAs('ADMIN');
                      setSwitcherOpen(false);
                      handleNav('/admin');
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Platform Administrator</div>
                      <div className="text-slate-500 text-[11px]">Role: ADMIN (Full Audit/Mod)</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">Root</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Status / Login Buttons */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</span>
                <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wide">
                  {user.role}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('/login')}
                className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => handleNav('/register')}
                className="px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <button
            onClick={() => handleNav('/events')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Explore Events
          </button>
          {user?.role === 'ATTENDEE' && (
            <button
              onClick={() => handleNav('/my-bookings')}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              My Bookings
            </button>
          )}
          {(user?.role === 'ORGANIZER' || user?.role === 'ADMIN') && (
            <>
              <button
                onClick={() => handleNav('/organizer/dashboard')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Organizer Hub
              </button>
              <button
                onClick={() => handleNav('/organizer/analytics')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Analytics
              </button>
            </>
          )}
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => handleNav('/admin')}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Admin Suite
            </button>
          )}
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            OpenAPI Documentation
          </a>
        </div>
      )}
    </header>
  );
};
