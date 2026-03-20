import mongoose, { Schema, Document } from "mongoose";

export type BillStatus = "unpaid" | "paid" | "overdue";

export interface IBill extends Document {
  tenantDomain: string;
  tenantName: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: BillStatus;
  notes: string;
  createdAt: Date;
  paidAt?: Date;
}

const BillSchema = new Schema<IBill>({
  tenantDomain: { type: String, required: true, index: true },
  tenantName:   { type: String, required: true },
  amount:       { type: Number, required: true },
  currency:     { type: String, default: "USD" },
  dueDate:      { type: Date, required: true },
  status:       { type: String, enum: ["unpaid", "paid", "overdue"], default: "unpaid" },
  notes:        { type: String, default: "" },
  paidAt:       { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const Bill = mongoose.model<IBill>("Bill", BillSchema);
