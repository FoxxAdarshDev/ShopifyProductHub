import { Link, useLocation } from "wouter";
import { Box, Grid3X3, FileEdit, Layout } from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  
  const menuItems = [
    { icon: Grid3X3, label: "All Products", href: "/" },
  ];

  const filteredViews = [
    { icon: FileEdit, label: "Draft Mode", href: "/draft-mode" },
    { icon: Layout, label: "New Layout", href: "/new-layout" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200">
      <div className="p-6">
        <div className="space-y-6">
          {/* Main Navigation */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Navigation
            </h3>
            <div className="space-y-1">
              {menuItems.map((item, index) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? "text-blue-600 bg-blue-50"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                    data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Filtered Views */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Filtered Views
            </h3>
            <div className="space-y-1">
              {filteredViews.map((item, index) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? "text-blue-600 bg-blue-50"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                    data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
