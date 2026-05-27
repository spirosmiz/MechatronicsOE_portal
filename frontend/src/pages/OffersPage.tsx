import { useState } from 'react';
import {
  Plus, Search, FileSignature, Edit, Trash2, ChevronDown,
  CalendarClock, AlertTriangle, CheckCircle2, Clock, Cpu,
  FileDown, FileText, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useOffers, useCreateOffer, useUpdateOffer, useDeleteOffer,
  useUpdateOfferStatus, useUpdateOfferPayment, useCustomers, useMachines,
} from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { offersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Offer, OfferItem } from '@/types';
import {
  formatCurrency, formatDate,
  OFFER_STATUS_COLORS, OFFER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS,
} from '@/lib/utils';

type FilterStatus = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
type FilterPayment = 'all' | 'unpaid' | 'invoiced' | 'partially_paid' | 'paid';

interface CostBreakdown {
  designHours: string;
  designRate: string;
  serviceHours: string;
  serviceRate: string;
  transportKm: string;
  transportRoundTrip: boolean;
  transportFuelRate: string;
  transportTollRate: string;
  machiningCost: string;
  partsMode: 'lump' | 'itemized';
  partsLumpSum: string;
  partsItems: { description: string; amount: string }[];
}

const EMPTY_COSTS: CostBreakdown = {
  designHours: '', designRate: '25',
  serviceHours: '', serviceRate: '60',
  transportKm: '',
  transportRoundTrip: true,
  transportFuelRate: '15',
  transportTollRate: '4',
  machiningCost: '',
  partsMode: 'lump',
  partsLumpSum: '',
  partsItems: [{ description: '', amount: '' }],
};

const EMPTY_FORM = {
  customerId: '',
  machineId: '',
  title: '',
  description: '',
  offerDate: new Date().toISOString().split('T')[0],
  validUntil: '',
  notes: '',
};

