import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FolderOpen } from 'lucide-react';
import { useProjects, useCreateProject, useUpdateProjectStatus, useDeleteProject, useCustomers, useMachines, useInventory } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS, JOB_TYPE_LABELS } from '@/lib/utils';
import { StatusType, JobType, InventoryItem } from '@/types';

const JOB_TYPES: JobType[] = ['maintenance', 'electrical_upgrade', 'retrofit', 'reconstruction'];
const STATUSES: StatusType[] = ['draft', 'pending_approval', 'approved', 'in_progress', 'completed', 'cancelled'];

interface MaterialRow { inventoryId: string; quantityRequired: number; unitCostAtQuote: number; unitPriceAtQuote: number }

const EMPTY_FORM = {
  title: '', customerId: '', machineId: '', type: '' as JobType | '',
  status: 'draft' as StatusType, estimatedLaborHours: '', quotedTotalPrice: '', termsAndConditions: '',
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: customers = [] } = useCustomers();
  const { data: machines = [] } = useMachines();
  const { data: inventoryItems = [] } = useInventory();
  const createMut = useCreateProject();
  const statusMut = useUpdateProjectStatus();
  const deleteMut = useDeleteProject();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [matForm, setMatForm] = useState({ inventoryId: '', qty: '1' });

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.customer?.companyName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchType = filterType === 'all' || p.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const filteredMachines = form.customerId
    ? machines.filter((m) => m.customerId === form.customerId)
    : machines;

  function openCreate() { setForm(EMPTY_FORM); setMaterials([]); setOpen(true); }

  function addMaterial() {
    const inv = inventoryItems.find((i) => i.id === matForm.inventoryId);
    if (!inv) return;
    setMaterials((prev) => [
      ...prev,
      {
        inventoryId: inv.id,
        quantityRequired: parseInt(matForm.qty) || 1,
        unitCostAtQuote: Number(inv.unitCost),
        unitPriceAtQuote: Number(inv.unitPrice),
      },
    ]);
    setMatForm({ inventoryId: '', qty: '1' });
  }

  function removeMaterial(idx: number) { setMaterials((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleCreate() {
    if (!form.title || !form.type || !form.quotedTotalPrice) {
      toast({ title: 'Title, type, and price are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await createMut.mutateAsync({
        title: form.title,
        customerId: form.customerId || undefined,
        machineId: form.machineId || undefined,
        type: form.type,
        status: form.status,
        estimatedLaborHours: parseFloat(form.estimatedLaborHours) || 0,
        quotedTotalPrice: parseFloat(form.quotedTotalPrice),
        termsAndConditions: form.termsAndConditions || undefined,
        materials: materials.length ? materials : undefined,
      });
      toast({ title: 'Project created' });
      setOpen(false);
      navigate(`/projects/${res.data.id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error creating project';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  async function handleQuickStatus(id: string, status: StatusType) {
    try {
      await statusMut.mutateAsync({ id, status });
      toast({ title: `Status updated to ${STATUS_LABELS[status]}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete project "${title}"?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Project deleted' });
    } catch {
      toast({ title: 'Failed to delete project', variant: 'destructive' });
    }
  }

  const materialName = (id: string) => inventoryItems.find((i) => i.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">{projects.length} total</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Projects table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Quoted</TableHead>
              <TableHead className="text-right">Labor (hrs)</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>{[...Array(8)].map((_, j) => <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>)}</TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No projects found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link to={`/projects/${p.id}`} className="font-medium text-sm hover:text-blue-600 transition-colors">
                      {p.title}
                    </Link>
                    {p.machine && <p className="text-xs text-muted-foreground">{p.machine.name}</p>}
                  </TableCell>
                  <TableCell>
                    {p.customer ? (
                      <Link to={`/customers/${p.customer.id}`} className="text-sm hover:text-blue-600">
                        {p.customer.companyName}
                      </Link>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                      {JOB_TYPE_LABELS[p.type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select value={p.status} onValueChange={(v) => handleQuickStatus(p.id, v as StatusType)}>
                        <SelectTrigger className={`h-7 text-xs w-36 border-0 shadow-none px-2.5 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.quotedTotalPrice)}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className="text-muted-foreground">{Number(p.actualLaborHours).toFixed(1)}</span>
                    <span className="text-muted-foreground"> / {Number(p.estimatedLaborHours).toFixed(1)}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link to={`/projects/${p.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                      </Link>
                      {user?.role === 'admin' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDelete(p.id, p.title)}>Del</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. CNC Machine Full Retrofit" />
              </div>
              <div className="space-y-2">
                <Label>Job Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as JobType })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as StatusType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v, machineId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Machine</Label>
                <Select value={form.machineId} onValueChange={(v) => setForm({ ...form, machineId: v })} disabled={filteredMachines.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                  <SelectContent>
                    {filteredMachines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quoted Total (€) *</Label>
                <Input type="number" min="0" step="0.01" value={form.quotedTotalPrice} onChange={(e) => setForm({ ...form, quotedTotalPrice: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Est. Labor Hours</Label>
                <Input type="number" min="0" step="0.5" value={form.estimatedLaborHours} onChange={(e) => setForm({ ...form, estimatedLaborHours: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Terms & Conditions</Label>
                <Textarea rows={2} value={form.termsAndConditions} onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })} />
              </div>
            </div>

            {/* Materials */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Bill of Materials</Label>
              <div className="flex gap-2">
                <Select value={matForm.inventoryId} onValueChange={(v) => setMatForm({ ...matForm, inventoryId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select part" /></SelectTrigger>
                  <SelectContent>
                    {(inventoryItems as InventoryItem[]).map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.partNumber} – {i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number" min="1" className="w-20" placeholder="Qty"
                  value={matForm.qty} onChange={(e) => setMatForm({ ...matForm, qty: e.target.value })}
                />
                <Button type="button" variant="outline" onClick={addMaterial} disabled={!matForm.inventoryId}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {materials.length > 0 && (
                <div className="rounded-md border divide-y">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{materialName(m.inventoryId)}</span>
                        <span className="text-muted-foreground ml-2">× {m.quantityRequired}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{formatCurrency(m.unitPriceAtQuote * m.quantityRequired)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMaterial(i)}>×</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
