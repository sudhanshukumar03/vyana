import { User } from 'lucide-react';

export default function Profile() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <User className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
      </div>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
          <User className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold">John Doe</h2>
        <p className="text-gray-500">Profile details and management coming soon.</p>
      </div>
    </div>
  );
}
