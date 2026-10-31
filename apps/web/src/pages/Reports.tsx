import {Modal} from '../components/Modal';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowUpRight,
  UploadCloud,
  CheckCircle2,
  FileCheck,
  Eye,
  Trash2,
  Copy,
  Check,
  X,
  Download,
  AlertCircle,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiJson } from '../services/api';
import { readReport } from '../lib/assistant';
import { AiRobotIcon } from '../components/AiRobotIcon';
import {useHealthStore} from '../store/useHealthStore';
import type { ReportResponse, AnswerSection } from '../../../../shared/types/health';

export interface LabTestItem {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'optimal' | 'borderline' | 'elevated' | 'low';
}

export interface HealthReportRecord {
  id: string;
  filename: string;
  uploadedAt: string;
  size: string;
  status: 'reviewed' | 'pending' | 'ready';
  summary: string;
  doctorQuestions: string[];
  sections?: AnswerSection[];
  labItems?: LabTestItem[];
  mimeType?: string;
  base64?: string;
  previewUrl?: string;
  analysis?: ReportResponse;
  documentStatus?: 'readable' | 'unreadable' | 'not_health_report' | 'not_reviewed';
}

export default function Reports() {
  const owner=useHealthStore(state=>state.user?.id);
  return owner?<OwnedReports key={owner} owner={owner}/>:null;
}
function OwnedReports({owner}:{owner:number}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reports,setReports]=useState<HealthReportRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [selectedReport, setSelectedReport] = useState<HealthReportRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'summary' | 'questions' | 'preview'>('summary');
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});

  useEffect(()=>{
    try { localStorage.removeItem('vyana_saved_reports'); } catch (e) { void e; }
    const controller=new AbortController();
    void apiJson<HealthReportRecord[]>('/reports',{signal:controller.signal})
      .then(setReports).catch(error=>{if(!controller.signal.aborted)setUploadError(error instanceof Error?error.message:'Could not load saved reports.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[owner]);
  async function openReport(report:HealthReportRecord) {
    try {
      const detail=await apiJson<HealthReportRecord>(`/reports/${report.id}`,{signal:AbortSignal.timeout(45000)});
      setSelectedReport({...detail,previewUrl:detail.base64?`data:${detail.mimeType};base64,${detail.base64}`:undefined});
      setActiveModalTab('summary');
    } catch(error) {setUploadError(error instanceof Error?error.message:'Could not open this report.');}
  }
  async function retryReview(report:HealthReportRecord) {
    setUploading(true);setUploadError('');
    try {
      const updated=await apiJson<HealthReportRecord>(`/reports/${report.id}/review`,{method:'POST',signal:AbortSignal.timeout(45000)});
      setReports(rows=>rows.map(row=>row.id===report.id?updated:row));
      setSelectedReport(previous=>previous?.id===report.id?{...previous,...updated}:previous);
      setUploadMessage(updated.status==='reviewed'?'Report review saved.':'Report saved; review retry pending.');
    } catch(error) {setUploadError(error instanceof Error?error.message:'Could not retry review.');}
    finally {setUploading(false);}
  }
  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || uploading || loading) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setUploadError('Unsupported format. Please upload a PDF, PNG or JPEG document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds 10 MiB limit. Please choose a smaller file.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadMessage(`Processing ${file.name}…`);

    const controller = new AbortController();
    try {
      const base64 = await readReport(file, controller.signal);
      const saved=await apiJson<HealthReportRecord>('/reports',{
        method:'POST',body:JSON.stringify({data_base64:base64,mime_type:file.type,filename:file.name}),
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]),
      });
      const newReport={...saved,base64,previewUrl:`data:${file.type};base64,${base64}`};
      setReports(prev=>[saved,...prev]);
      setUploadMessage(saved.status==='reviewed'?`Review saved for ${file.name}.`:`Saved ${file.name}.`);
      setSelectedReport(newReport);
      setActiveModalTab('summary');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not process the report. Please retry.');
    } finally {
      setUploading(false);
    }
  };

  const handleProceedToAi=(report:HealthReportRecord)=>{
    navigate('/assistant',{state:{report:{id:report.id,owner}}});
  };
  const handleDeleteReport=async(id:string,e:React.MouseEvent)=>{
    e.stopPropagation();
    if(!window.confirm('Delete this report and its original document from your account?'))return;
    try {
      await apiJson(`/reports/${id}`,{method:'DELETE'});
      setReports(prev=>prev.filter(r=>r.id!==id));
      if(selectedReport?.id===id)setSelectedReport(null);
    } catch(error) {setUploadError(error instanceof Error?error.message:'Could not delete report.');}
  };
  const handleCopyQuestions = (questions: string[]) => {
    const text = questions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2000);
    });
  };

  const toggleQuestionCheck = (q: string) => {
    setCheckedQuestions(prev => ({ ...prev, [q]: !prev[q] }));
  };

  return (
    <div className="page-stack page-narrow">
      <PageHeader
        title="Health Reports"
        description="Keep your documents and review their explanations."
        icon={FileText}
      />

      {/* Upload Dropzone */}
      <section className="surface" aria-labelledby="upload-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="upload-heading" className="surface-title">Upload Clinical Report</h2>
          <span className="text-xs text-muted font-medium bg-surface-soft px-2.5 py-1 rounded-lg border border-line">
            PDF · PNG · JPEG (Max 10 MB)
          </span>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => {
            e.preventDefault();
            setDragActive(false);
            void handleFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          aria-disabled={uploading||loading}
          onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!uploading&&!loading){event.preventDefault();fileInputRef.current?.click();}}}
          onClick={() => !uploading&&!loading && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            dragActive ? 'border-brand bg-surface-soft shadow-xs' : 'border-line hover:border-brand/60 bg-canvas/60'
          } ${uploading ? 'opacity-60 cursor-wait' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            disabled={uploading||loading}
            onChange={e => {void handleFiles(e.target.files);e.target.value='';}}
          />
          <div className="w-12 h-12 rounded-xl bg-surface-soft text-brand flex items-center justify-center mb-3">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <p className="font-semibold text-ink text-sm mb-1">
            {uploading ? 'Analyzing clinical document…' : 'Drop report here, or click to browse'}
          </p>
          <p className="text-xs text-muted">Supports lab panels, clinical summaries, and diagnostic charts</p>
        </div>

        {uploadError && (
          <div role="alert" className="mt-4 p-3.5 rounded-xl bg-critical-bg border border-critical text-xs text-critical font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadMessage && !uploadError && (
          <div className="mt-4 p-3.5 rounded-xl bg-surface-soft border border-line text-xs text-brand font-medium flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
              <span>{uploadMessage}</span>
            </div>
            {selectedReport && (
              <button
                type="button"
                onClick={() => setSelectedReport(selectedReport)}
                className="ui-button secondary text-xs py-1.5 px-3"
              >
                <Eye className="w-3.5 h-3.5" /> View Report
              </button>
            )}
          </div>
        )}
      </section>

      {/* Reports List */}
      <section className="surface" aria-labelledby="reports-list-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="reports-list-heading" className="surface-title">Clinical Documents</h2>
          <span className="text-xs text-muted font-medium shrink-0 bg-surface-soft px-2.5 py-1 rounded-lg border border-line">
            {reports.length} Document{reports.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-3">
          {!reports.length && (
            <p role="status" className="text-sm text-muted py-4 text-center">
              {loading ? 'Loading documents…' : 'No clinical reports archived yet.'}
            </p>
          )}
          {reports.map(rep => (
            <div
              key={rep.id}
              className="p-4 border border-line rounded-xl bg-surface space-y-3 group transition-shadow hover:shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-surface-soft text-brand group-hover:bg-brand group-hover:text-white transition-colors shrink-0 mt-0.5">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-ink group-hover:text-brand transition-colors truncate">
                        {rep.filename}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-soft text-muted inline-flex items-center gap-1">
                        <AiRobotIcon className="w-3 h-3 rounded-xs" />
                        {rep.status === 'reviewed' ? 'Reviewed' : 'Pending Review'}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      Uploaded {rep.uploadedAt} · {rep.size}
                      {rep.labItems && ` · ${rep.labItems.length} clinical markers`}
                    </p>
                    {rep.summary && (
                      <p className="text-xs text-body mt-2 leading-relaxed line-clamp-2">
                        {rep.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-1">
                  {rep.status !== 'reviewed' && (
                    <button
                      type="button"
                      disabled={uploading}
                      className="ui-button secondary text-xs"
                      onClick={event => { event.stopPropagation(); void retryReview(rep); }}
                    >
                      Retry review
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { void openReport(rep); }}
                    className="ui-button secondary text-xs py-1.5 px-3 gap-1.5"
                    title="View report details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProceedToAi(rep)}
                    className="ui-button text-xs py-1.5 px-3 gap-1.5"
                    title="Consult Assistant about this report"
                  >
                    <AiRobotIcon className="w-3.5 h-3.5 rounded-xs" />
                    <span>Consult Assistant</span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                  </button>

                  <button
                    type="button"
                    onClick={e => void handleDeleteReport(rep.id, e)}
                    className="p-2 rounded-lg text-muted hover:text-critical hover:bg-critical-bg transition-colors"
                    title="Delete report"
                    aria-label={`Remove ${rep.filename}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Report Viewer Modal */}
      {selectedReport && (
        <Modal title={selectedReport.filename} className="report-viewer-modal" onClose={()=>setSelectedReport(null)}>
          <div
            className="surface max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-line flex items-start justify-between gap-3 bg-surface">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-surface-soft text-brand shrink-0 mt-0.5">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 id="report-modal-title" className="text-lg font-bold text-ink truncate">
                      {selectedReport.filename}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-soft text-muted border border-line inline-flex items-center gap-1.5">
                      <AiRobotIcon className="w-3.5 h-3.5 rounded-xs" />
                      {selectedReport.status==='reviewed'?'Reviewed':'Pending Review'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Recorded {selectedReport.uploadedAt} · Size: {selectedReport.size}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-soft transition-colors"
                aria-label="Close report viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-line bg-canvas/60 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveModalTab('summary')}
                className={`py-2 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeModalTab === 'summary'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                Clinical Findings & Markers
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('questions')}
                className={`py-2 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeModalTab === 'questions'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                Doctor Questions ({selectedReport.doctorQuestions?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('preview')}
                className={`py-2 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeModalTab === 'preview'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                Document Preview
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {activeModalTab === 'summary' && (
                <div className="space-y-5">
                  {/* Summary Callout */}
                  <div className="p-4 rounded-xl bg-surface-soft border border-line space-y-2">
                    <div className="flex items-center gap-2">
                      <AiRobotIcon className="w-4 h-4 rounded-xs" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-brand">
                        Clinical Summary
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-ink leading-relaxed">
                      {selectedReport.summary}
                    </p>
                  </div>

                  {/* Structured Lab Values Table if available */}
                  {selectedReport.labItems && selectedReport.labItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-brand" /> Measured Laboratory Markers
                        </h4>
                        <span className="text-[11px] text-muted">Standard Reference Ranges</span>
                      </div>

                      <div className="table-scroll border border-line rounded-xl overflow-hidden">
                        <table>
                          <thead>
                            <tr>
                              <th>Marker Name</th>
                              <th>Patient Value</th>
                              <th>Reference Range</th>
                              <th>Status Evaluation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedReport.labItems.map((item, idx) => {
                              const isOptimal = item.status === 'optimal';
                              const isNormal = item.status === 'normal';
                              const isElevated = item.status === 'elevated';
                              const isBorderline = item.status === 'borderline';

                              return (
                                <tr key={idx}>
                                  <td className="font-semibold text-ink">{item.name}</td>
                                  <td className="font-bold text-ink">
                                    {item.value} <span className="text-xs font-normal text-muted">{item.unit}</span>
                                  </td>
                                  <td className="text-xs text-muted">{item.referenceRange} {item.unit}</td>
                                  <td>
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                        isOptimal
                                          ? 'bg-brand/10 text-brand'
                                          : isNormal
                                          ? 'bg-success-bg text-success'
                                          : isElevated
                                          ? 'bg-critical-bg text-critical'
                                          : isBorderline
                                          ? 'bg-warn-bg text-warn'
                                          : 'bg-surface-soft text-muted'
                                      }`}
                                    >
                                      {item.status.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Detailed Analysis Sections */}
                  {selectedReport.sections && selectedReport.sections.length > 0 && (
                    <div className="space-y-4">
                      {selectedReport.sections.map((sec, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-line bg-canvas/40 space-y-2">
                          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">{sec.title}</h4>
                          <ul className="list-disc pl-5 space-y-1.5 text-xs text-body leading-relaxed">
                            {sec.items.map((it, itIdx) => (
                              <li key={itIdx}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'questions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-muted font-medium">
                      Consultation guidance checklist
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyQuestions(selectedReport.doctorQuestions)}
                      className="ui-button secondary text-xs py-1 px-2.5 gap-1.5"
                    >
                      {copiedQuestions ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedQuestions ? 'Questions Copied!' : 'Copy All Questions'}</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {selectedReport.doctorQuestions.map((q, idx) => {
                      const isChecked = Boolean(checkedQuestions[q]);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleQuestionCheck(q)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${
                            isChecked
                              ? 'bg-surface-soft/60 border-brand/40 text-muted line-through'
                              : 'bg-surface border-line hover:border-brand/40 text-ink'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleQuestionCheck(q)}
                            className="mt-1 rounded accent-brand cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          />
                          <p className="text-xs sm:text-sm font-medium leading-relaxed">
                            {q}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeModalTab === 'preview' && (
                <div className="space-y-4">
                  {selectedReport.previewUrl ? (
                    selectedReport.mimeType?.startsWith('image/') ? (
                      <div className="p-2 border border-line rounded-xl bg-canvas flex justify-center">
                        <img
                          src={selectedReport.previewUrl}
                          alt={selectedReport.filename}
                          className="max-h-[460px] object-contain rounded-lg shadow-xs"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <iframe
                          src={selectedReport.previewUrl}
                          title={selectedReport.filename}
                          className="w-full h-[460px] rounded-xl border border-line bg-canvas"
                        />
                        <div className="flex justify-end">
                          <a
                            href={selectedReport.previewUrl}
                            download={selectedReport.filename}
                            className="ui-button secondary text-xs py-1.5 px-3 gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Original Document
                          </a>
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="surface-description">Document preview unavailable.</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-line bg-surface flex items-center justify-between flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="ui-button secondary text-xs"
              >
                Close Viewer
              </button>

              <button
                type="button"
                onClick={() => handleProceedToAi(selectedReport)}
                className="ui-button text-xs gap-2 font-semibold"
              >
                <AiRobotIcon className="w-4 h-4 rounded-xs" />
                Discuss in AI Assistant
                <ArrowUpRight className="w-4 h-4 opacity-75" />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
