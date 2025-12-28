import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UploadDocument = Upload & Document;

export enum UploadStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
}

@Schema({ timestamps: true })
export class Upload {
  @Prop({ required: false })
  photoUrl?: string;

  @Prop({ required: false })
  message?: string;

  @Prop({
    type: String,
    enum: UploadStatus,
    default: UploadStatus.PENDING,
    required: true,
  })
  status: UploadStatus;

  @Prop({ default: false })
  displayed: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  uploadedBy?: Types.ObjectId;

  @Prop({ type: String, enum: ['public', 'photographer'], default: 'public' })
  uploadSource?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UploadSchema = SchemaFactory.createForClass(Upload);

