import {useSensorPreview} from '../store/useSensorPresentation';

export function SensorPreviewControl(){
  const {enabled,setEnabled}=useSensorPreview();
  return <section className={`sensor-mode${enabled?' is-preview':''}`} aria-label="Sensor display mode">
    <div><h2 className={`text-sm font-semibold ${enabled?'text-warn':'text-ink'}`}>{enabled?'Demo mode: simulated readings enabled':'Live readings only'}</h2>
      <details className="sensor-source-detail"><summary>Data sources</summary><p role="status" className="text-xs text-muted mt-1">{enabled?'Missing vital readings, history and ECG traces are simulated. They are not measurements and are not saved. Activity stays connected to Google Health. Demo mode resets on reload.':'Missing or stale sensors stay unavailable. Walking activity comes from your connected Google Health account.'}</p></details></div>
    <button type="button" className="ui-button secondary min-h-11" aria-label={enabled?'Return to live readings':'Enable simulated demo'} aria-pressed={enabled} onClick={()=>setEnabled(!enabled)}>{enabled?'Live readings':'Simulated demo'}</button>
  </section>;
}
