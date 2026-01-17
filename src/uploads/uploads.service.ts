import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Upload, UploadDocument, UploadStatus } from '../schemas/upload.schema';
import { S3Service } from './s3.service';

@Injectable()
export class UploadsService {
  constructor(
    @InjectModel(Upload.name) private uploadModel: Model<UploadDocument>,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    photoUrl?: string,
    message?: string,
    username?: string,
    email?: string,
    uploadedBy?: string,
    uploadSource?: string,
  ): Promise<UploadDocument> {
    const upload = new this.uploadModel({
      photoUrl,
      message,
      username,
      email,
      status: UploadStatus.PENDING,
      displayed: false,
      uploadedBy: uploadedBy || undefined,
      uploadSource: uploadSource || 'public',
    });
    return upload.save();
  }

  async createBatch(
    files: Express.Multer.File[],
    message?: string,
    uploadedBy?: string,
  ): Promise<UploadDocument[]> {
    const uploads: UploadDocument[] = [];

    for (const file of files) {
      try {
        // Upload file to S3
        const photoUrl = await this.s3Service.uploadFile(file);

        // Create upload record
        const upload = new this.uploadModel({
          photoUrl,
          message,
          status: UploadStatus.PENDING,
          displayed: false,
          uploadedBy: uploadedBy || undefined,
          uploadSource: 'photographer',
        });

        const savedUpload = await upload.save();
        uploads.push(savedUpload);
      } catch (error) {
        // Log error but continue with other files
        console.error(`Failed to upload file ${file.originalname}:`, error);
      }
    }

    return uploads;
  }

  async findAll(
    status?: string,
    displayed?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ uploads: UploadDocument[]; total: number; page: number; limit: number }> {
    // Auto-activate scheduled uploads that have reached their scheduled time
    const now = new Date();
    await this.uploadModel
      .updateMany(
        {
          status: UploadStatus.SCHEDULED,
          scheduledFor: { $lte: now },
        },
        {
          status: UploadStatus.APPROVED,
          $unset: { scheduledFor: '' },
        },
      )
      .exec();

    const query: any = {};

    if (status) {
      query.status = status.toUpperCase();
    }

    if (displayed === 'displayed') {
      query.displayed = true;
    } else if (displayed === 'not-displayed') {
      query.displayed = false;
    }

    const total = await this.uploadModel.countDocuments(query).exec();
    const uploads = await this.uploadModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return { uploads, total, page, limit };
  }

  async findOne(id: string): Promise<UploadDocument> {
    const upload = await this.uploadModel.findById(id).exec();
    if (!upload) {
      throw new NotFoundException(`Upload with ID ${id} not found`);
    }
    return upload;
  }

  async updateStatus(
    id: string,
    action: 'approve' | 'reject' | 'schedule',
    scheduledFor?: Date,
  ): Promise<UploadDocument> {
    const upload = await this.findOne(id);

    switch (action) {
      case 'approve':
        upload.status = UploadStatus.APPROVED;
        upload.scheduledFor = undefined; // Clear scheduled time when approved
        break;
      case 'reject':
        upload.status = UploadStatus.REJECTED;
        upload.scheduledFor = undefined; // Clear scheduled time when rejected
        break;
      case 'schedule':
        upload.status = UploadStatus.SCHEDULED;
        upload.scheduledFor = scheduledFor || new Date(); // Use provided time or current time
        break;
    }

    return upload.save();
  }

  async bulkUpdateStatus(
    ids: string[],
    action: 'approve' | 'reject' | 'schedule',
  ): Promise<{ modifiedCount: number }> {
    let status: UploadStatus;
    switch (action) {
      case 'approve':
        status = UploadStatus.APPROVED;
        break;
      case 'reject':
        status = UploadStatus.REJECTED;
        break;
      case 'schedule':
        status = UploadStatus.SCHEDULED;
        break;
    }

    const result = await this.uploadModel
      .updateMany({ _id: { $in: ids } }, { status })
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  async markAsDisplayed(id: string): Promise<UploadDocument> {
    const upload = await this.findOne(id);
    upload.displayed = true;
    return upload.save();
  }

  async delete(id: string): Promise<void> {
    const upload = await this.findOne(id);

    // Delete file from S3 if exists
    if (upload.photoUrl) {
      await this.s3Service.deleteFile(upload.photoUrl);
    }

    await this.uploadModel.findByIdAndDelete(id).exec();
  }
}

