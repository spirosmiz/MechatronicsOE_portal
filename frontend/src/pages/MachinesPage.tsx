import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Cpu, Edit, Trash2, Images } from 'lucide-react';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import { useMachines, useCreateMachine, useUpdateMachine, useDeleteMachine, useCustomers } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Machine } from '@/types';

const EMPTY = { name: '', model: '', serialNumber: '', manufacturer: '', customerId: '', technicalSpecs: '' };

export function MachinesPage() {
  const { data: machines = [], isLoading } = useMachines();
  const { data: customers = [] } = useCustomers();
  const createMut = useCreateMachine();
  const updateMut = useUpdateMachine();
  const deleteMut = useDeleteMachine();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState<typeof EMPTY & { customerId: string }>(EMPTY);
  const [mediaTarget, setMediaTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = machines.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.model?.toLowerCase().includes(search.toLowerCase()) ||
      m.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
      m.customer?.companyName.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(m: Machine) {
    setEditing(m);
    setForm({
      name: m.name,
      model: m.model ?? '',
      serialNumber: m.serialNumber ?? '',
      manufacturer: m.manufacturer ?? '',
      customerId: m.customerId ?? '',
      technicalSpecs: m.technicalSpecs ? JSON.stringify(m.technicalSpecs, null, 2) : '',
    });
    setOpen(true);
  }

  async function handleSave() {
    try {
      let technicalSpecs = undefined;
      if (form.technicalSpecs.trim()) {
        try { technicalSpecs = JSON.parse(form.technicalSpecs); } catch { /* ignore */ }
      }
      const data: Record<string, unknown> = {
        name: form.name, model: form.model || undefined,
        serialNumber: form.serialNumber || undefined, manufacturer: form.manufacturer || undefined,
        customerId: form.customerId || undefined, technicalSpecs,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data });
        toast({ title: 'Machine updated' });
      } else {
        await createMut.mutateAsync(data);
        toast({ title: 'Machine created' });
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error saving machine';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete machine "${name}"?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Machine deleted' });
    } catch {
      toast({ title: 'Failed to delete machine', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Machines</h1>
          <p className="text-muted-foreground">{machines.length} registered machines</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Machine
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, model, serial, manufacturer…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No machines found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Cpu className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{m.name}</p>
                      {m.model && <p className="text-xs text-muted-foreground">{m.model}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" title="Media" onClick={() => setMediaTarget({ id: m.id, name: m.name })}>
                      <Images className="w-3.5 h-3.5" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id, m.name)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {m.manufacturer && <p>Manufacturer: <span className="text-foreground">{m.manufacturer}</span></p>}
                  {m.serialNumber && <p>S/N: <span className="font-mono text-foreground">{m.serialNumber}</span></p>}
                  {m.customer && (
                    <p>
                      Customer:{' '}
                      <Link to={`/customers/${m.customer.id}`} className="text-blue-600 hover:underline">
                        {m.customer.companyName}
                      </Link>
                    </p>
                  )}
                </div>
                {m.technicalSpecs && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Technical Specs</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(m.technicalSpecs as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="text-muted-foreground">{k.replace(/_/g, ' ')}: </span>
                          <span className="font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
          entityType="machine"
          entityId={mediaTarget.id}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Machine' : 'New Machine'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Machine Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Technical Specs (JSON)</Label>
              <Textarea
                rows={3}
                placeholder='{"voltage": "400V", "power_kw": 22}'
                value={form.technicalSpecs}
                onChange={(e) => setForm({ ...form, technicalSpecs: e.target.value })}
                className="font-mono text-xs"
              />
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
