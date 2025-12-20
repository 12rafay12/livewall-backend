import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

  createdAt?: Date;
  updatedAt?: Date;
}

export const UploadSchema = SchemaFactory.createForClass(Upload);

