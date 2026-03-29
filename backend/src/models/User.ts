import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "superadmin" | "admin" | "user";

export interface IUser extends Document {
  email: string;
  password: string;         // argon2id hash
  domain: string;           // mail domain — used by Postfix/Dovecot lookup chain (do NOT rename)
  role: UserRole;
  quotaMb: number;
  active: boolean;
  displayName?: string;
  avatar?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  domain:      { type: String, required: true, index: true },
  role:        { type: String, enum: ["superadmin", "admin", "user"], default: "user" },
  quotaMb:     { type: Number, default: 1024 },
  active:      { type: Boolean, default: true },
  displayName: { type: String },
  avatar:      { type: String },
  createdAt:   { type: Date, default: Date.now },
});

// Compound index for admin queries (list all users in a domain)
UserSchema.index({ domain: 1, role: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);

// ── Domain model (used by Postfix/Dovecot internal lookup) ────────────────
export interface IDomain extends Document {
  name: string;
  active: boolean;
}

const DomainSchema = new Schema<IDomain>({
  name:   { type: String, required: true, unique: true, lowercase: true },
  active: { type: Boolean, default: true },
});

export const Domain = mongoose.model<IDomain>("Domain", DomainSchema);
