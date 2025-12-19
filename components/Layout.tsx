import React, { useState } from 'react';
import { LayoutDashboard, Database, MessageSquare, Settings, Menu, X, Building2 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan Hệ thống', icon: <LayoutDashboard size={20} /> },
    { id: 'knowledge', label: 'Kho Dữ liệu Pháp lý', icon: <Database size={20} /> },
    { id: 'chat', label: 'Lịch sử Tư vấn', icon: <MessageSquare size={20} /> },
    { id: 'settings', label: 'Cấu hình & Kết nối', icon: <Settings size={20} /> },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans text-slate-800 bg-slate-50/50">
      {/* Mobile Menu Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200 shadow-2xl md:shadow-lg transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Building2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">Dịch Vụ Công</h1>
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Trợ lý AI v3.0</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all duration-200 font-medium text-sm ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className={`${activeTab === item.id ? 'text-white' : 'text-slate-400'}`}>
                {item.icon}
              </div>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
            <span className="text-xs text-emerald-700 font-semibold">Hệ thống đang hoạt động</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Background decorative blobs - More subtle for admin look */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-3xl"></div>
        </div>

        {/* Header */}
        <header className="h-16 md:h-20 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-4 md:px-8 border-b border-slate-200 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 uppercase tracking-tight truncate">
              {navItems.find(n => n.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
             <div className="px-3 py-1.5 bg-white rounded-md text-[11px] font-bold text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap">
               Khu vực: <span className="text-blue-700">TP. Hồ Chí Minh</span>
             </div>
             <div className="hidden md:flex items-center gap-2">
               <div className="relative flex h-2.5 w-2.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </div>
               <span className="text-xs font-semibold text-emerald-700">Trực tuyến</span>
             </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;