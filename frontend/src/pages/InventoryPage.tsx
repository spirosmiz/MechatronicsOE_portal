import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Package, Edit, Trash2, AlertTriangle, ShieldCheck,
  Images, FolderOpen, FolderPlus, FileText, ExternalLink, Tag,
} from 'lucide-react';
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
  useSetupInventoryDrive, useSuppliers,
  useInventoryQuotes, useCreateInventoryQuote, useUpdateInventoryQuote, useDeleteInventoryQuote,
  KEYS,
} from '@/hooks/useQueries';
import { inventoryApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import { formatCurrency, formatDate } from '@/lib/utils';
import { InventoryItem, SupplierQuote } from '@/types';

const EMPTY = {
  partNumber: '', brand: '', name: '', description: '', stockQuantity: '0',
  safetyStockLevel: '5', unitCost: '', unitPrice: '', ceCertified: 'true', supplierId: '',
};

const EMPTY_QUOTE = {
  supplierId: '', vendorName: '', quoteRef: '', unitPrice: '',
  quoteDate: new Date().toISOString().split('T')[0],
  validUntil: '', invoiceId: '', notes: '', documentUrl: '',
};

export function InventoryPage() {
  const { data: items = [], isLoading } = useInventory();
  const { data: suppliers = [] } = useSuppliers();
  const createMut      = useCreateInventoryItem();
  const updateMut      = useUpdateInventoryItem();
  const deleteMut      = useDeleteInventoryItem();
  const setupDriveMut  = useSetupInventoryDrive();
  const createQuoteMut = useCreateInventoryQuote();
  const updateQuoteMut = useUpdateInventoryQuote();
  const deleteQuoteMut = useDeleteInventoryQuote();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [search, setSearch]           = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [open, setOpen]               = useState(false);
  const [stockOpen, setStockOpen]     = useState(false);
  const [stockItem, setStockItem]     = useState<InventoryItem | null>(null);
  const [stockAdj, setStockAdj]       = useState('');
  const [editing, setEditing]         = useState<InventoryItem | null>(null);
  const [form, setForm]               = useState<typeof EMPTY>(EMPTY);
  const [mediaTarget, setMediaTarget] = useState<{ id: string; name: string } | null>(null);

  // Supplier quotes dialog
  const [quotesTarget, setQuotesTarget]   = useState<InventoryItem | null>(null);
  const [quoteForm, setQuoteForm]         = useState<typeof EMPTY_QUOTE>(EMPTY_QUOTE);
  const [editingQuote, setEditingQuote]   = useState<SupplierQuote | null>(null);
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);

  const { data: activeQuotes = [] } = useInventoryQuotes(quotesTarget?.id ?? '');

  const filtered = items.filter((i) => {
    const matchSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || i.isLowStock;
    return matchSearch && matchLow;
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      partNumber: item.partNumber, brand: item.brand ?? '', name: item.name, description: item.description ?? '',
      stockQuantity: String(item.stockQuantity), safetyStockLevel: String(item.safetyStockLevel),
      unitCost: String(item.unitCost), unitPrice: String(item.unitPrice),
      ceCertified: String(item.ceCertified),
      supplierId: item.supplierId ?? '',
    });
    setOpen(true);
  }

  function openAddQuote() {
    setEditingQuote(null);
    setQuoteForm(EMPTY_QUOTE);
    setQuoteFormOpen(true);
  }

  function openEditQuote(q: SupplierQuote) {
    setEditingQuote(q);
    setQuoteForm({
      supplierId:  q.supplierId  ?? '',
      vendorName:  q.vendorName  ?? '',
      quoteRef:    q.quoteRef    ?? '',
      unitPrice:   String(q.unitPrice),
      quoteDate:   q.quoteDate.split('T')[0],
      validUntil:  q.validUntil ? q.validUntil.split('T')[0] : '',
      invoiceId:   q.invoiceId  ?? '',
      notes:       q.notes      ?? '',
      documentUrl: q.documentUrl ?? '',
    });
    setQuoteFormOpen(true);
  }

  async function handleSaveQuote() {
    if (!quotesTarget) return;
    if (!quoteForm.unitPrice || Number(quoteForm.unitPrice) < 0) {
      toast({ title: 'Enter a valid unit price', variant: 'destructive' }); return;
    }
    if (!quoteForm.supplierId && !quoteForm.vendorName.trim()) {
      toast({ title: 'Select a supplier or enter a vendor name', variant: 'destructive' }); return;
    }
    const payload: Record<string, unknown> = {
      supplierId:  quoteForm.supplierId  || undefined,
      vendorName:  quoteForm.vendorName.trim()  || undefined,
      quoteRef:    quoteForm.quoteRef.trim()    || undefined,
      unitPrice:   Number(quoteForm.unitPrice),
      quoteDate:   quoteForm.quoteDate,
      validUntil:  quoteForm.validUntil  || undefined,
      invoiceId:   quoteForm.invoiceId   || undefined,
      notes:       quoteForm.notes.trim()       || undefined,
      documentUrl: quoteForm.documentUrl.trim() || undefined,
    };
    try {
      if (editingQuote) {
        await updateQuoteMut.mutateAsync({ inventoryId: quotesTarget.id, quoteId: editingQuote.id, data: payload });
        toast({ title: 'Quote updated' });
      } else {
        await createQuoteMut.mutateAsync({ inventoryId: quotesTarget.id, data: payload });
        toast({ title: 'Quote added' });
      }
      setQuoteFormOpen(false);
    } catch {
      toast({ title: 'Failed to save quote', variant: 'destructive' });
    }
  }

  async function handleDeleteQuote(q: SupplierQuote) {
    if (!quotesTarget || !confirm('Delete this quote?')) return;
    try {
      await deleteQuoteMut.mutateAsync({ inventoryId: quotesTarget.id, quoteId: q.id });
      toast({ title: 'Quote deleted' });
    } catch {
      toast({ title: 'Failed to delete quote', variant: 'destructive' });
    }
  }

  async function handleSave() {
    try {
      const data: Record<string, unknown> = {
        partNumber: form.partNumber, brand: form.brand || undefined, name: form.name,
        description: form.description || undefined,
        stockQuantity: parseInt(form.stockQuantity), safetyStockLevel: parseInt(form.safetyStockLevel),
        unitCost: parseFloat(form.unitCost), unitPrice: parseFloat(form.unitPrice),
        ceCertified: form.ceCertified === 'true',
        supplierId: form.supplierId || undefined,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data });
        toast({ title: 'Item updated' });
      } else {
        await createMut.mutateAsync(data);
        toast({ title: 'Item created' });
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error saving item';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  async function handleStockAdjust() {
    if (!stockItem) return;
    const adj = parseInt(stockAdj);
    if (isNaN(adj)) { toast({ title: 'Invalid number', variant: 'destructive' }); return; }
    try {
      await inventoryApi.adjustStock(stockItem.id, adj);
      qc.invalidateQueries({ queryKey: KEYS.inventory });
      toast({ title: `Stock adjusted by ${adj > 0 ? '+' : ''}${adj}` });
      setStockOpen(false);
    } catch {
      toast({ title: 'Failed to adjust stock', variant: 'destructive' });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" from inventory?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Item deleted' });
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  }

  const lowCount = items.filter((i) => i.isLowStock).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            {items.length} parts ·{' '}
            <span className={lowCount > 0 ? 'text-amber-600 font-medium' : 'text-green-600'}>{lowCount} below safety stock</span>
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Part
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by part number, name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button
          variant={showLowOnly ? 'default' : 'outline'}
          onClick={() => setShowLowOnly(!showLowOnly)}
          className={showLowOnly ? 'bg-amber-500 hover:bg-amber-600' : ''}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Low Stock
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Number</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Name / Supplier</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Safety</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-center">CE</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(9)].map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className={item.isLowStock ? 'bg-amber-50' : ''}>
                  <TableCell className="font-mono text-xs">{item.partNumber}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.brand ?? '—'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                      {item.supplier && (
                        <Badge className="mt-0.5 text-xs bg-blue-50 text-blue-700 border-blue-200 border font-normal">
                          {item.supplier.companyName}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${item.isLowStock ? 'text-amber-600' : 'text-green-600'}`}>
                      {item.stockQuantity}
                    </span>
                    {item.isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline ml-1" />}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{item.safetyStockLevel}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-center">
                    {item.ceCertified
                      ? <ShieldCheck className="w-4 h-4 text-green-500 mx-auto" />
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end items-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600" title="Media" onClick={() => setMediaTarget({ id: item.id, name: item.name })}>
                        <Images className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-orange-600" title="Supplier quotes" onClick={() => setQuotesTarget(item)}>
                        <Tag className="w-3 h-3" />
                      </Button>
                      {item.driveFolderId ? (
                        <a href={`https://drive.google.com/drive/folders/${item.driveFolderId}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          title="Open Drive folder">
                          <FolderOpen className="w-3 h-3" />
                        </a>
                      ) : canEdit && (
                        <button
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50"
                          disabled={setupDriveMut.isPending}
                          title="Setup Drive folder"
                          onClick={() => setupDriveMut.mutate(item.id, {
                            onSuccess: () => toast({ title: `Drive folder created for ${item.name}` }),
                            onError: () => toast({ title: 'Failed to create Drive folder', variant: 'destructive' }),
                          })}
                        >
                          <FolderPlus className="w-3 h-3" />
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setStockItem(item); setStockAdj(''); setStockOpen(true); }}>
                            Adj. Stock
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id, item.name)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Part' : 'New Part'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Part Number *</Label>
              <Input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input value={form.brand} placeholder="e.g. Siemens" onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <Input type="number" min="0" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Safety Stock Level</Label>
              <Input type="number" min="0" value={form.safetyStockLevel} onChange={(e) => setForm({ ...form, safetyStockLevel: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost (€)</Label>
              <Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unit Price (€)</Label>
              <Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Preferred Supplier</Label>
              <Select
                value={form.supplierId || '__none__'}
                onValueChange={(v) => setForm({ ...form, supplierId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="ce"
                checked={form.ceCertified === 'true'}
                onChange={(e) => setForm({ ...form, ceCertified: e.target.checked ? 'true' : 'false' })}
                className="rounded"
              />
              <Label htmlFor="ce" className="cursor-pointer">CE Certified</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock adjustment dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {stockItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">Current stock: <strong>{stockItem?.stockQuantity}</strong></p>
            <div className="space-y-2">
              <Label>Adjustment (positive = add, negative = remove)</Label>
              <Input type="number" value={stockAdj} onChange={(e) => setStockAdj(e.target.value)} placeholder="e.g. 10 or -3" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button>
            <Button onClick={handleStockAdjust}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mediaTarget && (
        <MediaGalleryDialog
          open={!!mediaTarget}
          onClose={() => setMediaTarget(null)}
          title={mediaTarget.name}
          entityType="inventory"
          entityId={mediaTarget.id}
        />
      )}

      {/* Supplier Quotes dialog */}
      <Dialog open={!!quotesTarget} onOpenChange={(v) => { if (!v) { setQuotesTarget(null); setQuoteFormOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Supplier Quotes — {quotesTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quote list */}
            {activeQuotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No quotes yet for this part.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vendor</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ref</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Unit Price</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Valid Until</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{q.supplier?.companyName ?? q.vendorName ?? '—'}</p>
                          {q.notes && <p className="text-xs text-muted-foreground line-clamp-1">{q.notes}</p>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{q.quoteRef ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(q.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(q.quoteDate)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {q.validUntil ? formatDate(q.validUntil) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {q.invoice ? (
                            <Link
                              to={`/invoices/${q.invoice.id}`}
                              className="text-xs text-blue-600 hover:underline font-mono"
                              onClick={() => setQuotesTarget(null)}
                            >
                              {q.invoice.invoiceNumber}
                            </Link>
                          ) : q.documentUrl ? (
                            <a href={q.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <ExternalLink className="w-3 h-3" /> Doc
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditQuote(q)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteQuote(q)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canEdit && !quoteFormOpen && (
              <Button variant="outline" size="sm" onClick={openAddQuote}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Quote
              </Button>
            )}

            {/* Inline quote form */}
            {quoteFormOpen && (
              <div className="rounded-lg border bg-gray-50 p-4 space-y-4">
                <p className="text-sm font-semibold">{editingQuote ? 'Edit Quote' : 'New Quote'}</p>

                {/* Vendor — supplier select OR free text */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Supplier (from list)</Label>
                    <Select
                      value={quoteForm.supplierId || '__none__'}
                      onValueChange={(v) => setQuoteForm({ ...quoteForm, supplierId: v === '__none__' ? '' : v, vendorName: '' })}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Free text →</SelectItem>
                        {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Or vendor name (free text)</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="e.g. ABC Machining Ltd"
                      value={quoteForm.vendorName}
                      disabled={!!quoteForm.supplierId}
                      onChange={(e) => setQuoteForm({ ...quoteForm, vendorName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quote Ref / Offer #</Label>
                    <Input className="h-8 text-sm" placeholder="OFF-2024-001" value={quoteForm.quoteRef} onChange={(e) => setQuoteForm({ ...quoteForm, quoteRef: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit Price (€) *</Label>
                    <Input className="h-8 text-sm" type="number" min="0" step="0.01" placeholder="0.00" value={quoteForm.unitPrice} onChange={(e) => setQuoteForm({ ...quoteForm, unitPrice: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quote Date *</Label>
                    <Input className="h-8 text-sm" type="date" value={quoteForm.quoteDate} onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valid Until</Label>
                    <Input className="h-8 text-sm" type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Document / Offer URL</Label>
                    <Input className="h-8 text-sm" type="url" placeholder="https://…" value={quoteForm.documentUrl} onChange={(e) => setQuoteForm({ ...quoteForm, documentUrl: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Link to Purchase Invoice</Label>
                  <p className="text-xs text-muted-foreground">
                    Set this after the quote becomes an order — go to{' '}
                    <Link to="/invoices" className="text-blue-600 hover:underline" onClick={() => setQuotesTarget(null)}>
                      Invoices
                    </Link>{' '}
                    and find the incoming invoice for this purchase, then come back to link it.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Input className="h-8 text-sm" placeholder="Lead time, conditions…" value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setQuoteFormOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveQuote} disabled={createQuoteMut.isPending || updateQuoteMut.isPending}>
                    {createQuoteMut.isPending || updateQuoteMut.isPending ? 'Saving…' : editingQuote ? 'Update Quote' : 'Save Quote'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotesTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
