import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>
      
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <SettingsIcon className="w-7 h-7 text-gray-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No settings to configure</h2>
        <p className="text-gray-500 max-w-sm">This build runs against a single demo profile, so there’s nothing to configure yet. Account and alert-threshold settings would live here.</p>
      </div>
    </div>
  );
}
