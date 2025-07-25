import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Star, ClipboardList, Table, Video, FileDown, Shield, Hash, Package2 } from "lucide-react";

interface TabSelectorProps {
  selectedTabs: string[];
  onTabsChange: (tabs: string[]) => void;
}

const coreTabs = [
  { id: "description", label: "Description", icon: FileText },
  { id: "features", label: "Features", icon: Star },
  { id: "applications", label: "Applications", icon: ClipboardList },
  { id: "specifications", label: "Specifications", icon: Table },
  { id: "documentation", label: "Documentation", icon: FileDown },
  { id: "videos", label: "Videos", icon: Video },
];

const additionalTabs = [
  { id: "sku-nomenclature", label: "SKU Nomenclature", icon: Hash },
  { id: "safety-guidelines", label: "Safety Usage Guidelines", icon: Shield },
  { id: "compatible-container", label: "Compatible Container", icon: Package2 },
];

export default function TabSelector({ selectedTabs, onTabsChange }: TabSelectorProps) {
  const handleTabToggle = (tabId: string) => {
    if (selectedTabs.includes(tabId)) {
      onTabsChange(selectedTabs.filter(id => id !== tabId));
    } else {
      onTabsChange([...selectedTabs, tabId]);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Select Content Tabs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Core Tabs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Core Content Tabs</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {coreTabs.map((tab) => (
                <label
                  key={tab.id}
                  className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  data-testid={`checkbox-tab-${tab.id}`}
                >
                  <Checkbox
                    checked={selectedTabs.includes(tab.id)}
                    onCheckedChange={() => handleTabToggle(tab.id)}
                  />
                  <div className="flex items-center space-x-2">
                    <tab.icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Tabs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Content Tabs (Optional)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {additionalTabs.map((tab) => (
                <label
                  key={tab.id}
                  className="flex items-center space-x-3 p-3 border border-orange-200 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors"
                  data-testid={`checkbox-tab-${tab.id}`}
                >
                  <Checkbox
                    checked={selectedTabs.includes(tab.id)}
                    onCheckedChange={() => handleTabToggle(tab.id)}
                  />
                  <div className="flex items-center space-x-2">
                    <tab.icon className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
