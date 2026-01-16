import { useState } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DataPreview } from './components/admin/DataPreview';
import { QualityMetrics } from './components/admin/QualityMetrics';
import { ModerationQueue } from './components/admin/ModerationQueue';

function App() {
  const [currentView, setCurrentView] = useState('data');

  const renderView = () => {
    switch (currentView) {
      case 'data':
        return <DataPreview />;
      case 'quality':
        return <QualityMetrics />;
      case 'moderation':
        return <ModerationQueue />;
      default:
        return <DataPreview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 p-6">
          <div className="container mx-auto max-w-7xl">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
