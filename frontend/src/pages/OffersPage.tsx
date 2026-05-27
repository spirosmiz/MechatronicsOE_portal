import { useState } from 'react';
import {
  Plus, Search, FileSignature, Edit, Trash2, ChevronDown,
  CalendarClock, AlertTriangle, CheckCircle2, Clock, Cpu,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useOffers, useCreateOffer, useUpdateOffer, useDeleteOffer,
  useUpdateOfferStatus, useUpdateOfferPayment, useCustomers, useMachines,
} from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
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

interface LineItem { description: string; quantity: number; unitPrice: string }

const EMPTY_FORM = {
  customerId: '',
  machineId: '',
  title: '',
  description: '',
  offerDate: new Date().toISOString().split('T')[0],
  validUntil: '',
  totalAmount: '',
  notes: '',
};

function isOverdue(offer: Offer) {
  return offer.status === 'sent' && new Date(offer.validUntil) < new Date();
}

function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  return diff;
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
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const filtered = offers.filter((o) => {
    const matchSearch =
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.companyName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchPayment = filterPayment === 'all' || o.paymentStatus === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  });

  // KPI counts
  const sentCount = offers.filter((o) => o.status === 'sent').length;
  const overdueCount = offers.filter(isOverdue).length;
  const acceptedCount = offers.filter((o) => o.status === 'accepted').length;
  const totalAccepted = offers
    .filter((o) => o.status === 'accepted')
    .reduce((s, o) => s + Number(o.totalAmount), 0);

  const customerMachines = allMachines.filter((m) => m.customerId === form.customerId);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, offerDate: new Date().toISOString().split('T')[0] });
    setLineItems([{ description: '', quantity: 1, unitPrice: '' }]);
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
      totalAmount: String(o.totalAmount),
      notes: o.notes ?? '',
    });
    setLineItems(
      o.items?.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: String(i.unitPrice) }))
        ?? [{ description: '', quantity: 1, unitPrice: '' }]
    );
    setOpen(true);
  }

  function openDetail(o: Offer) {
    setSelected(o);
    setDetailOpen(true);
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: '' }]);
  }

  function removeLineItem(i: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }

  function updateLineItem(i: number, field: keyof LineItem, value: string | number) {
    setLineItems(lineItems.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function computeTotal() {
    return lineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice || 0)), 0);
  }

  async function handleSave() {
    try {
      const validItems = lineItems.filter((i) => i.description.trim() && i.unitPrice);
      const data: Record<string, unknown> = {
        customerId: form.customerId || undefined,
        machineId: form.machineId || undefined,
        title: form.title,
        description: form.description || undefined,
        offerDate: form.offerDate,
        validUntil: form.validUntil,
        totalAmount: form.totalAmount || computeTotal(),
        notes: form.notes || undefined,
        items: validItems.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
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
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error saving offer';
      toast({ title: msg, variant: 'destructive' });
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
                <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v, machineId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Machine</Label>
                <Select value={form.machineId} onValueChange={(v) => setForm({ ...form, machineId: v })} disabled={!form.customerId}>
                  <SelectTrigger><SelectValue placeholder={form.customerId ? 'Select machine' : 'Select customer first'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
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
              <div className="space-y-2">
                <Label>Total Amount (€) — leave blank to auto-sum items</Label>
                <Input type="number" step="0.01" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items</Label>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Add row
                </Button>
              </div>
              <div className="rounded border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Qty</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Unit Price €</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-sm" value={item.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-sm" type="number" min="1" value={item.quantity} onChange={(e) => updateLineItem(i, 'quantity', Number(e.target.value))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-sm" type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateLineItem(i, 'unitPrice', e.target.value)} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {item.unitPrice ? formatCurrency(Number(item.quantity) * Number(item.unitPrice)) : '—'}
                        </td>
                        <td className="px-1 py-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeLineItem(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t">
                      <td colSpan={3} className="px-3 py-2 text-right text-sm font-medium">Auto-sum:</td>
                      <td className="px-3 py-2 text-right font-bold text-sm">{formatCurrency(computeTotal())}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">Line Items</p>
                  <div className="rounded border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
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
