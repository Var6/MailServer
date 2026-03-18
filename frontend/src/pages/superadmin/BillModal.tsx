import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Receipt, CheckCircle, Clock, AlertCircle, Trash2, Plus } from "lucide-react";
import { getBills, createBill, updateBillStatus, deleteBill, type Bill, type BillStatus } from "../../api/billingApi.ts";
import { useToastStore } from "../../store/index.ts";
import { type Tenant } from "../../api/superadminApi.ts";
import axios from "axios";

interface Props { tenant: Tenant; onClose: () => void; }

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];

const statusConfig: Record<BillStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  paid:    { label: "Paid",    color: "bg-green-100 text-green-700",  icon: CheckCircle },
  unpaid:  { label: "Unpaid",  color: "bg-yellow-100 text-yellow-700", icon: Clock },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700",       icon: AlertCircle },
};

export default function BillModal({ tenant, onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [showForm, setShowForm] = useState(false);

  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ amount: "", currency: "USD", dueDate: defaultDue, notes: "" });

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["bills", tenant.domain],
    queryFn: () => getBills(tenant.domain),
  });

  const createMutation = useMutation({
    mutationFn: () => createBill({
      tenantDomain: tenant.domain,
      amount: parseFloat(form.amount),
      currency: form.currency,
      dueDate: form.dueDate,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills", tenant.domain] });
      qc.invalidateQueries({ queryKey: ["bill-summary"] });
      addToast("Bill created", "success");
      setShowForm(false);
      setForm({ amount: "", currency: "USD", dueDate: defaultDue, notes: "" });
    },
    onError: (e: unknown) => addToast(
      axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : "Failed to create bill", "error"
    ),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BillStatus }) => updateBillStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills", tenant.domain] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills", tenant.domain] });
      qc.invalidateQueries({ queryKey: ["bill-summary"] });
    },
  });

  const totalOwed = bills.filter(b => b.status !== "paid").reduce((s, b) => s + b.amount, 0);
  const totalPaid = bills.filter(b => b.status === "paid").reduce((s, b) => s + b.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Receipt size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">Billing — {tenant.name}</h2>
              <p className="text-xs text-[#5f6368]">{tenant.domain}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-100">
            <div className="bg-yellow-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-yellow-700">${totalOwed.toFixed(2)}</p>
              <p className="text-xs text-yellow-600">Outstanding</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-700">${totalPaid.toFixed(2)}</p>
              <p className="text-xs text-green-600">Paid</p>
            </div>
          </div>

          {/* New bill form */}
          {showForm ? (
            <form
              onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}
              className="p-4 border-b border-gray-100 space-y-3 bg-indigo-50/40"
            >
              <p className="text-xs font-semibold text-[#202124] uppercase tracking-wider">New Bill</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#5f6368]">Amount *</label>
                  <input
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    type="number" min="0.01" step="0.01" required placeholder="0.00"
                    className="field-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#5f6368]">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="field-input">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#5f6368]">Due Date *</label>
                <input value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  type="date" required className="field-input" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#5f6368]">Notes / Description</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Monthly plan, Pro tier, etc." className="field-input resize-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm">
                  {createMutation.isPending ? "Creating…" : "Create Bill"}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 border-b border-gray-100">
              <button onClick={() => setShowForm(true)}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                <Plus size={15} /> Create New Bill
              </button>
            </div>
          )}

          {/* Bills list */}
          <div className="divide-y divide-gray-50">
            {isLoading && <p className="text-center py-8 text-sm text-[#5f6368]">Loading…</p>}
            {!isLoading && bills.length === 0 && (
              <p className="text-center py-10 text-sm text-[#5f6368]">No bills yet for this tenant.</p>
            )}
            {bills.map(bill => {
              const cfg = statusConfig[bill.status];
              const Icon = cfg.icon;
              return (
                <div key={bill._id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-[#202124] text-sm">
                        {bill.currency} {bill.amount.toFixed(2)}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <Icon size={10} /> {cfg.label}
                      </span>
                    </div>
                    {bill.notes && <p className="text-xs text-[#5f6368] truncate">{bill.notes}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Due: {new Date(bill.dueDate).toLocaleDateString()}
                      {bill.paidAt && ` · Paid: ${new Date(bill.paidAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {bill.status !== "paid" && (
                      <button
                        onClick={() => statusMutation.mutate({ id: bill._id, status: "paid" })}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
                      >
                        Mark Paid
                      </button>
                    )}
                    {bill.status === "paid" && (
                      <button
                        onClick={() => statusMutation.mutate({ id: bill._id, status: "unpaid" })}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Unmark
                      </button>
                    )}
                    <button onClick={() => deleteMutation.mutate(bill._id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
