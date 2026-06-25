import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Users, BarChart3, FileText, Key, LogOut, Menu, X } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const sidebarLinks = [
    { name: 'Dashboard', url: 'https://dashboard.ackadem.com/index', icon: LayoutDashboard },
    { name: 'Courses', url: 'https://dashboard.ackadem.com/courses/', icon: BookOpen },
    { name: 'Users', url: 'https://dashboard.ackadem.com/users/', icon: Users },
    { name: 'Reports', url: 'https://dashboard.ackadem.com/reports/', icon: BarChart3 },
    { name: 'Blogs', url: 'https://dashboard.ackadem.com/blogs/', icon: FileText },
    { name: 'Access Codes', url: 'https://dashboard.ackadem.com/accescode/', icon: Key },
  ];

  return (
    <div className="min-h-screen bg-bg-light flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-brand-dark text-white p-4 flex items-center justify-between shadow-md z-20">
        <img 
          src="https://dashboard.ackadem.com/static/img/base-logo.png" 
          alt="Ackadem Logo" 
          className="h-8 object-contain"
        />
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 hover:bg-white/10 rounded-md transition-colors"
        >
          {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-brand-dark text-white flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo Area */}
        <div className="h-20 flex items-center px-6 border-b border-white/10">
          <img 
            src="https://dashboard.ackadem.com/static/img/base-logo.png" 
            alt="Ackadem Logo" 
            className="h-10 object-contain"
          />
        </div>

        {/* Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a 
                key={link.name} 
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <Icon className="w-5 h-5 mr-3" />
                {link.name}
              </a>
            );
          })}

          {/* Current Active Tool (Our Extension) */}
          <div className="flex items-center px-4 py-3 text-sm font-medium text-white bg-white/20 rounded-lg shadow-inner">
            <BookOpen className="w-5 h-5 mr-3" />
            Digital Publication
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-white/10">
          <a 
            href="https://dashboard.ackadem.com/logout/"
            className="flex items-center px-4 py-3 text-sm font-medium text-slate-300 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full relative h-screen overflow-y-auto bg-bg-light">
        {/* Backdrop for mobile sidebar */}
        {isMobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-20 md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}
        
        {/* White Top Header */}
        <header className="bg-white h-16 border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
          <div className="flex items-center text-sm text-slate-500">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            <span>Dashboard</span>
            <span className="mx-2">/</span>
            <span className="text-brand-dark font-medium">Digital Publication</span>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
