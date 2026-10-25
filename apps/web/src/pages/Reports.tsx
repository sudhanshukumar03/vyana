import { Link } from 'react-router-dom';
import { Bot, FileText, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

export default function Reports() {
  return (
    <div className="page-stack page-narrow">
      <PageHeader title="Health Reports" description="Bring a report into your conversation and understand what to ask next." icon={FileText} />
      <div className="two-column">
        <section className="surface">
          <span className="empty-state-symbol"><Bot aria-hidden="true" /></span>
          <h2 className="surface-title">Review a report with the assistant</h2>
          <p className="surface-description">Choose a PDF, PNG or JPEG in the AI Assistant. It can explain readable findings and suggest questions for your clinician.</p>
          <Link to="/assistant" className="ui-button mt-6">Open AI Assistant<ArrowUpRight aria-hidden="true" /></Link>
        </section>
        <section className="surface">
          <h2 className="surface-title">Before you upload</h2>
          <dl className="reading-list"><div><dt>Formats</dt><dd>PDF, PNG, JPEG</dd></div><div><dt>Maximum size</dt><dd>10 MiB</dd></div></dl>
          <p className="surface-description report-privacy flex items-start gap-2"><ShieldCheck className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />Reports are reviewed once and are not saved for follow-up questions.</p>
          <p className="surface-description">AI explanations are wellness guidance, not a diagnosis or prescription.</p>
        </section>
      </div>
      <section className="surface">
        <h2 className="surface-title">Looking for your reading history?</h2>
        <p className="surface-description">Exportable reports are unavailable in this build. Your saved vital readings are available in History.</p>
        <Link to="/history" className="ui-button secondary mt-5">View reading history<ArrowUpRight aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
