import { useHealthStore } from '../store/useHealthStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Footprints, Map, Flame, Clock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export default function Activity() {
  const { activity, historicalActivity } = useHealthStore();

  if (!activity) {
    return (
      <div className="page-stack"><PageHeader title="Activity Overview" description="Follow your steps, movement and recent activity." icon={Footprints} /><section className="surface"><EmptyState icon={Footprints} title="No activity data available" description="Activity readings will appear here when your connected source sends them." /></section></div>
    );
  }

  // Format historical activity
  const chartData = historicalActivity.map(a => ({
    date: new Date(a.timestamp).toLocaleDateString([], { weekday: 'short' }),
    steps: a.steps
  }));

  return (
    <div className="page-stack">
      <PageHeader title="Activity Overview" description="Your latest recorded movement and step history." icon={Footprints} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="surface flex items-center gap-4">
          <div className="p-3 bg-surface-soft text-brand rounded-lg">
            <Footprints className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Steps</p>
            <p className="text-2xl font-bold text-ink">{activity.steps}</p>
          </div>
        </div>

        <div className="surface flex items-center gap-4">
          <div className="p-3 bg-success-bg text-success rounded-lg">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Distance</p>
            <p className="text-2xl font-bold text-ink">{activity.distance_km} <span className="text-sm text-muted">km</span></p>
          </div>
        </div>

        <div className="surface flex items-center gap-4">
          <div className="p-3 bg-warn-bg text-warn rounded-lg">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Calories</p>
            <p className="text-2xl font-bold text-ink">{activity.calories} <span className="text-sm text-muted">kcal</span></p>
          </div>
        </div>

        <div className="surface flex items-center gap-4">
          <div className="p-3 bg-surface-soft text-brand rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Active Time</p>
            <p className="text-2xl font-bold text-ink">{activity.active_minutes} <span className="text-sm text-muted">min</span></p>
          </div>
        </div>
      </div>

      <div className="surface">
        <h2 className="text-lg font-medium text-body mb-6">Recent Steps Trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--color-surface-soft)' }} />
              <Bar isAnimationActive={false} dataKey="steps" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
