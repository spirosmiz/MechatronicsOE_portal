import { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Cpu, FileSignature, FolderOpen, Mail, MapPin, Phone, Edit, Trash2, Images, FolderPlus } from 'lucide-react';
import { useCustomer, useMachines, useOffers, useProjects, useDeleteCustomer, useUpdateCustomer, useSetupCustomerDrive } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import { Customer } from '@/types';
import {
  formatCurrency, formatDate,
  OFFER_STATUS_COLORS, OFFER_STATUS_LABELS,
  PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS,
} from '@/lib/utils';

type Tab = 'machines' | 'offers' | 'projects';

const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';

  const [tab, setTab] = useState<Tab>((location.state as { tab?: Tab })?.tab ?? 'machines');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [mediaOpen, setMediaOpen] = useState(false);

  const { data: customer, isLoading } = useCustomer(id!);
  const { data: machines = [] } = useMachines(id);
  const { data: allOffers = [] } = useOffers();
  const { data: allProjects = [] } = useProjects();

  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();
  const setupDriveMut = useSetupCustomerDrive();

  const offers = allOffers.filter((o) => o.customerId === id);
  const projects = allProjects.filter((p) => p.customerId === id);

  function openEdit() {
    if (!customer) return;
    setForm({ ...customer });
    setEditOpen(true);
  }

  async function handleSave() {
    try {
      await updateMut.mutateAsync({ id: id!, data: form as Record<string, unknown> });
      toast({ title: 'Customer updated' });
      setEditOpen(false);
    } catch {
      toast({ title: 'Failed to update customer', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!customer) return;
    if (!confirm(`Delete "${customer.companyName}"? This will also delete all associated data.`)) return;
    try {
      await deleteMut.mutateAsync(id!);
      toast({ title: 'Customer deleted' });
      navigate('/customers');
    } catch {
      toast({ title: 'Failed to delete customer', variant: 'destructive' });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/customers')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Customers
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{customer.companyName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{customer.companyName}</h1>
            <p className="text-sm text-muted-foreground">VAT: {customer.vatNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMediaOpen(true)}>
            <Images className="w-4 h-4 mr-1.5" /> Media
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Edit className="w-4 h-4 mr-1.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
        {customer.contactPerson && (
          <div><p className="text-xs text-muted-foreground mb-0.5">Contact</p><p className="font-medium">{customer.contactPerson}</p></div>
        )}
        {customer.email && (
          <div className="flex items-start gap-1.5">
            <Mail className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <a href={`mailto:${customer.email}`} className="hover:text-blue-600 break-all">{customer.email}</a>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span>{customer.phone}</span>
          </div>
        )}
        {customer.address && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>{customer.address}</span>
          </div>
        )}
      </div>

      {/* Drive folders */}
      {customer.driveFolderId ? (
        <div className="flex flex-wrap gap-2">
          <a href={`https://drive.google.com/drive/folders/${customer.driveFolderId}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
            <FolderOpen className="w-3 h-3" /> Drive
          </a>
          {customer.driveMediaFolderId && (
            <a href={`https://drive.google.com/drive/folders/${customer.driveMediaFolderId}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700">
              <Images className="w-3 h-3" /> Media
            </a>
          )}
          {customer.driveOffersFolderId && (
            <a href={`https://drive.google.com/drive/folders/${customer.driveOffersFolderId}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-50 hover:bg-green-100 text-green-700">
              <FolderOpen className="w-3 h-3" /> Offers
            </a>
          )}
        </div>
      ) : canEdit && (
        <button
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50"
          disabled={setupDriveMut.isPending}
          onClick={() => setupDriveMut.mutate(id!, {
            onSuccess: () => toast({ title: 'Drive folders created' }),
            onError: () => toast({ title: 'Failed to create Drive folders', variant: 'destructive' }),
          })}
        >
          <FolderPlus className="w-3 h-3" />
          {setupDriveMut.isPending ? 'Creating…' : 'Setup Drive folders'}
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b">
        {([
          { key: 'machines', label: 'Machines', count: machines.length, icon: Cpu },
          { key: 'offers',   label: 'Offers',   count: offers.length,   icon: FileSignature },
          { key: 'projects', label: 'Projects', count: projects.length, icon: FolderOpen },
        ] as const).map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 pb-3 text-sm border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Machines tab */}
      {tab === 'machines' && (
        machines.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Cpu className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No machines for this customer</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{m.name}</p>
                      {m.model && <p className="text-xs text-muted-foreground">{m.model}</p>}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {m.serialNumber && <p>S/N: {m.serialNumber}</p>}
                    {m.manufacturer && <p>{m.manufacturer}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Offers tab */}
      {tab === 'offers' && (
        offers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileSignature className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No offers for this customer</p>
            {canEdit && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/offers')}>
                Go to Offers
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Machine</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to="/offers" className="font-medium hover:text-blue-600">{o.title}</Link>
                      {o.description && <p className="text-xs text-muted-foreground line-clamp-1">{o.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {o.machines && o.machines.length > 0 ? (
                        <div className="space-y-0.5">
                          {o.machines.map((m) => (
                            <span key={m.id} className="text-sm text-muted-foreground block">
                              {m.machine.name}{m.machine.model ? ` (${m.machine.model})` : ''}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.offerDate)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OFFER_STATUS_COLORS[o.status]}`}>
                        {OFFER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[o.paymentStatus]}`}>
                        {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Projects tab */}
      {tab === 'projects' && (
        projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No projects for this customer</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Machine</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p.id}`} className="font-medium hover:text-blue-600">{p.title}</Link>
                      <p className="text-xs text-muted-foreground capitalize">{p.type.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.machine?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROJECT_STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p.quotedTotalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Media dialog */}
      <MediaGalleryDialog
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        title={customer.companyName}
        entityType="customer"
        entityId={id!}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
