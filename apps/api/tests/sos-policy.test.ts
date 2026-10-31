import {advanceSignals,criticalSignals,defaultSosPreferences,internationalPhone,type SosObservation} from '../src/sos-policy';
import {loadSosDeliveryConfig,sosCapabilities} from '../src/sos-delivery';
import {escapeHtml,reportCsv,type SosReport} from '../src/sos-report';

const observation=(at:number,heart_rate:number|null=160,spo2:number|null=98):SosObservation=>({
  observed_at:new Date(at).toISOString(),source:'ESP32_RealVitals_SimulatedSteps',priority:1,
  heart_rate,spo2,temperature:null,ecg_status:'Unknown',quality:[],
});
test('automatic SOS needs both duration and sample count in one continuous direction',()=>{
  let state=advanceSignals({},observation(0),false,defaultSosPreferences);
  expect(state.trigger).toBeNull();
  state=advanceSignals(state.signals,observation(15000),true,defaultSosPreferences);expect(state.trigger).toBeNull();
  state=advanceSignals(state.signals,observation(30000),true,defaultSosPreferences);expect(state.trigger).toBe('High heart rate');
  expect(advanceSignals(state.signals,observation(35000,30),true,defaultSosPreferences).trigger).toBeNull();
  expect(advanceSignals(state.signals,observation(35000),false,defaultSosPreferences).trigger).toBeNull();
});
test('missing or zero optical data and ECG labels cannot create a threshold emergency',()=>{
  expect(criticalSignals({...observation(0,null,null),ecg_status:'Leads Off',quality:['ECG leads off']})).toEqual([]);
  expect(criticalSignals({...observation(0,0,0),ecg_status:'Irregular'})).toEqual([]);
  expect(criticalSignals(observation(0,72,98))).toEqual([]);
  expect(criticalSignals(observation(0,160,87))).toEqual(['High heart rate','Low oxygen reading']);
});
test('normal or invalid observations reset an existing critical streak',()=>{
  const previous={'High heart rate':{since:0,count:10}};
  expect(advanceSignals(previous,observation(60000,72),true,defaultSosPreferences).signals).toEqual({});
  expect(advanceSignals(previous,observation(60000,null),true,defaultSosPreferences).trigger).toBeNull();
});
test('phone notifications require international recipient numbers',()=>{
  expect(internationalPhone('+91 98765-43210')).toBe('+919876543210');
  for(const value of ['112','911','9876543210','+123',null])expect(internationalPhone(value)).toBeNull();
});
test('outbound services stay unavailable without explicit delivery configuration',()=>{
  expect(sosCapabilities(loadSosDeliveryConfig({}))).toEqual({email:false,sms:false,call:false,phone_sos:false});
  expect(sosCapabilities(loadSosDeliveryConfig({SOS_DELIVERY_ENABLED:'true',RESEND_API_KEY:'test-key',SOS_FROM_EMAIL:'sender@example.test'})).email).toBe(true);
  expect(()=>loadSosDeliveryConfig({SOS_FROM_EMAIL:'bad\r\naddress'})).toThrow();
});
test('reports escape HTML and protect CSV cells from spreadsheet formula execution',()=>{
  expect(escapeHtml('<img onerror="alert(1)">')).toBe('&lt;img onerror=&quot;alert(1)&quot;&gt;');
  const report={rows:[{observed_at:'2026-10-28T00:00:00Z',heart_rate:72,spo2:98,temperature:25,
    ecg_status:'Unknown',quality:[],source:'=HYPERLINK("bad")'}]} as unknown as SosReport;
  expect(reportCsv(report)).toContain('"\'=HYPERLINK(""bad"")"');
});
