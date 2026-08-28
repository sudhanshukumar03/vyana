import { useHealthStore } from '../store/useHealthStore';
import { Sparkles, Info, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function Wellness() {
  const { wellnessScore, insights } = useHealthStore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-5 h-5 text-blue-500 mt-0.5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />;
      case 'critical': return <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />;
      default: return <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />;
    }
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-50 border-blue-100';
      case 'warning': return 'bg-yellow-50 border-yellow-100';
      case 'success': return 'bg-green-50 border-green-100';
      case 'critical': return 'bg-red-50 border-red-100';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <Sparkles className="w-8 h-8 text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">AI Wellness Assistant</h1>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center mb-8">
        <h2 className="text-lg font-medium text-gray-500 mb-2">Overall Wellness Score</h2>
        <div className="flex items-center justify-center">
          <span className={`text-6xl font-bold ${getScoreColor(wellnessScore)}`}>
            {wellnessScore}
          </span>
          <span className="text-2xl text-gray-400 font-medium ml-1">/100</span>
        </div>
        <p className="mt-4 text-gray-600 max-w-lg mx-auto">
          {wellnessScore >= 80 ? "You're in great shape! Keep up the healthy habits." : 
           wellnessScore >= 60 ? "You're doing okay, but there's room for improvement." :
           "Your wellness score is low. Please pay attention to the insights below."}
        </p>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-4">Personalized Insights</h3>
      
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
