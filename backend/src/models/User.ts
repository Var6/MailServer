import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;       // argon2id hash
  domain: string;
  quotaMb: number;
  active: boolean;
  displayName?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  domain:      { type: String, required: true, index: true },
  quotaMb:     { type: Number, default: 2048 },
  active:      { type: Boolean, default: true },
  displayName: { type: String },
  createdAt:   { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>("User", UserSchema);

// ── Domain model ─────────────────────────────────────────
export interface IDomain extends Document {
  name: string;
  active: boolean;
}

const DomainSchema = new Schema<IDomain>({
  name:   { type: String, required: true, unique: true, lowercase: true },
  active: { type: Boolean, default: true },
});

export const Domain = mongoose.model<IDomain>("Domain", DomainSchema);
