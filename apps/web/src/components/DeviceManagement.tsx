import {useEffect,useState} from 'react';
import {apiJson} from '../services/api';
import {useHealthStore} from '../store/useHealthStore';
type Device={id:string;device_name:string;active:boolean;revoked_at:string|null;last_seen:string|null};
export function DeviceManagement() {
  const owner=useHealthStore(state=>state.user?.id);
  return <OwnedDeviceManagement key={owner}/>;
}
function OwnedDeviceManagement() {
  const [devices,setDevices]=useState<Device[]>([]),[name,setName]=useState(''),[credential,setCredential]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    void apiJson<Device[]>('/devices',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
      .then(setDevices).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not load devices.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[]);
  async function change(path:string,method:string,body?:object) {
    if(busy||loading)return;
    setBusy(true);setError('');
    try {
      const result=await apiJson<{credential?:string}>(path,{method,body:body?JSON.stringify(body):undefined});
      if(result.credential){setCredential(result.credential);setName('');}
      setDevices(await apiJson<Device[]>('/devices'));await useHealthStore.getState().fetchInitialData();
    } catch(reason){setError(reason instanceof Error?reason.message:'Device update failed.');}
    finally{setBusy(false);}
  }
  return <section className="surface space-y-4" aria-labelledby="device-management-title">
    <h2 id="device-management-title" className="surface-title">Your devices</h2>
    <p className="surface-description">Create a device credential, choose the active source or revoke access. Firmware Wi-Fi and API settings still need an operator upload with electrodes off-body.</p>
    {error&&<p role="alert" className="text-critical">{error}</p>}
    {loading&&<p role="status" className="text-sm text-muted">Loading your devices...</p>}
    <form className="flex flex-wrap gap-3" onSubmit={event=>{event.preventDefault();void change('/devices','POST',{name});}}>
      <label className="flex-1 min-w-0"><span className="field-label">Device name</span><input className="ui-input" value={name} onChange={event=>setName(event.target.value)} required maxLength={100}/></label>
      <button type="submit" className="ui-button secondary self-end" disabled={loading||busy||!name.trim()}>Create device</button>
    </form>
    {credential&&<div role="status" className="p-3 rounded-lg border border-line"><p className="text-sm">Save this credential privately. It is shown once and disappears when you leave this page.</p><code className="block break-all text-sm mt-2">{credential}</code><button type="button" className="ui-button secondary mt-3" onClick={()=>setCredential('')}>Hide credential</button></div>}
    <ul className="space-y-3">{devices.filter(device=>!device.revoked_at).map(device=><li key={device.id} className="flex flex-wrap justify-between items-center gap-3 border-t border-line pt-3"><div><strong className="text-sm">{device.device_name}</strong><p className="text-xs text-muted">{device.active?'Active source':'Inactive'} · {device.last_seen?`Last seen ${new Date(device.last_seen).toLocaleString()}`:'No readings yet'}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="ui-button secondary" disabled={busy||device.active} onClick={()=>void change(`/devices/${device.id}/activate`,'POST')}>Use device</button><button type="button" className="ui-button secondary" disabled={busy} onClick={()=>{if(window.confirm(`Revoke ${device.device_name}? It will stop uploading until configured with a new credential.`))void change(`/devices/${device.id}`,'DELETE');}}>Revoke</button></div></li>)}</ul>
  </section>;
}
