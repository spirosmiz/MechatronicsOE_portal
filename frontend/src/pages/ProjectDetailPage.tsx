import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Plus, FileText, Package, Clock,
  CheckCircle2, Building2, Cpu, User, Calendar, FileSignature, Receipt, Paperclip,
} from 'lucide-react';
import {
  useProject, useUpdateProject, useUpdateProjectStatus, useDeleteProject,
  useCreateServiceReport, useInventory, useGenerateInvoice, useInvoices, useCurrentLaborRates,
} from '@/hooks/useQueries';
import { projectsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { KEYS } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import {
  formatCurrency, formatDateTime, formatDate, STATUS_COLORS, STATUS_LABELS, JOB_TYPE_LABELS,
  INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS,
} from '@/lib/utils';
import { StatusType, JobType, InventoryItem, ServiceReport } from '@/types';

const STATUSES: StatusType[] = ['draft', 'pending_approval', 'approved', 'in_progress', 'completed', 'cancelled'];
const JOB_TYPES: JobType[] = ['maintenance', 'electrical_upgrade', 'retrofit', 'reconstruction'];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id!);
  const { data: inventoryItems = [] } = useInventory();
  const updateMut      = useUpdateProject();
  const statusMut      = useUpdateProjectStatus();
  const deleteMut      = useDeleteProject();
  const reportMut      = useCreateServiceReport();
  const generateMut    = useGenerateInvoice();
  const { data: projectInvoices = [] } = useInvoices(id ? { projectId: id } : undefined);
  const { data: currentRates = [] }    = useCurrentLaborRates();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [matOpen, setMatOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [reportForm, setReportForm] = useState({ workPerformed: '', hoursLogged: '', workType: 'SERVICE_ENGINEER', digitalSignature: '' });
  const [matForm, setMatForm] = useState({ inventoryId: '', qty: '1', description: '', unitPrice: '', partNumber: '', brand: '', stockQty: '0' });
  const [reportMediaTarget, setReportMediaTarget] = useState<ServiceReport | null>(null);
  const [matMode, setMatMode]         = useState<'inventory' | 'custom'>('inventory');
  const [saveToInventory, setSaveToInventory] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }
  if (!project) return <div className="text-center py-16">Project not found</div>;

  function openEdit() {
    setEditForm({
      title: project!.title,
      type: project!.type,
      status: project!.status,
      estimatedLaborHours: String(project!.estimatedLaborHours),
      actualLaborHours: String(project!.actualLaborHours),
      quotedTotalPrice: String(project!.quotedTotalPrice),
      termsAndConditions: project!.termsAndConditions ?? '',
    });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    try {
      await updateMut.mutateAsync({
        id: id!,
        data: {
          title: editForm.title, type: editForm.type, status: editForm.status,
          estimatedLaborHours: parseFloat(editForm.estimatedLaborHours),
          actualLaborHours: parseFloat(editForm.actualLaborHours),
          quotedTotalPrice: parseFloat(editForm.quotedTotalPrice),
          termsAndConditions: editForm.termsAndConditions || undefined,
        },
      });
      toast({ title: 'Project updated' });
      setEditOpen(false);
    } catch {
      toast({ title: 'Failed to update project', variant: 'destructive' });
    }
  }

  async function handleStatusChange(status: StatusType) {
    try {
      await statusMut.mutateAsync({ id: id!, status });
      toast({ title: `Status → ${STATUS_LABELS[status]}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this project and all its reports and materials?')) return;
    try {
      await deleteMut.mutateAsync(id!);
      toast({ title: 'Project deleted' });
      navigate('/projects');
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  }

  async function handleAddReport() {
    if (!reportForm.workPerformed || !reportForm.hoursLogged) {
      toast({ title: 'Work performed and hours are required', variant: 'destructive' });
      return;
    }
    try {
      await reportMut.mutateAsync({
        projectId: id!,
        workPerformed: reportForm.workPerformed,
        hoursLogged: parseFloat(reportForm.hoursLogged),
        workType: reportForm.workType || undefined,
        digitalSignature: reportForm.digitalSignature || undefined,
      });
      toast({ title: 'Service report submitted' });
      setReportForm({ workPerformed: '', hoursLogged: '', workType: 'SERVICE_ENGINEER', digitalSignature: '' });
      setReportOpen(false);
    } catch {
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    }
  }

  async function handleAddMaterial() {
    try {
      if (matMode === 'inventory') {
        const inv = inventoryItems.find((i) => i.id === matForm.inventoryId);
        if (!inv) { toast({ title: 'Select a part from inventory', variant: 'destructive' }); return; }
        await projectsApi.addMaterial(id!, {
          inventoryId:      inv.id,
          quantityRequired: parseInt(matForm.qty),
          unitCostAtQuote:  Number(inv.unitCost),
          unitPriceAtQuote: Number(inv.unitPrice),
        });
      } else {
        if (!matForm.description.trim()) { toast({ title: 'Description is required', variant: 'destructive' }); return; }
        if (!matForm.unitPrice || Number(matForm.unitPrice) <= 0) { toast({ title: 'Enter a valid unit price', variant: 'destructive' }); return; }
        await projectsApi.addMaterial(id!, {
          description:      matForm.description.trim(),
          quantityRequired: parseInt(matForm.qty) || 1,
          unitCostAtQuote:  Number(matForm.unitPrice),
          unitPriceAtQuote: Number(matForm.unitPrice),
          saveToInventory,
          partNumber:  matForm.partNumber.trim()  || undefined,
          brand:       matForm.brand.trim()       || undefined,
          stockQuantity: parseInt(matForm.stockQty) || 0,
        });
        if (saveToInventory) qc.invalidateQueries({ queryKey: KEYS.inventory });
      }
      qc.invalidateQueries({ queryKey: KEYS.project(id!) });
      toast({ title: saveToInventory && matMode === 'custom' ? 'Material added and saved to Inventory' : 'Material added' });
      setMatForm({ inventoryId: '', qty: '1', description: '', unitPrice: '', partNumber: '', brand: '', stockQty: '0' });
      setSaveToInventory(false);
      setMatOpen(false);
    } catch {
      toast({ title: 'Failed to add material', variant: 'destructive' });
    }
  }

  async function handleRemoveMaterial(materialId: string) {
    if (!confirm('Remove this material?')) return;
    try {
      await projectsApi.removeMaterial(id!, materialId);
      qc.invalidateQueries({ queryKey: KEYS.project(id!) });
      toast({ title: 'Material removed' });
    } catch {
      toast({ title: 'Failed to remove material', variant: 'destructive' });
    }
  }

  async function handleGenerateInvoice() {
    if (!confirm('Generate a draft invoice from all service reports and materials on this project?')) return;
    try {
      const res = await generateMut.mutateAsync(id!);
      const invoice = (res as { data?: { id?: string } }).data;
      toast({ title: 'Draft invoice created — review it before issuing' });
      if (invoice?.id) navigate(`/invoices/${invoice.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to generate invoice';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  const laborPct = project.estimatedLaborHours && Number(project.estimatedLaborHours) > 0
    ? Math.min(100, (Number(project.actualLaborHours) / Number(project.estimatedLaborHours)) * 100)
    : 0;

  const materialsTotal = project.projectMaterials?.reduce(
    (sum, m) => sum + Number(m.unitPriceAtQuote) * m.quantityRequired, 0
  ) ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{project.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {JOB_TYPE_LABELS[project.type]} · Created {formatDate(project.createdAt)}
            {project.creator && ` by ${project.creator.name}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {project.status === 'completed' && (
              <Button
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={handleGenerateInvoice}
                disabled={generateMut.isPending}
              >
                <Receipt className="w-4 h-4 mr-2" />
                {generateMut.isPending ? 'Generating…' : 'Generate Invoice'}
              </Button>
            )}
            <Button variant="outline" onClick={openEdit}><Edit className="w-4 h-4 mr-2" />Edit</Button>
            {user?.role === 'admin' && (
              <Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
            )}
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer/Machine */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {project.customer && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <Link to={`/customers/${project.customer.id}`} className="text-sm font-medium hover:text-blue-600">
                    {project.customer.companyName}
                  </Link>
                </div>
              </div>
            )}
            {project.machine && (
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Machine</p>
                  <p className="text-sm font-medium">{project.machine.name}</p>
                  {project.machine.model && <p className="text-xs text-muted-foreground">{project.machine.model}</p>}
                </div>
              </div>
            )}
            {project.offer && (
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Linked Offer</p>
                  <Link to="/offers" className="text-sm font-medium hover:text-blue-600">
                    {project.offer.title}
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Quoted Total</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(project.quotedTotalPrice)}</p>
            {(() => {
              // Try to get per-type breakdown from the linked offer's items
              const offerItems = project.offer?.items ?? [];

              const designItem  = offerItems.find((i) => i.description.startsWith('Design Engineering'));
              const serviceItem = offerItems.find((i) => i.description.startsWith('Service / Installation'));

              const designHours   = designItem  ? Number(designItem.quantity)  : 0;
              const designRate    = designItem  ? Number(designItem.unitPrice)  : 0;
              const serviceHours  = serviceItem ? Number(serviceItem.quantity)  : 0;
              const serviceRate   = serviceItem ? Number(serviceItem.unitPrice) : 0;

              const hasOfferBreakdown = designHours > 0 || serviceHours > 0;

              if (hasOfferBreakdown) {
                const designTotal  = designHours  * designRate;
                const serviceTotal = serviceHours * serviceRate;
                const laborTotal   = designTotal + serviceTotal;
                return (
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    <p>Materials: {formatCurrency(materialsTotal)}</p>
                    <p>
                      Labor est.: <span className="font-medium text-foreground">{formatCurrency(laborTotal)}</span>
                    </p>
                    {designHours > 0 && (
                      <p className="pl-3 opacity-75">
                        Design: {designHours.toFixed(1)} h × {formatCurrency(designRate)}/h = {formatCurrency(designTotal)}
                      </p>
                    )}
                    {serviceHours > 0 && (
                      <p className="pl-3 opacity-75">
                        Service: {serviceHours.toFixed(1)} h × {formatCurrency(serviceRate)}/h = {formatCurrency(serviceTotal)}
                      </p>
                    )}
                  </div>
                );
              }

              // Fallback: no offer items — use estimatedLaborHours × current rate
              const svcRate  = currentRates.find((r) => r.role === 'SERVICE_ENGINEER');
              const dsnRate  = currentRates.find((r) => r.role === 'DESIGN_ENGINEER');
              const fallback = svcRate ?? dsnRate;
              const laborEst = fallback
                ? Number(project.estimatedLaborHours) * Number(fallback.ratePerHour)
                : null;
              return (
                <p className="text-xs text-muted-foreground mt-1">
                  Materials: {formatCurrency(materialsTotal)}
                  {' · '}
                  Labor est.: {laborEst !== null
                    ? <>{formatCurrency(laborEst)} <span className="opacity-60">({Number(project.estimatedLaborHours).toFixed(1)} h × {formatCurrency(fallback!.ratePerHour)}/h)</span></>
                    : <span className="italic">no labor rate set</span>}
                </p>
              );
            })()}
          </CardContent>
        </Card>

        {/* Labor progress */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Labor Hours</p>
            <div className="flex items-end gap-1">
              <p className="text-2xl font-bold">{Number(project.actualLaborHours).toFixed(1)}</p>
              <p className="text-sm text-muted-foreground mb-0.5">/ {Number(project.estimatedLaborHours).toFixed(1)} est.</p>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${laborPct >= 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${laborPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{laborPct.toFixed(0)}% utilized</p>
          </CardContent>
        </Card>
      </div>

      {/* Status quick-change */}
      {canEdit && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">Quick Status:</span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    project.status === s
                      ? STATUS_COLORS[s] + ' border-current'
                      : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terms */}
      {project.termsAndConditions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.termsAndConditions}</p>
          </CardContent>
        </Card>
      )}

      {/* Materials */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" /> Bill of Materials
            <span className="text-sm font-normal text-muted-foreground">({project.projectMaterials?.length ?? 0} items)</span>
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setMatOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!project.projectMaterials?.length ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No materials added</p>
          ) : (
            <div className="divide-y">
              {project.projectMaterials.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{m.description ?? m.inventory?.name ?? '—'}</p>
                    {m.inventory?.partNumber && (
                      <p className="text-xs text-muted-foreground font-mono">{m.inventory.partNumber}</p>
                    )}
                    {!m.inventoryId && (
                      <p className="text-xs text-muted-foreground">Custom part</p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-muted-foreground">× {m.quantityRequired}</span>
                    <span className="text-muted-foreground">{formatCurrency(m.unitPriceAtQuote)} ea.</span>
                    <span className="font-semibold">{formatCurrency(Number(m.unitPriceAtQuote) * m.quantityRequired)}</span>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveMaterial(m.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end px-6 py-3 bg-gray-50">
                <span className="font-semibold">Total Materials: {formatCurrency(materialsTotal)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Reports */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Service Reports
            <span className="text-sm font-normal text-muted-foreground">({project.serviceReports?.length ?? 0})</span>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Work
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!project.serviceReports?.length ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No service reports yet</p>
          ) : (
            <div className="divide-y">
              {project.serviceReports.map((r) => (
                <div key={r.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground">{r.technician?.name ?? 'Unknown'}</span>
                      <span>·</span>
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground">{Number(r.hoursLogged).toFixed(1)}h</span>
                      {r.workType && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.workType === 'DESIGN_ENGINEER'  ? 'bg-purple-100 text-purple-700' :
                          r.workType === 'PROJECT_MANAGER'  ? 'bg-green-100 text-green-700' :
                                                              'bg-blue-100 text-blue-700'
                        }`}>
                          {r.workType === 'DESIGN_ENGINEER' ? 'Design' :
                           r.workType === 'PROJECT_MANAGER' ? 'Management' : 'Service'}
                        </span>
                      )}
                      <span>·</span>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDateTime(r.submittedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.digitalSignature && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Signed
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                        title="Attachments (photos, docs, videos)"
                        onClick={() => setReportMediaTarget(r)}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.workPerformed}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Invoices
            <span className="text-sm font-normal text-muted-foreground">({projectInvoices.length})</span>
          </CardTitle>
          {canEdit && project.status === 'completed' && (
            <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={handleGenerateInvoice} disabled={generateMut.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1" /> {generateMut.isPending ? 'Generating…' : 'Generate Invoice'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {projectInvoices.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              {project.status === 'completed'
                ? 'No invoices yet — click "Generate Invoice" to create one from this project\'s work.'
                : 'Invoices can be generated once the project is marked as Completed.'}
            </p>
          ) : (
            <div className="divide-y">
              {projectInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-mono font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{inv.issueDate ? formatDate(inv.issueDate) : 'No issue date'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-sm">{formatCurrency(inv.totalAmount)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                    <Link to={`/invoices/${inv.id}`} className="text-xs text-blue-600 hover:underline">View →</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Title</Label>
              <Input value={editForm.title ?? ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quoted Total (€)</Label>
              <Input type="number" value={editForm.quotedTotalPrice ?? ''} onChange={(e) => setEditForm({ ...editForm, quotedTotalPrice: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Est. Labor Hrs</Label>
              <Input type="number" value={editForm.estimatedLaborHours ?? ''} onChange={(e) => setEditForm({ ...editForm, estimatedLaborHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Actual Labor Hrs</Label>
              <Input type="number" value={editForm.actualLaborHours ?? ''} onChange={(e) => setEditForm({ ...editForm, actualLaborHours: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea rows={3} value={editForm.termsAndConditions ?? ''} onChange={(e) => setEditForm({ ...editForm, termsAndConditions: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Work Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Work</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type of Work *</Label>
              <Select value={reportForm.workType} onValueChange={(v) => setReportForm({ ...reportForm, workType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVICE_ENGINEER">Service / Installation</SelectItem>
                  <SelectItem value="DESIGN_ENGINEER">Design / Engineering</SelectItem>
                  <SelectItem value="PROJECT_MANAGER">Project Management</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determines which labor rate is applied when generating an invoice.</p>
            </div>
            <div className="space-y-2">
              <Label>Work Performed *</Label>
              <Textarea rows={4} value={reportForm.workPerformed} onChange={(e) => setReportForm({ ...reportForm, workPerformed: e.target.value })} placeholder="Describe the work completed…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours Logged *</Label>
                <Input type="number" min="0.1" max="24" step="0.5" value={reportForm.hoursLogged} onChange={(e) => setReportForm({ ...reportForm, hoursLogged: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Digital Signature</Label>
                <Input value={reportForm.digitalSignature} onChange={(e) => setReportForm({ ...reportForm, digitalSignature: e.target.value })} placeholder="NAME_DATE" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={handleAddReport} disabled={reportMut.isPending}>
              {reportMut.isPending ? 'Submitting…' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Attachments Dialog */}
      {reportMediaTarget && (
        <MediaGalleryDialog
          open={!!reportMediaTarget}
          onClose={() => setReportMediaTarget(null)}
          title={`Report — ${reportMediaTarget.technician?.name ?? 'Technician'}`}
          description={`${formatDateTime(reportMediaTarget.submittedAt)} · Files saved under Customer / Service Reports in Google Drive`}
          entityType="service_report"
          entityId={reportMediaTarget.id}
        />
      )}

      {/* Add Material Dialog */}
      <Dialog open={matOpen} onOpenChange={(v) => { setMatOpen(v); if (!v) { setMatMode('inventory'); setSaveToInventory(false); setMatForm({ inventoryId: '', qty: '1', description: '', unitPrice: '', partNumber: '', brand: '', stockQty: '0' }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Material</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">

            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setMatMode('inventory')}
                className={`flex-1 px-3 py-2 font-medium transition-colors ${matMode === 'inventory' ? 'bg-slate-900 text-white' : 'bg-white text-muted-foreground hover:bg-gray-50'}`}
              >
                From Inventory
              </button>
              <button
                type="button"
                onClick={() => setMatMode('custom')}
                className={`flex-1 px-3 py-2 font-medium border-l transition-colors ${matMode === 'custom' ? 'bg-slate-900 text-white' : 'bg-white text-muted-foreground hover:bg-gray-50'}`}
              >
                Custom Part
              </button>
            </div>

            {matMode === 'inventory' ? (
              <>
                <div className="space-y-2">
                  <Label>Part *</Label>
                  <Select value={matForm.inventoryId} onValueChange={(v) => setMatForm({ ...matForm, inventoryId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select part" /></SelectTrigger>
                    <SelectContent>
                      {(inventoryItems as InventoryItem[]).map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.partNumber} – {i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {matForm.inventoryId && (() => {
                    const inv = inventoryItems.find((i) => i.id === matForm.inventoryId);
                    return inv ? (
                      <p className="text-xs text-muted-foreground">
                        Unit price: {formatCurrency(inv.unitPrice)} · Stock: {inv.stockQuantity}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={matForm.qty} onChange={(e) => setMatForm({ ...matForm, qty: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Input
                    placeholder="e.g. Custom bracket, relay, cable…"
                    value={matForm.description}
                    onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" min="1" value={matForm.qty} onChange={(e) => setMatForm({ ...matForm, qty: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price (€) *</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={matForm.unitPrice}
                      onChange={(e) => setMatForm({ ...matForm, unitPrice: e.target.value })}
                    />
                  </div>
                </div>
                {matForm.qty && matForm.unitPrice && Number(matForm.unitPrice) > 0 && (
                  <p className="text-sm font-medium text-right">
                    Line total: {formatCurrency(parseInt(matForm.qty || '1') * Number(matForm.unitPrice))}
                  </p>
                )}

                {/* Save to Inventory toggle */}
                <div className="border-t pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !saveToInventory;
                      setSaveToInventory(next);
                      if (next && !matForm.partNumber && matForm.description.trim()) {
                        const slug = matForm.description.trim()
                          .toUpperCase()
                          .replace(/[^A-Z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '')
                          .slice(0, 40);
                        setMatForm((f) => ({ ...f, partNumber: slug }));
                      }
                    }}
                    className={`flex items-center gap-2.5 text-sm font-medium transition-colors ${saveToInventory ? 'text-blue-700' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${saveToInventory ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${saveToInventory ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    Also add to Inventory
                  </button>
                  <p className="text-xs text-muted-foreground mt-1 ml-11">
                    Creates a catalogue entry so this part can be reused in future projects.
                  </p>
                </div>

                {/* Extra inventory fields (shown when toggled on) */}
                {saveToInventory && (
                  <div className="rounded-lg border bg-blue-50/50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Inventory Details (optional)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Part Number</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="Auto-generated if blank"
                          value={matForm.partNumber}
                          onChange={(e) => setMatForm({ ...matForm, partNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Brand</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. Siemens"
                          value={matForm.brand}
                          onChange={(e) => setMatForm({ ...matForm, brand: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Initial Stock Quantity</Label>
                      <Input
                        className="h-8 text-sm w-32"
                        type="number" min="0"
                        value={matForm.stockQty}
                        onChange={(e) => setMatForm({ ...matForm, stockQty: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">How many units are already in stock (can be 0).</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMaterial}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
