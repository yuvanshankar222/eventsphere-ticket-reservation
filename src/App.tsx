import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
import { OrganizerEventFormPage } from './pages/OrganizerEventFormPage';
import { OrganizerTicketsPage } from './pages/OrganizerTicketsPage';
import { OrganizerAnalyticsPage } from './pages/OrganizerAnalyticsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300">
            EventSphere Initializing...
          </span>
        </div>
      </div>
    );
  }

  // Routing Logic
  const renderRoute = () => {
    const path = currentPath.split('?')[0];

    // Public Routes
    if (path === '/') return <HomePage navigate={navigate} />;
    if (path === '/events') {
      const searchParams = new URLSearchParams(window.location.search);
      const q = searchParams.get('search') || '';
      return <EventsPage navigate={navigate} initialQuery={q} />;
    }
    if (path.startsWith('/events/')) {
      const eventId = path.replace('/events/', '');
      return <EventDetailPage eventId={eventId} navigate={navigate} />;
    }
    if (path === '/login') return <LoginPage navigate={navigate} />;
    if (path === '/register') return <RegisterPage navigate={navigate} />;

    // Attendee Routes
    if (path === '/my-bookings') {
      if (!user) return <LoginPage navigate={navigate} />;
      return <MyBookingsPage navigate={navigate} />;
    }
    if (path.startsWith('/checkout/')) {
      const reservationId = path.replace('/checkout/', '');
      if (!user) return <LoginPage navigate={navigate} />;
      return <CheckoutPage reservationId={reservationId} navigate={navigate} />;
    }
    if (path.startsWith('/booking-confirmation/')) {
      const orderId = path.replace('/booking-confirmation/', '');
      return <ConfirmationPage orderId={orderId} navigate={navigate} />;
    }

    // Organizer Routes
    if (path.startsWith('/organizer/')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (user.role !== 'ORGANIZER' && user.role !== 'ADMIN') {
        return <UnauthorizedPage navigate={navigate} />;
      }

      if (path === '/organizer/dashboard') return <OrganizerDashboardPage navigate={navigate} />;
      if (path === '/organizer/events/new') return <OrganizerEventFormPage navigate={navigate} />;
      if (path.includes('/tickets')) {
        // e.g. /organizer/events/:id/tickets
        const parts = path.split('/');
        const eventId = parts[3];
        return <OrganizerTicketsPage eventId={eventId} navigate={navigate} />;
      }
      if (path.includes('/edit')) {
        // e.g. /organizer/events/:id/edit
        const parts = path.split('/');
        const eventId = parts[3];
        return <OrganizerEventFormPage eventId={eventId} navigate={navigate} />;
      }
      if (path === '/organizer/analytics') return <OrganizerAnalyticsPage navigate={navigate} />;
      return <OrganizerDashboardPage navigate={navigate} />;
    }

    // Admin Routes
    if (path.startsWith('/admin')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (user.role !== 'ADMIN') {
        return <UnauthorizedPage navigate={navigate} />;
      }
      return <AdminDashboardPage navigate={navigate} />;
    }

    if (path === '/unauthorized') return <UnauthorizedPage navigate={navigate} />;

    return <NotFoundPage navigate={navigate} />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <Navbar currentPath={currentPath} navigate={navigate} />
      <main className="flex-1">{renderRoute()}</main>
      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
