import React, { useState, useEffect } from 'react';
import { Event } from '../types';
import { apiRequest } from '../services/api';
import {
  Calendar,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Search,
  Tag,
  Lock,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface HomePageProps {
  navigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await apiRequest<{ events: Event[] }>('/events?limit=6');
        setFeaturedEvents(res.events || []);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/events');
    }
  };

  const categories = [
    { name: 'Technology', count: '12+ Events', icon: Zap },
    { name: 'Music & Concerts', count: '8+ Events', icon: Tag },
    { name: 'Business & Finance', count: '15+ Events', icon: TrendingUp },
    { name: 'Food & Drink', count: '6+ Events', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-900 text-white pt-20 pb-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold mb-6 backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Zero-Oversell Concurrency Engine • PostgreSQL Row Locks</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Reserve Premier Event Tickets with{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              Guaranteed Hold Windows
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            EventSphere powers multi-tenant conferences, concerts, and summits with transactional 10-minute hold reservation timers, real-time analytics, and instant simulated settlement.
          </p>

          {/* Quick Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="max-w-3xl mx-auto bg-white p-2 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-2 border border-slate-200"
          >
            <div className="flex items-center gap-3 px-4 py-2 w-full text-slate-700">
              <Search className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search summits, concerts, venues, or cities..."
                className="w-full bg-transparent focus:outline-none text-sm placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 flex-shrink-0"
            >
              <span>Find Tickets</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Architecture Trust Highlights */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold mb-1">
                <Lock className="w-3.5 h-3.5" />
                Row Locking
              </div>
              <div className="text-[11px] text-slate-400">PostgreSQL ACID transactions eliminate double-booking.</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" />
                10-Min Holds
              </div>
              <div className="text-[11px] text-slate-400">Inventory returns safely if checkout is unfulfilled.</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tenant Isolation
              </div>
              <div className="text-[11px] text-slate-400">Organizers control private inventory & revenue data.</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold mb-1">
                <Zap className="w-3.5 h-3.5" />
                Redis Caching
              </div>
              <div className="text-[11px] text-slate-400">Low-latency public catalog with auto-invalidation.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.name}
                onClick={() => navigate(`/events?category=${encodeURIComponent(c.name)}`)}
                className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-md hover:shadow-lg hover:border-indigo-300 transition-all text-left flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                  <div className="text-slate-500 text-xs">{c.count}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Featured Events
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Live events with verified ticket inventories and instant reservation holds.
            </p>
          </div>
          <button
            onClick={() => navigate('/events')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>View All Events</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse space-y-3">
                <div className="h-48 bg-slate-200 rounded-xl"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : featuredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No events found</h3>
            <p className="text-slate-500 text-sm mt-1">Check back shortly or create a new event as an organizer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => navigate(`/events/${evt.slug || evt.id}`)}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer flex flex-col group"
              >
                {/* Event Image Banner */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src={evt.imageUrl}
                    alt={evt.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-md text-slate-800 shadow-sm">
                      {evt.category}
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-md">
                      From {formatCurrency(evt.startingPrice)}
                    </span>
                  </div>
                </div>

                {/* Event Meta Details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(evt.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {evt.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{evt.venue}, {evt.city}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Organized by <strong className="text-slate-700">{evt.organizerName}</strong>
                    </span>
                    <span className="font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Reserve <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
