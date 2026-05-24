import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, Edit, Trash2, Phone, Mail, MapPin, Images, FolderOpen, FolderPlus } from 'lucide-react';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useSetupCustomerDrive } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Customer } from '@/types';

const EMPTY: Partial<Customer> = { companyName: '', vatNumber: '', address: '', contactPerson: '', email: '', phone: '' };

export function CustomersPage() {
  const { data: customers = [], isLoading } = useCustomers();
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();
  const setupDriveMut = useSetupCustomerDrive();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(EMPTY);
  const [mediaTarget, setMediaTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = customers.filter(
    (c) =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.vatNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ ...c }); setOpen(true); }

  async function handleSave() {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: form as Record<string, unknown> });
        toast({ title: 'Customer updated' });
      } else {
        await createMut.mutateAsync(form as Record<string, unknown>);
        toast({ title: 'Customer created' });
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error saving customer';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will also delete all associated machines and cascade to linked projects.`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Customer deleted' });
    } catch {
      toast({ title: 'Failed to delete customer', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">{customers.length} total customers</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by company, VAT, or contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <Link to={`/customers/${c.id}`} className="font-semibold text-sm hover:text-blue-600 transition-colors">
                        {c.companyName}
                      </Link>
                      <p className="text-xs text-muted-foreground">VAT: {c.vatNumber}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" title="Media" onClick={() => setMediaTarget({ id: c.id, name: c.companyName })}>
                      <Images className="w-3.5 h-3.5" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id, c.companyName)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {c.contactPerson && <p className="text-muted-foreground">{c.contactPerson}</p>}
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" /><span>{c.phone}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2 text-xs">{c.address}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t space-y-2">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{c._count?.machines ?? 0} machines</span>
                    <span>{c._count?.projects ?? 0} projects</span>
                  </div>
                  {c.driveFolderId ? (
                    <div className="flex flex-wrap gap-1.5">
                      <a href={`https://drive.google.com/drive/folders/${c.driveFolderId}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
                        <FolderOpen className="w-3 h-3" /> Drive
                      </a>
                      {c.driveMediaFolderId && (
                        <a href={`https://drive.google.com/drive/folders/${c.driveMediaFolderId}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700">
                          <Images className="w-3 h-3" /> Media
                        </a>
                      )}
                      {c.driveOffersFolderId && (
                        <a href={`https://drive.google.com/drive/folders/${c.driveOffersFolderId}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 hover:bg-green-100 text-green-700">
                          <FolderOpen className="w-3 h-3" /> Offers
                        </a>
                      )}
                      {c.driveContractsFolderId && (
                        <a href={`https://drive.google.com/drive/folders/${c.driveContractsFolderId}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700">
                          <FolderOpen className="w-3 h-3" /> Contracts
                        </a>
                      )}
                    </div>
                  ) : canEdit && (
                    <button
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50"
                      disabled={setupDriveMut.isPending}
                      onClick={() => setupDriveMut.mutate(c.id, {
                        onSuccess: () => toast({ title: `Drive folders created for ${c.companyName}` }),
                        onError: () => toast({ title: 'Failed to create Drive folders', variant: 'destructive' }),
                      })}
                    >
                      <FolderPlus className="w-3 h-3" />
                      {setupDriveMut.isPending ? 'Creating…' : 'Setup Drive folders'}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mediaTarget && (
        <MediaGalleryDialog
          open={!!mediaTarget}
          onClose={() => setMediaTarget(null)}
          title={mediaTarget.name}
          entityType="customer"
          entityId={mediaTarget.id}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Company Name *</Label>
              <Input value={form.companyName ?? ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>VAT Number *</Label>
              <Input value={form.vatNumber ?? ''} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input value={form.contactPerson ?? ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address *</Label>
              <Textarea rows={2} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
    </div>
  );
}
