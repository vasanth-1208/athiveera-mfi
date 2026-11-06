import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  _id: any;
  seq: number;
}

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Counter = mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);
