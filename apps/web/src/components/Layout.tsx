import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useHealthStore } from '../store/useHealthStore';
import { Outlet } from 'react-router-dom';

export function Layout() {
  const { fetchInitialData, connectWebSocket, disconnectWebSocket, isConnected } = useHealthStore();

  useEffect(() => {
    fetchInitialData();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [fetchInitialData, connectWebSocket, disconnectWebSocket]);

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        
        {/* Offline / Backend Error Banner */}
        {!isConnected && (
          <div className="bg-amber-50 text-amber-800 px-6 py-2 text-sm flex items-center justify-center border-b border-amber-200">
            <span className="font-medium">Connecting to HealthGuard Backend...</span> 
            <span className="ml-2">Live updates may be delayed.</span>
          </div>
        )}

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
