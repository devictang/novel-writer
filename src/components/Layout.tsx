import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { Feather, Settings, LogOut, Menu, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out');
    navigate('/auth');
  };

  return (
    <div className="flex h-screen flex-col bg-parchment">
      {/* Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="rounded p-1.5 hover:bg-gray-100"
          >
            <Menu size={18} />
          </button>
          <Link to="/workspace" className="flex items-center gap-1.5">
            <Feather size={18} className="text-quill" />
            <span className="font-serif text-sm font-bold text-ink">Golden Quill</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user?.email}</span>
          <Link
            to="/settings"
            className={`rounded p-1.5 hover:bg-gray-100 ${location.pathname === '/settings' ? 'text-quill' : 'text-gray-500'}`}
          >
            <Settings size={16} />
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
            <WorkspaceSidebar />
          </aside>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function WorkspaceSidebar() {
  const { data: works } = useWorksList();

  return (
    <nav className="p-3">
      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Works
      </div>
      {works && works.length > 0 ? (
        <ul className="space-y-0.5">
          {works.map((w) => (
            <li key={w.id}>
              <Link
                to={`/workspace/${w.id}`}
                className="block rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                <BookOpen size={14} className="mr-1.5 inline" />
                {w.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 text-xs text-gray-400">No works yet</p>
      )}
    </nav>
  );
}

// Simple hook to list works — uses supabase directly
import { useQuery } from '@tanstack/react-query';
import type { Work } from '../types';

function useWorksList() {
  return useQuery({
    queryKey: ['works'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('works')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Work[];
    },
  });
}
