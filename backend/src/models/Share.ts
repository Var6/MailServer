import mongoose from "mongoose";

const shareSchema = new mongoose.Schema({
  ownerEmail:  { type: String, required: true, index: true },
  path:        { type: String, required: true },   // virtual path e.g. "/balance-sheet.xlsx"
  isDirectory: { type: Boolean, default: false },
  sharedWith:  [{ type: String }],                 // array of emails
  permission:  { type: String, enum: ["view", "edit"], default: "view" },
  createdAt:   { type: Date, default: Date.now },
});

// Unique share per owner+path
shareSchema.index({ ownerEmail: 1, path: 1 }, { unique: true });

export const Share = mongoose.model("Share", shareSchema);
