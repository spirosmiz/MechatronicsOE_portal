import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Trash2, Plus, CreditCard,
  AlertCircle, CheckCircle2, ChevronDown, FileDown,
} from 'lucide-react';
import {
  useInvoice, useAddPayment, useDeletePayment, useUpdateInvoiceStatus,
} from '@/hooks/useQueries';
import { invoicesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoicePayment, PaymentMethod } from '@/types';
import {
  formatCurrency, formatDate, formatDateTime,
  INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS,
  INVOICE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS,
} from '@/lib/utils';

const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'CHECK', 'CARD'];

const EMPTY_PAYMENT = {
  amount:    '',
  paidAt:    new Date().toISOString().split('T')[0],
  method:    'BANK_TRANSFER' as PaymentMethod,
  reference: '',
  notes:     '',
};

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager';
  const isAdmin = user?.role === 'admin';

  const { data: invoice, isLoading } = useInvoice(id!);
  const addPaymentMut    = useAddPayment();
  const deletePaymentMut = useDeletePayment();
  const statusMut        = useUpdateInvoiceStatus();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Invoice not found</p>
        <Link to="/invoices" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Back to Invoices</Link>
      </div>
    );
  }

  const totalPaid   = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalAmount = Number(invoice.totalAmount);
  const remaining   = totalAmount - totalPaid;
  const paidPct     = totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;

  async function handleDownloadPdf() {
    try {
      const res = await invoicesApi.downloadPdf(invoice!.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice!.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Failed to download PDF', variant: 'destructive' });
    }
  }

  async function handleAddPayment() {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' }); return;
    }
    try {
      await addPaymentMut.mutateAsync({
        id: invoice!.id,
        data: {
          amount:    Number(paymentForm.amount),
          paidAt:    paymentForm.paidAt,
          method:    paymentForm.method,
          reference: paymentForm.reference || undefined,
          notes:     paymentForm.notes     || undefined,
        },
      });
      toast({ title: 'Payment recorded' });
      setPaymentOpen(false);
      setPaymentForm(EMPTY_PAYMENT);
    } catch {
      toast({ title: 'Failed to record payment', variant: 'destructive' });
    }
  }

  async function handleDeletePayment(payment: InvoicePayment) {
    if (!confirm('Delete this payment record?')) return;
    try {
      await deletePaymentMut.mutateAsync({ invoiceId: invoice!.id, paymentId: payment.id });
      toast({ title: 'Payment deleted' });
    } catch {
      toast({ title: 'Failed to delete payment', variant: 'destructive' });
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await statusMut.mutateAsync({ id: invoice!.id, status });
      toast({ title: `Status → ${INVOICE_STATUS_LABELS[status]}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div>
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Receipt className="w-6 h-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold font-mono">{invoice.invoiceNumber}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoice.direction === 'OUTGOING' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {invoice.direction === 'OUTGOING' ? '↑ Income' : '↓ Expense'}
              </span>
              <Badge className={`${INVOICE_STATUS_COLORS[invoice.status]} border-0`}>
                {INVOICE_STATUS_LABELS[invoice.status]}
              </Badge>
              <span className="text-sm text-muted-foreground">{INVOICE_CATEGORY_LABELS[invoice.category]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
              <FileDown className="w-4 h-4 mr-1.5" /> PDF
            </Button>
            {canEdit && (
              <Select value={invoice.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                  <ChevronDown className="w-4 h-4 ml-1 opacity-60" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: details + items */}
        <div className="lg:col-span-2 space-y-6">

          {/* Meta */}
          <Card>
            <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {(invoice.customer || invoice.supplier) && (
                  <>
                    <dt className="text-muted-foreground">{invoice.direction === 'OUTGOING' ? 'Customer' : 'Supplier'}</dt>
                    <dd className="font-medium">
                      {invoice.customer ? (
                        <Link to={`/customers/${invoice.customer.id}`} className="hover:text-blue-600">
                          {invoice.customer.companyName}
                        </Link>
                      ) : (
                        invoice.supplier?.companyName
                      )}
                      {(invoice.customer?.vatNumber || invoice.supplier?.vatNumber) && (
                        <p className="text-xs text-muted-foreground">
                          VAT: {invoice.customer?.vatNumber ?? invoice.supplier?.vatNumber}
                        </p>
                      )}
                    </dd>
                  </>
                )}
                {invoice.project && (
                  <>
                    <dt className="text-muted-foreground">Project</dt>
                    <dd>
                      <Link to={`/projects/${invoice.project.id}`} className="font-medium hover:text-blue-600 text-sm">
                        {invoice.project.title}
                      </Link>
                    </dd>
                  </>
                )}
                {invoice.issueDate && (
                  <>
                    <dt className="text-muted-foreground">Issue Date</dt>
                    <dd>{formatDate(invoice.issueDate)}</dd>
                  </>
                )}
                {invoice.dueDate && (
                  <>
                    <dt className="text-muted-foreground">Due Date</dt>
                    <dd className={invoice.status === 'OVERDUE' ? 'text-red-600 font-medium' : ''}>
                      {formatDate(invoice.dueDate)}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Created by</dt>
                <dd>{invoice.createdBy?.name}</dd>
                <dt className="text-muted-foreground">Created at</dt>
                <dd className="text-muted-foreground">{formatDateTime(invoice.createdAt)}</dd>
              </dl>
              {invoice.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit €</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(invoice.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p>{item.description}</p>
                        {item.hoursLogged && (
                          <p className="text-xs text-muted-foreground">
                            {Number(item.hoursLogged).toFixed(1)} h × {formatCurrency(item.hourlyRate ?? 0)}/h
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{Number(item.quantity).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50 text-sm">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                      VAT ({(Number(invoice.taxRate) * 100).toFixed(0)}%)
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(invoice.taxAmount)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                    <td className="px-4 py-3 text-right text-base">{formatCurrency(invoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right column: payment status + history */}
        <div className="space-y-6">
          {/* Payment summary */}
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${paidPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{paidPct.toFixed(0)}% paid</span>
                  <span>{remaining > 0 ? `${formatCurrency(remaining)} remaining` : 'Fully paid'}</span>
                </div>
              </div>

              {remaining <= 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Fully paid</span>
                </div>
              ) : (
                canEdit && (
                  <Button className="w-full" size="sm" onClick={() => setPaymentOpen(true)}>
                    <CreditCard className="w-4 h-4 mr-2" /> Record Payment
                  </Button>
                )
              )}
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Payment History</CardTitle>
                {canEdit && remaining > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPaymentOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(invoice.payments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payments recorded</p>
              ) : (
                <div className="space-y-3">
                  {(invoice.payments ?? []).map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method]}
                        </p>
                        {payment.reference && (
                          <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                        )}
                        {payment.recordedBy && (
                          <p className="text-xs text-muted-foreground">by {payment.recordedBy.name}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"
                          onClick={() => handleDeletePayment(payment)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (€) *</Label>
              <Input
                type="number" min="0.01" step="0.01"
                placeholder={`Max ${formatCurrency(remaining)}`}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Method *</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v as PaymentMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference / Transaction ID</Label>
              <Input
                placeholder="Bank ref, check #, etc."
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={addPaymentMut.isPending}>
              {addPaymentMut.isPending ? 'Saving…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
