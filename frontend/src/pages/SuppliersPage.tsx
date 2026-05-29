import { useState } from 'react';
import { Plus, Search, Building, Edit, Trash2, Mail, Phone } from 'lucide-react';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Supplier } from '@/types';

const CATEGORY_OPTIONS = [
  { value: 'PARTS',       label: 'Parts' },
  { value: 'MACHINING',   label: 'Machining' },
  { value: 'SERVICES',    label: 'Services' },
  { value: 'ENGINEERING', label: 'Engineering' },
];

const CATEGORY_COLORS: Record<string, string> = {
  PARTS:       'bg-blue-100 text-blue-800',
  MACHINING:   'bg-orange-100 text-orange-800',
  SERVICES:    'bg-green-100 text-green-800',
  ENGINEERING: 'bg-purple-100 text-purple-800',
};

const EMPTY_FORM = {
  companyName:   '',
  vatNumber:     '',
  contactPerson: '',
  email:         '',
  phone:         '',
  address:       '',
  categories:    [] as string[],
};

function parseCategories(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

export function SuppliersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm]     = useState(EMPTY_FORM);

  const { data: suppliers = [], isLoading } = useSuppliers();
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deleteMut = useDeleteSupplier();

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.companyName.toLowerCase().includes(q) ||
      (s.vatNumber ?? '').toLowerCase().includes(q) ||
      (s.contactPerson ?? '').toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      companyName:   s.companyName,
      vatNumber:     s.vatNumber     ?? '',
      contactPerson: s.contactPerson ?? '',
      email:         s.email         ?? '',
      phone:         s.phone         ?? '',
      address:       s.address       ?? '',
      categories:    parseCategories(s.categories),
    });
    setOpen(true);
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  async function handleSave() {
    if (!form.companyName.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' }); return;
    }
    const payload: Record<string, unknown> = {
      companyName:   form.companyName,
      vatNumber:     form.vatNumber     || undefined,
      contactPerson: form.contactPerson || undefined,
      email:         form.email         || undefined,
      phone:         form.phone         || undefined,
      address:       form.address       || undefined,
      categories:    form.categories,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: payload });
        toast({ title: 'Supplier updated' });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: 'Supplier created' });
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save supplier';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Delete supplier "${s.companyName}"? This cannot be undone.`)) return;
    try {
      await deleteMut.mutateAsync(s.id);
      toast({ title: 'Supplier deleted' });
    } catch {
      toast({ title: 'Cannot delete — supplier has invoices linked to it', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">{suppliers.length} suppliers</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Supplier
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, VAT, contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No suppliers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const cats = parseCategories(s.categories);
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.companyName}</p>
                      {s.vatNumber && <p className="text-xs text-muted-foreground">VAT: {s.vatNumber}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(s)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {cats.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cats.map((c) => (
                        <Badge key={c} className={`text-xs border-0 ${CATEGORY_COLORS[c] ?? 'bg-gray-100 text-gray-700'}`}>
                          {CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1">
                    {s.contactPerson && <p>{s.contactPerson}</p>}
                    {s.email && (
                      <p className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {s.email}
                      </p>
                    )}
                    {s.phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {s._count?.invoices ?? 0} invoice{(s._count?.invoices ?? 0) !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Company Name *</Label>
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Supplier company name" />
              </div>
              <div className="space-y-2">
                <Label>VAT Number</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} placeholder="EL123456789" />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@supplier.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+30 210…" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, Postcode" />
              </div>
            </div>

            {/* Category checkboxes */}
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = form.categories.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? `${CATEGORY_COLORS[cat.value]} border-transparent`
                          : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving…' : editing ? 'Update' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
