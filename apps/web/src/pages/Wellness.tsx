import {WeightEnergyReview} from '../components/WeightEnergyReview';
import {WellnessScoreSection} from '../components/WellnessScoreSection';

export default function Wellness() {
  return (
    <div className="wellness-review-page">
      <header className="wellness-review-heading">
        <div>
          <h1>Wellness</h1>
          <p>Clinical body mass telemetry, metabolic maintenance benchmarks, and weekly activity metrics.</p>
        </div>
      </header>
      <WellnessScoreSection />
      <WeightEnergyReview />
    </div>
  );
}
