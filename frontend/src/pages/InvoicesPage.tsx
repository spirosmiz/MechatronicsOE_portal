import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Receipt, TrendingUp, TrendingDown, Clock,
  Trash2, Eye, ChevronDown, Pencil, ScanLine, Upload, Loader2, CheckCircle2,
} from 'lucide-react';
import {
  useInvoices, useInvoiceStats, useCreateInvoice, useUpdateInvoice,
  useDeleteInvoice, useUpdateInvoiceStatus, useCustomers, useSuppliers,
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
import { Invoice, InvoiceDirection, InvoiceCategory } from '@/types';
import { invoicesApi } from '@/lib/api';
import {
  formatCurrency, formatDate,
  INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS,
  INVOICE_CATEGORY_COLORS, INVOICE_CATEGORY_LABELS,
} from '@/lib/utils';

const OUTGOING_CATEGORIES: InvoiceCategory[] = ['PROJECT_BILLING', 'SERVICE_BILLING', 'PARTS_SALE'];
const INCOMING_CATEGORIES: InvoiceCategory[] = [
  'LABOR_SERVICE_ENGINEER', 'LABOR_DESIGN_ENGINEER',
  'MACHINING_SUBCONTRACT', 'SPARE_PARTS_PURCHASE', 'OPERATIONAL',
];

const EMPTY_FORM = {
  direction:   'OUTGOING' as InvoiceDirection,
  category:    'PROJECT_BILLING' as InvoiceCategory,
  customerId:  '',
  supplierId:  '',
  projectId:   '',
  offerId:     '',
  taxRate:     '0.24',
  currency:    'EUR',
  issueDate:   new Date().toISOString().split('T')[0],
  dueDate:     '',
  notes:       '',
};

type ItemRow = { description: string; quantity: string; unitPrice: string; hoursLogged: string; hourlyRate: string };
const EMPTY_ITEM: ItemRow = { description: '', quantity: '1', unitPrice: '', hoursLogged: '', hourlyRate: '' };

function itemLineTotal(item: ItemRow) {
  return Number(item.quantity || 0) * Number(item.unitPrice || 0);
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [filterDirection, setFilterDirection] = useState('all');
  const [filterStatus, setFilterStatus]       = useState('all');
  const [filterCategory, setFilterCategory]   = useState('all');
  const [search, setSearch]                   = useState('');
  const [open, setOpen]                       = useState(false);
  const [editing, setEditing]                 = useState<Invoice | null>(null);
  const [form, setForm]                       = useState(EMPTY_FORM);
  const [items, setItems]                     = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);

  // Upload + AI extraction state
  const [uploadOpen, setUploadOpen]         = useState(false);
  const [uploadFile, setUploadFile]         = useState<File | null>(null);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [extracting, setExtracting]         = useState(false);
  const [extractedNote, setExtractedNote]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params: Record<string, string> = {};
  if (filterDirection !== 'all') params.direction = filterDirection;
  if (filterStatus    !== 'all') params.status    = filterStatus;
  if (filterCategory  !== 'all') params.category  = filterCategory;

  const { data: invoices = [], isLoading } = useInvoices(params);
  const { data: stats } = useInvoiceStats();
  const { data: customers = [] } = useCustomers();
  const { data: suppliers = [] } = useSuppliers();

  const createMut       = useCreateInvoice();
  const updateMut       = useUpdateInvoice();
  const deleteMut       = useDeleteInvoice();
  const statusMut       = useUpdateInvoiceStatus();

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customer?.companyName.toLowerCase().includes(q) ||
      inv.supplier?.companyName.toLowerCase().includes(q) ||
      inv.project?.title.toLowerCase().includes(q)
    );
  });

  const subtotal = items.reduce((s, it) => s + itemLineTotal(it), 0);
  const taxAmount = subtotal * Number(form.taxRate || 0);
  const totalAmount = subtotal + taxAmount;

  const categoryOptions = form.direction === 'OUTGOING' ? OUTGOING_CATEGORIES : INCOMING_CATEGORIES;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setItems([{ ...EMPTY_ITEM }]);
    setExtractedNote('');
    setOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditing(inv);
    setForm({
      direction:   inv.direction,
      category:    inv.category,
      customerId:  inv.customerId  ?? '',
      supplierId:  inv.supplierId  ?? '',
      projectId:   inv.projectId   ?? '',
      offerId:     inv.offerId     ?? '',
      taxRate:     String(inv.taxRate),
      currency:    inv.currency,
      issueDate:   inv.issueDate ? inv.issueDate.split('T')[0] : '',
      dueDate:     inv.dueDate   ? inv.dueDate.split('T')[0]   : '',
      notes:       inv.notes     ?? '',
    });
    setItems(
      (inv.items ?? []).map((it) => ({
        description: it.description,
        quantity:    String(it.quantity),
        unitPrice:   String(it.unitPrice),
        hoursLogged: it.hoursLogged ? String(it.hoursLogged) : '',
        hourlyRate:  it.hourlyRate  ? String(it.hourlyRate)  : '',
      }))
    );
    setOpen(true);
  }

  const handleFileDrop = useCallback((file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Unsupported file type. Use JPG, PNG, WEBP, or PDF.', variant: 'destructive' });
      return;
    }
    setUploadFile(file);
  }, [toast]);

  async function handleExtract() {
    if (!uploadFile) return;
    setExtracting(true);
    setExtractedNote('');
    try {
      const res = await invoicesApi.extract(uploadFile);
      const d = (res as any).data as Record<string, any>;

      // Map AI direction hint: if supplier is set and customer is us, it's INCOMING
      // We let the user override, but default based on document
      const direction: InvoiceDirection = 'INCOMING'; // physical receipts are usually expenses
      const cat: InvoiceCategory = 'OPERATIONAL';

      const taxRate = d.taxRate != null ? String(d.taxRate) : '0.24';

      setForm({
        direction,
        category: cat,
        customerId: '',
        supplierId: '',
        projectId: '',
        offerId: '',
        taxRate,
        currency: d.currency ?? 'EUR',
        issueDate: d.issueDate ?? new Date().toISOString().split('T')[0],
        dueDate: d.dueDate ?? '',
        notes: [
          d.notes,
          d.supplierName   ? `Supplier: ${d.supplierName}` : null,
          d.customerName   ? `Customer: ${d.customerName}` : null,
          d.vatNumber      ? `VAT: ${d.vatNumber}` : null,
          d.invoiceNumber  ? `Ref: ${d.invoiceNumber}` : null,
        ].filter(Boolean).join(' · ') || '',
      });

      const extractedItems: ItemRow[] = (d.items ?? []).map((it: any) => ({
        description: it.description ?? '',
        quantity:    String(it.quantity ?? 1),
        unitPrice:   String(it.unitPrice ?? 0),
        hoursLogged: '',
        hourlyRate:  '',
      }));

      setItems(extractedItems.length > 0 ? extractedItems : [{ ...EMPTY_ITEM }]);
      setEditing(null);
      setExtractedNote(d.invoiceNumber ? `Extracted from: ${d.invoiceNumber}` : 'Data extracted — please review before saving');
      setUploadOpen(false);
      setOpen(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Extraction failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!form.category) { toast({ title: 'Category is required', variant: 'destructive' }); return; }
    if (items.every((it) => !it.description.trim())) {
      toast({ title: 'At least one line item is required', variant: 'destructive' }); return;
    }

    const payload: Record<string, unknown> = {
      direction:   form.direction,
      category:    form.category,
      customerId:  form.customerId  || undefined,
      supplierId:  form.supplierId  || undefined,
      projectId:   form.projectId   || undefined,
      offerId:     form.offerId     || undefined,
      subtotal,
      taxRate:     Number(form.taxRate),
      currency:    form.currency,
      issueDate:   form.issueDate   || undefined,
      dueDate:     form.dueDate     || undefined,
      notes:       form.notes       || undefined,
      items: items
        .filter((it) => it.description.trim())
        .map((it) => ({
          description: it.description,
          quantity:    Number(it.quantity),
          unitPrice:   Number(it.unitPrice),
          hoursLogged: it.hoursLogged ? Number(it.hoursLogged) : undefined,
          hourlyRate:  it.hourlyRate  ? Number(it.hourlyRate)  : undefined,
        })),
    };

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: payload });
        toast({ title: 'Invoice updated' });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: 'Invoice created' });
      }
      setOpen(false);
    } catch {
      toast({ title: 'Failed to save invoice', variant: 'destructive' });
    }
  }

  async function handleDelete(inv: Invoice) {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}?`)) return;
    try {
      await deleteMut.mutateAsync(inv.id);
      toast({ title: 'Invoice deleted' });
    } catch {
      toast({ title: 'Cannot delete — only DRAFT or CANCELLED invoices can be removed', variant: 'destructive' });
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await statusMut.mutateAsync({ id, status });
      toast({ title: `Status → ${INVOICE_STATUS_LABELS[status]}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">{invoices.length} total invoices</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setUploadFile(null); setUploadOpen(true); }}>
              <ScanLine className="w-4 h-4 mr-2" /> Scan Invoice
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> New Invoice
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{formatCurrency(stats?.totalIncome ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Total Income</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{formatCurrency(stats?.totalExpenses ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{formatCurrency(stats?.outstanding ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(stats?.outgoingCount ?? 0) + (stats?.incomingCount ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Total Documents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by number, customer, supplier, project…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterDirection} onValueChange={setFilterDirection}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="OUTGOING">Outgoing (income)</SelectItem>
            <SelectItem value="INCOMING">Incoming (expense)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(INVOICE_CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No invoices found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Number</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Direction / Category</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Party</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Issue Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium">{inv.invoiceNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded text-xs font-medium ${inv.direction === 'OUTGOING' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {inv.direction === 'OUTGOING' ? '↑ Income' : '↓ Expense'}
                      </span>
                      <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded text-xs ${INVOICE_CATEGORY_COLORS[inv.category]}`}>
                        {INVOICE_CATEGORY_LABELS[inv.category]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {inv.customer && (
                      <Link to={`/customers/${inv.customer.id}`} className="text-sm font-medium hover:text-blue-600">
                        {inv.customer.companyName}
                      </Link>
                    )}
                    {inv.supplier && (
                      <p className="text-sm font-medium">{inv.supplier.companyName}</p>
                    )}
                    {inv.project && (
                      <Link to={`/projects/${inv.project.id}`} className="text-xs text-muted-foreground hover:text-blue-600 block">
                        {inv.project.title}
                      </Link>
                    )}
                    {!inv.customer && !inv.supplier && <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.issueDate ? formatDate(inv.issueDate) : '—'}</td>
                  <td className="px-4 py-3">
                    {inv.dueDate ? (
                      <span className={inv.status === 'OVERDUE' ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {formatDate(inv.dueDate)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <Select value={inv.status} onValueChange={(v) => handleStatusChange(inv.id, v)}>
                        <SelectTrigger className="h-7 w-36 text-xs border-0 p-0 focus:ring-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`${INVOICE_STATUS_COLORS[inv.status]} border-0`}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {canEdit && inv.status === 'DRAFT' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(inv)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(inv)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scan / Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setUploadFile(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-4 h-4" /> Scan Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload a photo or PDF of a physical invoice. AI will extract the data and pre-fill the form for you to review.
            </p>

            {/* Drop zone */}
            <div
              className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer
                ${uploadDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
              onDragLeave={() => setUploadDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUploadDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileDrop(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }}
              />
              {uploadFile ? (
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(0)} KB · {uploadFile.type}</p>
                  <button
                    className="text-xs text-blue-600 hover:underline mt-1"
                    onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WEBP, HEIC, PDF — max 20 MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleExtract} disabled={!uploadFile || extracting}>
              {extracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting…</>
              ) : (
                <><ScanLine className="w-4 h-4 mr-2" /> Extract & Review</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.invoiceNumber}` : 'New Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* AI extraction notice */}
            {extractedNote && !editing && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{extractedNote} — review and adjust before saving.</span>
                <button className="ml-auto text-blue-400 hover:text-blue-600" onClick={() => setExtractedNote('')}>×</button>
              </div>
            )}

            {/* Direction & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Direction *</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) => {
                    const dir = v as InvoiceDirection;
                    const cat = dir === 'OUTGOING' ? 'PROJECT_BILLING' : 'LABOR_SERVICE_ENGINEER';
                    setForm({ ...form, direction: dir, category: cat as InvoiceCategory, customerId: '', supplierId: '' });
                  }}
                  disabled={!!editing}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTGOING">↑ Outgoing (income)</SelectItem>
                    <SelectItem value="INCOMING">↓ Incoming (expense)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as InvoiceCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{INVOICE_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Party links */}
            {form.direction === 'OUTGOING' ? (
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={form.customerId || '__none__'} onValueChange={(v) => setForm({ ...form, customerId: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={form.supplierId || '__none__'} onValueChange={(v) => setForm({ ...form, supplierId: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dates & Tax */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>VAT Rate</Label>
                <Select value={form.taxRate} onValueChange={(v) => setForm({ ...form, taxRate: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="0.13">13%</SelectItem>
                    <SelectItem value="0.24">24%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Unit €</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 text-sm border-0 shadow-none focus-visible:ring-0 px-1"
                            placeholder="Item description"
                            value={it.description}
                            onChange={(e) => setItems(items.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-0 px-1"
                            type="number" min="0" step="0.01"
                            value={it.quantity}
                            onChange={(e) => setItems(items.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-0 px-1"
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={it.unitPrice}
                            onChange={(e) => setItems(items.map((r, idx) => idx === i ? { ...r, unitPrice: e.target.value } : r))}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-sm">
                          {itemLineTotal(it) > 0 ? formatCurrency(itemLineTotal(it)) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="pr-2">
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT ({(Number(form.taxRate) * 100).toFixed(0)}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes…" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving…' : editing ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
