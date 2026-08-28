import { FileText } from 'lucide-react';

export default function Reports() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <FileText className="w-8 h-8 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Health Reports</h1>
      </div>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <p className="text-gray-500">Reports feature is coming soon.</p>
      </div>
    </div>
  );
}