function isOverdue(offer: Offer) {
  return offer.status === 'sent' && new Date(offer.validUntil) < new Date();
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function OffersPage() {
  const { data: offers = [], isLoading } = useOffers();
  const { data: customers = [] } = useCustomers();
  const { data: allMachines = [] } = useMachines();
  const createMut = useCreateOffer();
  const updateMut = useUpdateOffer();
  const deleteMut = useDeleteOffer();
  const statusMut = useUpdateOfferStatus();
  const paymentMut = useUpdateOfferPayment();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPayment, setFilterPayment] = useState<FilterPayment>('all');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [costs, setCosts] = useState<CostBreakdown>(EMPTY_COSTS);

  const filtered = offers.filter((o) => {
    const matchSearch =
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.companyName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchPayment = filterPayment === 'all' || o.paymentStatus === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  });

  const sentCount = offers.filter((o) => o.status === 'sent').length;
  const overdueCount = offers.filter(isOverdue).length;
  const acceptedCount = offers.filter((o) => o.status === 'accepted').length;
  const totalAccepted = offers
    .filter((o) => o.status === 'accepted')
    .reduce((s, o) => s + Number(o.totalAmount), 0);

  const customerMachines = allMachines.filter((m) => m.customerId === form.customerId);

  function computeTransport() {
    const km = Number(costs.transportKm || 0);
    const effectiveKm = km * (costs.transportRoundTrip ? 2 : 1);
    const fuel = (effectiveKm / 100) * Number(costs.transportFuelRate || 0);
    const toll = (effectiveKm / 100) * Number(costs.transportTollRate || 0);
    return { km, effectiveKm, fuel, toll, total: fuel + toll };
  }

  function computeTotal() {
    const design = Number(costs.designHours || 0) * Number(costs.designRate || 0);
    const service = Number(costs.serviceHours || 0) * Number(costs.serviceRate || 0);
    const transport = computeTransport().total;
    const machining = Number(costs.machiningCost || 0);
    const parts = costs.partsMode === 'lump'
      ? Number(costs.partsLumpSum || 0)
      : costs.partsItems.reduce((s, p) => s + Number(p.amount || 0), 0);
    return design + service + transport + machining + parts;
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, offerDate: new Date().toISOString().split('T')[0] });
    setCosts(EMPTY_COSTS);
    setOpen(true);
  }

  function openEdit(o: Offer) {
    setEditing(o);
    setForm({
      customerId: o.customerId ?? '',
      machineId: o.machineId ?? '',
      title: o.title,
      description: o.description ?? '',
      offerDate: o.offerDate.split('T')[0],
      validUntil: o.validUntil.split('T')[0],
      notes: o.notes ?? '',
    });

    const items = o.items ?? [];
    const parsed: CostBreakdown = { ...EMPTY_COSTS, partsItems: [] };

    for (const item of items) {
      const desc = item.description;
      if (desc.startsWith('Design Engineering')) {
        parsed.designHours = String(item.quantity);
        parsed.designRate = String(item.unitPrice);
      } else if (desc.startsWith('Service / Installation')) {
        parsed.serviceHours = String(item.quantity);
        parsed.serviceRate = String(item.unitPrice);
      } else if (desc === 'Transportation') {
        // Total cost is stored; km/rates cannot be recovered — leave at defaults
      } else if (desc === 'Machining') {
        parsed.machiningCost = String(item.unitPrice);
      } else if (desc === 'Parts') {
        parsed.partsMode = 'lump';
        parsed.partsLumpSum = String(item.unitPrice);
      } else if (desc.startsWith('Parts — ')) {
        parsed.partsMode = 'itemized';
        parsed.partsItems.push({ description: desc.slice(8), amount: String(item.unitPrice) });
      }
    }

    if (parsed.partsItems.length === 0) {
      parsed.partsItems = [{ description: '', amount: '' }];
    }
    setCosts(parsed);
    setOpen(true);
  }

  function openDetail(o: Offer) {
    setSelected(o);
    setDetailOpen(true);
  }

  async function downloadFile(id: string, title: string, type: 'pdf' | 'docx') {
    try {
      const res = type === 'pdf'
        ? await offersApi.downloadPdf(id)
        : await offersApi.downloadDocx(id);
      const ext = type === 'pdf' ? 'pdf' : 'docx';
      const mime = type === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title} - Offer.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: `Failed to download ${type.toUpperCase()}`, variant: 'destructive' });
    }
  }

  function addPartsItem() {
    setCosts({ ...costs, partsItems: [...costs.partsItems, { description: '', amount: '' }] });
  }

  function removePartsItem(i: number) {
    setCosts({ ...costs, partsItems: costs.partsItems.filter((_, idx) => idx !== i) });
  }

  function updatePartsItem(i: number, field: 'description' | 'amount', value: string) {
    setCosts({
      ...costs,
      partsItems: costs.partsItems.map((p, idx) => idx === i ? { ...p, [field]: value } : p),
    });
  }

  async function handleSave() {
    // Client-side validation with specific messages
    if (!form.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' }); return;
    }
    if (!form.validUntil) {
      toast({ title: 'Valid Until date is required', variant: 'destructive' }); return;
    }
    if (form.validUntil < form.offerDate) {
      toast({ title: 'Valid Until must be after the Offer Date', variant: 'destructive' }); return;
    }
    if (computeTotal() <= 0) {
      toast({ title: 'Enter at least one cost item to create an offer', variant: 'destructive' }); return;
    }

    try {
      const items: { description: string; quantity: number; unitPrice: number }[] = [];

      if (costs.designHours && costs.designRate) {
        items.push({
          description: 'Design Engineering',
          quantity: Number(costs.designHours),
          unitPrice: Number(costs.designRate),
        });
      }
      if (costs.serviceHours && costs.serviceRate) {
        items.push({
          description: 'Service / Installation',
          quantity: Number(costs.serviceHours),
          unitPrice: Number(costs.serviceRate),
        });
      }
      const tr = computeTransport();
      if (tr.total > 0) {
        items.push({
          description: 'Transportation',
          quantity: 1,
          unitPrice: tr.total,
        });
      }
      if (costs.machiningCost) {
        items.push({ description: 'Machining', quantity: 1, unitPrice: Number(costs.machiningCost) });
      }
      if (costs.partsMode === 'lump' && costs.partsLumpSum) {
        items.push({ description: 'Parts', quantity: 1, unitPrice: Number(costs.partsLumpSum) });
      } else if (costs.partsMode === 'itemized') {
        for (const p of costs.partsItems) {
          if (p.description.trim() && p.amount) {
            items.push({ description: `Parts — ${p.description.trim()}`, quantity: 1, unitPrice: Number(p.amount) });
          }
        }
      }

      const data: Record<string, unknown> = {
        customerId: form.customerId || undefined,
        machineId: form.machineId || undefined,
        title: form.title,
        description: form.description || undefined,
        offerDate: form.offerDate,
        validUntil: form.validUntil,
        totalAmount: computeTotal(),
        notes: form.notes || undefined,
        items,
      };

      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data });
        toast({ title: 'Offer updated' });
      } else {
        await createMut.mutateAsync(data);
        toast({ title: 'Offer created' });
      }
      setOpen(false);
    } catch (e: unknown) {
      type ApiError = { response?: { data?: { message?: string; errors?: { msg: string; path?: string }[] } } };
      const data = (e as ApiError)?.response?.data;
      let msg = 'Error saving offer';
      if (data?.errors?.length) {
        const fieldLabels: Record<string, string> = {
          title: 'Title', validUntil: 'Valid Until', totalAmount: 'Total Amount',
        };
        msg = data.errors
          .map((err) => `${fieldLabels[err.path ?? ''] ?? err.path ?? 'Field'}: ${err.msg}`)
          .join(' · ');
      } else if (data?.message) {
        msg = data.message;
      }
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete offer "${title}"?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Offer deleted' });
    } catch {
      toast({ title: 'Failed to delete offer', variant: 'destructive' });
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await statusMut.mutateAsync({ id, status });
      toast({ title: `Status updated to ${OFFER_STATUS_LABELS[status]}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  async function handlePaymentChange(id: string, paymentStatus: string) {
    try {
      await paymentMut.mutateAsync({ id, paymentStatus });
      toast({ title: `Payment updated to ${PAYMENT_STATUS_LABELS[paymentStatus]}` });
    } catch {
      toast({ title: 'Failed to update payment status', variant: 'destructive' });
    }
  }

  const designTotal = Number(costs.designHours || 0) * Number(costs.designRate || 0);
  const serviceTotal = Number(costs.serviceHours || 0) * Number(costs.serviceRate || 0);
  const transportTotal = computeTransport().total;
  const partsTotal = costs.partsMode === 'lump'
    ? Number(costs.partsLumpSum || 0)
    : costs.partsItems.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offers</h1>
          <p className="text-muted-foreground">{offers.length} total offers</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Offer
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sentCount}</p>
              <p className="text-xs text-muted-foreground">Awaiting Response</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{acceptedCount}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <FileSignature className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-sm leading-tight">{formatCurrency(totalAccepted)}</p>
              <p className="text-xs text-muted-foreground">Accepted Value</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(OFFER_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={(v) => setFilterPayment(v as FilterPayment)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All payments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No offers found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Title / Customer</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Offer Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Valid Until</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((o) => {
                const days = daysUntil(o.validUntil);
                const overdue = isOverdue(o);
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button className="font-medium hover:text-blue-600 text-left" onClick={() => openDetail(o)}>
                        {o.title}
                      </button>
                      {o.customer && (
                        <Link to={`/customers/${o.customer.id}`} className="text-xs text-muted-foreground hover:text-blue-600 block">
                          {o.customer.companyName}
                        </Link>
                      )}
                      {o.machine && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Cpu className="w-3 h-3" />{o.machine.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.offerDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {overdue ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        ) : days <= 7 && o.status === 'sent' ? (
                          <CalendarClock className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        ) : null}
                        <span className={overdue ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                          {formatDate(o.validUntil)}
                        </span>
                      </div>
                      {o.status === 'sent' && !overdue && days >= 0 && days <= 14 && (
                        <p className="text-xs text-yellow-600">{days}d left</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <Select value={o.status} onValueChange={(v) => handleStatusChange(o.id, v)}>
                          <SelectTrigger className="h-7 w-32 text-xs border-0 p-0 focus:ring-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OFFER_STATUS_COLORS[o.status]}`}>
                              {OFFER_STATUS_LABELS[o.status]}
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(OFFER_STATUS_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`${OFFER_STATUS_COLORS[o.status]} border-0`}>
                          {OFFER_STATUS_LABELS[o.status]}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <Select value={o.paymentStatus} onValueChange={(v) => handlePaymentChange(o.id, v)}>
                          <SelectTrigger className="h-7 w-36 text-xs border-0 p-0 focus:ring-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[o.paymentStatus]}`}>
                              {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`${PAYMENT_STATUS_COLORS[o.paymentStatus]} border-0`}>
                          {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(o.id, o.title)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Offer' : 'New Offer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Offer title" />
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={form.customerId || '__none__'}
                  onValueChange={(v) => setForm({ ...form, customerId: v === '__none__' ? '' : v, machineId: '' })}
                >
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Machine</Label>
                <Select
                  value={form.machineId || '__none__'}
                  onValueChange={(v) => setForm({ ...form, machineId: v === '__none__' ? '' : v })}
                  disabled={!form.customerId}
                >
                  <SelectTrigger><SelectValue placeholder={form.customerId ? 'Select machine' : 'Select customer first'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {customerMachines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}{m.model ? ` (${m.model})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Offer Date</Label>
                <Input type="date" value={form.offerDate} onChange={(e) => setForm({ ...form, offerDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief scope description…" />
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cost Breakdown</Label>

              {/* Design Engineering */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Design Engineering</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input type="number" min="0" step="0.5" placeholder="Hours" value={costs.designHours}
                      onChange={(e) => setCosts({ ...costs, designHours: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <span className="text-muted-foreground text-sm">h ×</span>
                  <div className="flex-1">
                    <Input type="number" min="0" step="0.01" placeholder="Rate €/h" value={costs.designRate}
                      onChange={(e) => setCosts({ ...costs, designRate: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <span className="text-muted-foreground text-sm">€/h =</span>
                  <div className="w-24 text-right text-sm font-medium">
                    {designTotal > 0 ? formatCurrency(designTotal) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>

              {/* Service / Installation */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Service / Installation</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input type="number" min="0" step="0.5" placeholder="Hours" value={costs.serviceHours}
                      onChange={(e) => setCosts({ ...costs, serviceHours: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <span className="text-muted-foreground text-sm">h ×</span>
                  <div className="flex-1">
                    <Input type="number" min="0" step="0.01" placeholder="Rate €/h" value={costs.serviceRate}
                      onChange={(e) => setCosts({ ...costs, serviceRate: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <span className="text-muted-foreground text-sm">€/h =</span>
                  <div className="w-24 text-right text-sm font-medium">
                    {serviceTotal > 0 ? formatCurrency(serviceTotal) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>

              {/* Transportation */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Transportation</p>
                  <button
                    type="button"
                    onClick={() => setCosts({ ...costs, transportRoundTrip: !costs.transportRoundTrip })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      costs.transportRoundTrip
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Round trip {costs.transportRoundTrip ? '✓' : ''}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input type="number" min="0" step="1" placeholder="Distance (km)"
                      value={costs.transportKm}
                      onChange={(e) => setCosts({ ...costs, transportKm: e.target.value })}
                      className="h-8 text-sm" />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {costs.transportRoundTrip && costs.transportKm
                      ? `× 2 = ${Number(costs.transportKm) * 2} km`
                      : 'km'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Fuel rate (€/100 km)</p>
                    <Input type="number" min="0" step="0.1" value={costs.transportFuelRate}
                      onChange={(e) => setCosts({ ...costs, transportFuelRate: e.target.value })}
                      className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Toll rate (€/100 km)</p>
                    <Input type="number" min="0" step="0.1" value={costs.transportTollRate}
                      onChange={(e) => setCosts({ ...costs, transportTollRate: e.target.value })}
                      className="h-8 text-sm" />
                  </div>
                </div>
                {(() => {
                  const tr = computeTransport();
                  if (tr.total <= 0) return null;
                  return (
                    <div className="flex items-center justify-between bg-orange-50 rounded px-3 py-2 text-xs">
                      <span className="text-muted-foreground">
                        Fuel <span className="font-medium text-foreground">{formatCurrency(tr.fuel)}</span>
                        {' + '}Tolls <span className="font-medium text-foreground">{formatCurrency(tr.toll)}</span>
                      </span>
                      <span className="font-semibold text-orange-700">{formatCurrency(tr.total)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Machining */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Machining <span className="normal-case font-normal text-muted-foreground">(optional)</span></p>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" step="0.01" placeholder="Cost €" value={costs.machiningCost}
                    onChange={(e) => setCosts({ ...costs, machiningCost: e.target.value })} className="h-8 text-sm w-48" />
                  {Number(costs.machiningCost) > 0 && (
                    <span className="text-sm font-medium">{formatCurrency(Number(costs.machiningCost))}</span>
                  )}
                </div>
              </div>

              {/* Parts */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Parts</p>
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setCosts({ ...costs, partsMode: 'lump' })}
                      className={`px-2.5 py-1 transition-colors ${costs.partsMode === 'lump' ? 'bg-slate-900 text-white' : 'bg-white text-muted-foreground hover:bg-gray-50'}`}
                    >
                      Lump sum
                    </button>
                    <button
                      type="button"
                      onClick={() => setCosts({ ...costs, partsMode: 'itemized' })}
                      className={`px-2.5 py-1 border-l transition-colors ${costs.partsMode === 'itemized' ? 'bg-slate-900 text-white' : 'bg-white text-muted-foreground hover:bg-gray-50'}`}
                    >
                      Itemized
                    </button>
                  </div>
                </div>
                {costs.partsMode === 'lump' ? (
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" step="0.01" placeholder="Total parts cost €" value={costs.partsLumpSum}
                      onChange={(e) => setCosts({ ...costs, partsLumpSum: e.target.value })} className="h-8 text-sm w-48" />
                    {Number(costs.partsLumpSum) > 0 && (
                      <span className="text-sm font-medium">{formatCurrency(Number(costs.partsLumpSum))}</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {costs.partsItems.map((p, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input className="h-8 text-sm flex-1" placeholder="Part description" value={p.description}
                          onChange={(e) => updatePartsItem(i, 'description', e.target.value)} />
                        <Input className="h-8 text-sm w-28" type="number" step="0.01" min="0" placeholder="€" value={p.amount}
                          onChange={(e) => updatePartsItem(i, 'amount', e.target.value)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removePartsItem(i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addPartsItem} className="text-xs h-7">
                      <Plus className="w-3 h-3 mr-1" /> Add part
                    </Button>
                    {partsTotal > 0 && (
                      <p className="text-sm font-medium text-right pt-1">Parts total: {formatCurrency(partsTotal)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {designTotal > 0 && <span>Design: {formatCurrency(designTotal)}</span>}
                {serviceTotal > 0 && <span>Service: {formatCurrency(serviceTotal)}</span>}
                {transportTotal > 0 && <span>Transport: {formatCurrency(transportTotal)}</span>}
                {Number(costs.machiningCost) > 0 && <span>Machining: {formatCurrency(Number(costs.machiningCost))}</span>}
                {partsTotal > 0 && <span>Parts: {formatCurrency(partsTotal)}</span>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-0.5">Grand Total</p>
                <p className="text-xl font-bold">{formatCurrency(computeTotal())}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes, terms, remarks…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save Offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selected && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${OFFER_STATUS_COLORS[selected.status]}`}>
                  {OFFER_STATUS_LABELS[selected.status]}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[selected.paymentStatus]}`}>
                  {PAYMENT_STATUS_LABELS[selected.paymentStatus]}
                </span>
                {isOverdue(selected) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    <AlertTriangle className="w-3 h-3" /> Overdue
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {selected.customer && (
                  <>
                    <p className="text-muted-foreground">Customer</p>
                    <Link to={`/customers/${selected.customer.id}`} className="font-medium hover:text-blue-600" onClick={() => setDetailOpen(false)}>
                      {selected.customer.companyName}
                    </Link>
                  </>
                )}
                {selected.customer?.contactPerson && (
                  <>
                    <p className="text-muted-foreground">Contact</p>
                    <p>{selected.customer.contactPerson}</p>
                  </>
                )}
                {selected.machine && (
                  <>
                    <p className="text-muted-foreground">Machine</p>
                    <p className="font-medium flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                      {selected.machine.name}{selected.machine.model ? ` — ${selected.machine.model}` : ''}
                    </p>
                  </>
                )}
                <p className="text-muted-foreground">Offer Date</p>
                <p>{formatDate(selected.offerDate)}</p>
                <p className="text-muted-foreground">Valid Until</p>
                <p className={isOverdue(selected) ? 'text-orange-600 font-medium' : ''}>{formatDate(selected.validUntil)}</p>
                <p className="text-muted-foreground">Total Amount</p>
                <p className="font-bold text-base">{formatCurrency(selected.totalAmount)}</p>
              </div>

              {selected.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{selected.description}</p>
                </div>
              )}

              {selected.items && selected.items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Cost Breakdown</p>
                  <div className="rounded border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Unit €</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selected.items.map((item: OfferItem) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t">
                          <td colSpan={3} className="px-3 py-2 text-right text-sm font-medium">Total</td>
                          <td className="px-3 py-2 text-right font-bold">{formatCurrency(selected.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                </div>
              )}

              {selected.creator && (
                <p className="text-xs text-muted-foreground">Created by {selected.creator.name}</p>
              )}

              {/* Drive / download row */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => downloadFile(selected.id, selected.title, 'pdf')}>
                  <FileDown className="w-3.5 h-3.5 mr-1.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadFile(selected.id, selected.title, 'docx')}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Word
                </Button>
                {selected.drivePdfUrl && (
                  <a
                    href={selected.drivePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline ml-auto"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View on Drive
                  </a>
                )}
              </div>
            </div>
            <DialogFooter>
              {canEdit && (
                <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selected); }}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              )}
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
