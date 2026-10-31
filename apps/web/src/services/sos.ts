import type {SosCapabilities,SosNotification} from '../../../../shared/types/sos';

const labels={pending:'Queued',blocked:'Setup required',sending:'Submitting',submitted:'Provider accepted',
  failed:'Failed',unknown:'Delivery uncertain',cancelled:'Cancelled'};

export function sosNotificationLabel(job:SosNotification,capabilities:SosCapabilities) {
  if(job.status==='pending'&&!capabilities[job.channel])return 'Setup required';
  return labels[job.status];
}
