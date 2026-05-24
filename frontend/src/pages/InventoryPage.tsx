import { useState } from 'react';
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, ShieldCheck, Images, FolderOpen, FolderPlus } from 'lucide-react';
import {
  useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useSetupInventoryDrive, KEYS,
} from '@/hooks/useQueries';
import { inventoryApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import { formatCurrency } from '@/lib/utils';
import { InventoryItem } from '@/types';

const EMPTY = {
  partNumber: '', brand: '', name: '', description: '', stockQuantity: '0',
  safetyStockLevel: '5', unitCost: '', unitPrice: '', ceCertified: 'true',
};

export function InventoryPage() {
  const { data: items = [], isLoading } = useInventory();
  const createMut = useCreateInventoryItem();
  const updateMut = useUpdateInventoryItem();
  const deleteMut = useDeleteInventoryItem();
  const setupDriveMut = useSetupInventoryDrive();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockAdj, setStockAdj] = useState('');
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [mediaTarget, setMediaTarget] = useState<{ id: string; name: string } | null>(null);

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
    });
    setOpen(true);
  }

  async function handleSave() {
    try {
      const data: Record<string, unknown> = {
        partNumber: form.partNumber, brand: form.brand || undefined, name: form.name,
        description: form.description || undefined,
        stockQuantity: parseInt(form.stockQuantity), safetyStockLevel: parseInt(form.safetyStockLevel),
        unitCost: parseFloat(form.unitCost), unitPrice: parseFloat(form.unitPrice),
        ceCertified: form.ceCertified === 'true',
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
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Safety Level</TableHead>
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
    </div>
  );
}
