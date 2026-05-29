import { useState } from 'react';
import { Plus, Clock, Trash2, CheckCircle2 } from 'lucide-react';
import { useLaborRates, useCreateLaborRate, useDeleteLaborRate } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LaborRate, LaborRoleType } from '@/types';
import { formatCurrency, formatDate, LABOR_ROLE_LABELS } from '@/lib/utils';

const ROLES: LaborRoleType[] = ['SERVICE_ENGINEER', 'DESIGN_ENGINEER', 'PROJECT_MANAGER'];

const ROLE_COLORS: Record<string, string> = {
  SERVICE_ENGINEER: 'bg-blue-100 text-blue-800',
  DESIGN_ENGINEER:  'bg-purple-100 text-purple-800',
  PROJECT_MANAGER:  'bg-green-100 text-green-800',
};

const EMPTY_FORM = {
  role:          'SERVICE_ENGINEER' as LaborRoleType,
  ratePerHour:   '',
  effectiveFrom: new Date().toISOString().split('T')[0],
};

export function LaborRatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: rates = [], isLoading } = useLaborRates();
  const createMut = useCreateLaborRate();
  const deleteMut = useDeleteLaborRate();

  // Group by role for display
  const byRole = ROLES.reduce<Record<string, LaborRate[]>>((acc, role) => {
    acc[role] = rates.filter((r) => r.role === role).sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    );
    return acc;
  }, {} as Record<string, LaborRate[]>);

  async function handleSave() {
    if (!form.ratePerHour || Number(form.ratePerHour) <= 0) {
      toast({ title: 'Enter a valid hourly rate', variant: 'destructive' }); return;
    }
    if (!form.effectiveFrom) {
      toast({ title: 'Effective from date is required', variant: 'destructive' }); return;
    }
    try {
      await createMut.mutateAsync({
        role:          form.role,
        ratePerHour:   Number(form.ratePerHour),
        effectiveFrom: form.effectiveFrom,
      });
      toast({ title: 'Labor rate created — previous rate for this role closed' });
      setOpen(false);
      setForm(EMPTY_FORM);
    } catch {
      toast({ title: 'Failed to create rate', variant: 'destructive' });
    }
  }

  async function handleDelete(rate: LaborRate) {
    if (!confirm(`Delete this ${LABOR_ROLE_LABELS[rate.role]} rate (${formatCurrency(rate.ratePerHour)}/h)?`)) return;
    try {
      await deleteMut.mutateAsync(rate.id);
      toast({ title: 'Rate deleted' });
    } catch {
      toast({ title: 'Failed to delete rate', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Labor Rates</h1>
          <p className="text-muted-foreground">Hourly rates per role — used to auto-calculate labor costs on invoices</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Rate
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ROLES.map((role) => {
            const roleRates = byRole[role] ?? [];
            const current = roleRates.find((r) => !r.effectiveTo);
            return (
              <Card key={role}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {LABOR_ROLE_LABELS[role]}
                  </CardTitle>
                  {current ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{formatCurrency(current.ratePerHour)}</span>
                      <span className="text-sm text-muted-foreground">/h</span>
                      <Badge className={`ml-auto text-xs border-0 ${ROLE_COLORS[role]}`}>Current</Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active rate</p>
                  )}
                </CardHeader>
                <CardContent>
                  {roleRates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No rates configured</p>
                  ) : (
                    <div className="space-y-2">
                      {roleRates.map((r) => {
                        const isCurrent = !r.effectiveTo;
                        return (
                          <div key={r.id} className={`flex items-center justify-between text-sm py-2 border-b last:border-0 ${isCurrent ? '' : 'opacity-60'}`}>
                            <div>
                              <div className="flex items-center gap-1.5">
                                {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                <span className="font-medium">{formatCurrency(r.ratePerHour)}/h</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                From {formatDate(r.effectiveFrom)}
                                {r.effectiveTo ? ` to ${formatDate(r.effectiveTo)}` : ' (active)'}
                              </p>
                            </div>
                            {isAdmin && (
                              <button
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(r)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Labor Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as LaborRoleType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{LABOR_ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate (€) *</Label>
              <Input
                type="number" min="0" step="0.01" placeholder="e.g. 65.00"
                value={form.ratePerHour}
                onChange={(e) => setForm({ ...form, ratePerHour: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective From *</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The previous active rate for this role will be automatically closed on this date.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending}>
              {createMut.isPending ? 'Saving…' : 'Create Rate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
