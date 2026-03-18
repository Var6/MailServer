import mongoose, { Schema, Document } from "mongoose";

export interface ITenant extends Document {
  name: string;              // Company display name e.g. "Acme Corp"
  domain: string;            // Mail domain e.g. "acme.com" — unique
  adminEmail: string;        // Primary admin account
  maxUsers: number;          // Ceiling set by superadmin
  storagePerUserMb: number;  // Per-user quota set by superadmin
  active: boolean;
  createdAt: Date;
  createdBy: string;         // superadmin email who created this tenant
}

const TenantSchema = new Schema<ITenant>({
  name:              { type: String, required: true },
  domain:            { type: String, required: true, unique: true, lowercase: true, trim: true },
  adminEmail:        { type: String, required: true, lowercase: true },
  maxUsers:          { type: Number, default: 10 },
  storagePerUserMb:  { type: Number, default: 1024 },   // 1 GB per user default
  active:            { type: Boolean, default: true },
  createdAt:         { type: Date, default: Date.now },
  createdBy:         { type: String, required: true },
});

export const Tenant = mongoose.model<ITenant>("Tenant", TenantSchema);
