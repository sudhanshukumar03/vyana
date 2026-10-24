import { useHealthStore } from '../store/useHealthStore';
import { Sparkles, Info, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { BmiCard } from '../components/BmiCard';

export default function Wellness() {
  const { wellnessScore, insights, insightsOffline } = useHealthStore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warn';
    return 'text-critical';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-5 h-5 text-info mt-0.5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warn mt-0.5" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-success mt-0.5" />;
      case 'critical': return <ShieldAlert className="w-5 h-5 text-critical mt-0.5" />;
      default: return <Sparkles className="w-5 h-5 text-brand mt-0.5" />;
    }
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'info': return 'bg-info-bg border-info/20';
      case 'warning': return 'bg-warn-bg border-warn/20';
      case 'success': return 'bg-success-bg border-success/20';
      case 'critical': return 'bg-critical-bg border-critical/20';
      default: return 'bg-surface-soft border-line';
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <Sparkles className="w-8 h-8 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900">AI Wellness Assistant</h1>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center mb-8">
        <h2 className="text-lg font-medium text-gray-500 mb-2">Prototype Wellness Score</h2>
        <div className="flex items-center justify-center">
          <span className={`text-6xl font-bold ${getScoreColor(wellnessScore ?? 0)}`}>
            {wellnessScore ?? '?'}
          </span>
          <span className="text-2xl text-gray-600 font-medium ml-1">/100</span>
        </div>
        <p className="mt-4 text-gray-600 max-w-lg mx-auto">
          {wellnessScore == null ? 'Fresh complete readings are needed to calculate a score.' : 'This project heuristic summarizes configured readings. It is not a clinical assessment.'}
        </p>
      </div>

      <div className="mb-8">
        <BmiCard />
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-4">Personalized Insights</h3>
      <p role="status" className="text-sm text-slate">{insights.length ? insightsOffline===false?'AI guidance':'Rule-based guidance' : 'Waiting for guidance'}</p>
      
      {insights.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-100 text-gray-500">
          No new insights at the moment. Keep tracking your data!
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight, idx) => (
            <div key={idx} className={`p-5 rounded-xl border flex items-start space-x-4 ${getInsightStyle(insight.type)}`}>
              {getInsightIcon(insight.type)}
              <div>
                <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                <p className="text-gray-700 mt-1 text-sm leading-relaxed">{insight.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
