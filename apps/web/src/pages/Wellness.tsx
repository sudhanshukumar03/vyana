import { useHealthStore } from '../store/useHealthStore';
import { Bot, Info, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { BmiCard } from '../components/BmiCard';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export default function Wellness() {
  const { wellnessScore, insights, insightsOffline } = useHealthStore();
  const scoreColor = wellnessScore == null ? 'text-muted' : wellnessScore >= 80 ? 'text-success' : wellnessScore >= 60 ? 'text-warn' : 'text-critical';
  const insightIcon = (type: string) => {
    const Icon = type === 'warning' ? AlertTriangle : type === 'critical' ? ShieldAlert : type === 'success' ? CheckCircle : type === 'info' ? Info : Bot;
    return <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${type === 'critical' ? 'text-critical' : type === 'warning' ? 'text-warn' : type === 'success' ? 'text-success' : 'text-brand'}`} aria-hidden="true" />;
  };
  return (
    <div className="page-stack page-narrow">
      <PageHeader title="AI Wellness Assistant" description="A little context for your readings, habits and wellness goals." icon={Bot} />
      <div className="two-column">
        <section className="surface">
          <h2 className="surface-title">Prototype wellness score</h2>
          <div className="flex items-baseline gap-2 my-6"><strong className={`text-6xl font-medium tracking-tight tabular-nums ${scoreColor}`}>{wellnessScore ?? '—'}</strong><span className="text-muted text-lg">/100</span></div>
          <p className="surface-description">{wellnessScore == null ? 'Fresh complete readings are needed to calculate a score.' : 'This project heuristic summarizes configured readings. It is not a clinical assessment.'}</p>
        </section>
        <BmiCard />
      </div>
      <div className="section-heading"><h2>Personalized insights</h2><p role="status">{insights.length ? insightsOffline === false ? 'AI guidance' : 'Rule-based guidance' : 'Waiting for guidance'}</p></div>
      {insights.length ? <div className="space-y-3">{insights.map((insight, index) => <section key={index} className={`surface flex items-start gap-4 ${insight.type === 'critical' ? 'is-critical' : ''}`}>
        {insightIcon(insight.type)}<div className="min-w-0"><h3 className="surface-title">{insight.title}</h3><p className="surface-description">{insight.detail}</p></div>
      </section>)}</div> : <section className="surface"><EmptyState icon={Bot} title="Guidance needs a little context." description="When readings are available, your wellness insights will appear here. You can ask the AI Assistant a question at any time." /></section>}
    </div>
  );
}
