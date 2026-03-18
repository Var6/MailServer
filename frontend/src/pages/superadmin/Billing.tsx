import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import { getBillSummary, getBills, updateBillStatus, type BillStatus } from "../../api/billingApi.ts";
import { useToastStore } from "../../store/index.ts";

export default function BillingPage() {
  const qc = useQueryClient();
  const { addToast } = useToastStore();

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["bill-summary"],
    queryFn: getBillSummary,
    refetchInterval: 60_000,
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["bills-all"],
    queryFn: () => getBills(),
    refetchInterval: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BillStatus }) => updateBillStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills-all"] });
      qc.invalidateQueries({ queryKey: ["bill-summary"] });
      addToast("Bill updated", "success");
    },
  });

  const totalOutstanding = allBills.filter(b => b.status !== "paid").reduce((s, b) => s + b.amount, 0);
  const totalPaid = allBills.filter(b => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const overdueCount = allBills.filter(b => b.status === "overdue").length;

  return (
    <div className="flex flex-col h-full bg-[#f6f8fc]">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <h1 className="text-xl font-semibold text-[#202124]">Billing</h1>
        <p className="text-sm text-[#5f6368] mt-0.5">Track payments and invoices across all tenants</p>

        <div className="grid grid-cols-3 gap-4 mt-4">
          {[
            { label: "Outstanding", value: `$${totalOutstanding.toFixed(2)}`, icon: DollarSign, color: "text-yellow-600 bg-yellow-50" },
            { label: "Total Collected", value: `$${totalPaid.toFixed(2)}`, icon: CheckCircle, color: "text-green-600 bg-green-50" },
            { label: "Overdue Bills", value: overdueCount, icon: AlertCircle, color: overdueCount > 0 ? "text-red-600 bg-red-50" : "text-gray-400 bg-gray-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}><Icon size={18} /></div>
              <div>
                <p className="text-2xl font-semibold text-[#202124]">{value}</p>
                <p className="text-xs text-[#5f6368]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Per-tenant summary cards */}
        {isLoading && <p className="text-center py-12 text-[#5f6368] text-sm">Loading…</p>}
        {!isLoading && summary.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
            <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-[#5f6368]">No bills yet. Create bills from the Tenants page using the receipt icon.</p>
          </div>
        )}

        {summary.map(s => {
          const tenantBills = allBills.filter(b => b.tenantDomain === s._id);
          const unpaid = tenantBills.filter(b => b.status !== "paid");
          return (
            <div key={s._id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-semibold text-sm uppercase">
                    {s.tenantName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-[#202124] text-sm">{s.tenantName}</p>
                    <p className="text-xs text-[#5f6368]">{s._id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#202124]">${(s.totalBilled - s.totalPaid).toFixed(2)} due</p>
                  <p className="text-xs text-[#5f6368]">${s.totalPaid.toFixed(2)} paid of ${s.totalBilled.toFixed(2)}</p>
                </div>
              </div>

              {unpaid.length === 0 ? (
                <p className="px-5 py-3 text-xs text-green-600 flex items-center gap-1.5">
                  <CheckCircle size={12} /> All bills paid
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unpaid.map(bill => (
                    <div key={bill._id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#202124]">{bill.currency} {bill.amount.toFixed(2)}</p>
                        <p className="text-xs text-[#5f6368]">
                          {bill.notes || "Invoice"} · Due {new Date(bill.dueDate).toLocaleDateString()}
                          {bill.status === "overdue" && <span className="text-red-500 font-medium"> · OVERDUE</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => statusMutation.mutate({ id: bill._id, status: "paid" })}
                        disabled={statusMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors font-medium"
                      >
                        Mark Paid
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
