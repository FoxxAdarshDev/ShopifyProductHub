import { Box, LayoutTemplate, Image, History, Settings } from "lucide-react";

export default function Sidebar() {
  const menuItems = [
    { icon: Box, label: "Product Manager", href: "#", active: true },
    { icon: LayoutTemplate, label: "Content Templates", href: "#" },
    { icon: Image, label: "Logo Library", href: "#" },
    { icon: History, label: "Change History", href: "#" },
    { icon: Settings, label: "Settings", href: "#" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200">
      <div className="p-6">
        <div className="space-y-4">
          {menuItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                item.active
                  ? "text-primary-600 bg-primary-50 sidebar-active"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
              data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
