import { Link, useLocation } from "wouter";
import { Box, LayoutTemplate, Image, Grid3X3 } from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  
  const menuItems = [
    { icon: Box, label: "Product Manager", href: "/product-manager" },
    { icon: Grid3X3, label: "All Products", href: "/all-products" },
    { icon: LayoutTemplate, label: "Content Templates", href: "/content-templates" },
    { icon: Image, label: "Logo Library", href: "/logo-library" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200">
      <div className="p-6">
        <div className="space-y-4">
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
    </aside>
  );
}
