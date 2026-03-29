import mongoose, { Schema, Document } from "mongoose";

export interface ISharedEvent extends Document {
  tenantDomain: string;   // Scopes event to one company — never from client input
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
  color?: string;
  meetingLink?: string;
  reminderMinutesBefore?: number;
  createdBy: string;      // user email
  createdAt: Date;
}

const SharedEventSchema = new Schema<ISharedEvent>({
  tenantDomain: { type: String, required: true, index: true },
  title:        { type: String, required: true },
  start:        { type: Date,   required: true },
  end:          { type: Date,   required: true },
  allDay:       { type: Boolean, default: false },
  description:  { type: String },
  color:        { type: String, default: "#1a73e8" },
  meetingLink:  { type: String },
  reminderMinutesBefore: { type: Number, min: 0, max: 10080, default: 15 },
  createdBy:    { type: String, required: true },
  createdAt:    { type: Date, default: Date.now },
});

export const SharedEvent = mongoose.model<ISharedEvent>("SharedEvent", SharedEventSchema);
