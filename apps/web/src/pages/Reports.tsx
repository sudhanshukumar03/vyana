import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export default function Reports() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <FileText className="w-8 h-8 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900">Health Reports</h1>
      </div>
      
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-surface-soft flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-brand" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No reports yet</h2>
        <p className="text-gray-500 max-w-sm">Exportable health reports aren’t part of this build. Live vitals and activity are available on the Dashboard and in History.</p>
        <Link to="/assistant" className="mt-4 underline text-brand">Analyze a report with the AI Assistant</Link>
      </div>
    </div>
  );
}
