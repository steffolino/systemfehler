import { Button } from '../ui/button';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const views = [
    { id: 'data', label: 'Data Preview', icon: '📊' },
    { id: 'quality', label: 'Quality Metrics', icon: '⚡' },
    { id: 'moderation', label: 'Moderation Queue', icon: '✅' },
  ];

  return (
    <aside className="w-64 border-r bg-background min-h-screen p-4">
      <nav className="space-y-2">
        {views.map((view) => (
          <Button
            key={view.id}
            variant={currentView === view.id ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onViewChange(view.id)}
          >
            <span className="mr-2">{view.icon}</span>
            {view.label}
          </Button>
        ))}
      </nav>
    </aside>
  );
}
