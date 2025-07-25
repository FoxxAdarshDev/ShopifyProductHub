import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Star, ClipboardList, Table, Video, FileDown, Shield, Plus } from "lucide-react";

interface TabSelectorProps {
  selectedTabs: string[];
  onTabsChange: (tabs: string[]) => void;
}

const availableTabs = [
  { id: "description", label: "Description", icon: FileText },
  { id: "features", label: "Features", icon: Star },
  { id: "applications", label: "Applications", icon: ClipboardList },
  { id: "specifications", label: "Specifications", icon: Table },
  { id: "videos", label: "Videos", icon: Video },
  { id: "documentation", label: "Documentation", icon: FileDown },
  { id: "safety-usage-guidelines", label: "Safety Guidelines", icon: Shield },
  { id: "custom", label: "Custom Tab", icon: Plus },
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {availableTabs.map((tab) => (
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
      </CardContent>
    </Card>
  );
}
