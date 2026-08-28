import { useHealthStore } from '../store/useHealthStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Footprints, Map, Flame, Clock, AlertCircle } from 'lucide-react';

export default function Activity() {
  const { activity, historicalActivity } = useHealthStore();

  if (!activity) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No activity data available</p>
        </div>
      </div>
    );
  }

  // Format historical activity
  const chartData = historicalActivity.map(a => ({
    date: new Date(a.timestamp).toLocaleDateString([], { weekday: 'short' }),
    steps: a.steps
  })).reverse();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Activity Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Footprints className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Steps</p>
            <p className="text-2xl font-bold text-gray-900">{activity.steps}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Distance</p>
            <p className="text-2xl font-bold text-gray-900">{activity.distance_km} <span className="text-sm text-gray-500">km</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Calories</p>
            <p className="text-2xl font-bold text-gray-900">{activity.calories} <span className="text-sm text-gray-500">kcal</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Time</p>
            <p className="text-2xl font-bold text-gray-900">{activity.active_minutes} <span className="text-sm text-gray-500">min</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-medium text-gray-700 mb-6">Recent Steps Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="steps" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
