import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Upload, UploadDocument, UploadStatus } from '../schemas/upload.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  constructor(
    @InjectModel(Upload.name) private uploadModel: Model<UploadDocument>,
  ) {}

  async create(
    photoUrl?: string,
    message?: string,
  ): Promise<UploadDocument> {
    const upload = new this.uploadModel({
      photoUrl,
      message,
      status: UploadStatus.PENDING,
      displayed: false,
    });
    return upload.save();
  }

  async findAll(status?: string): Promise<UploadDocument[]> {
    const query = status ? { status: status.toUpperCase() } : {};
    return this.uploadModel.find(query).sort({ createdAt: -1 }).exec();
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
  ): Promise<UploadDocument> {
    const upload = await this.findOne(id);

    switch (action) {
      case 'approve':
        upload.status = UploadStatus.APPROVED;
        break;
      case 'reject':
        upload.status = UploadStatus.REJECTED;
        break;
      case 'schedule':
        upload.status = UploadStatus.SCHEDULED;
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

  async delete(id: string): Promise<void> {
    const upload = await this.findOne(id);

    // Delete file if exists
    if (upload.photoUrl) {
      const filePath = path.join(
        process.cwd(),
        'public',
        path.basename(upload.photoUrl),
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.uploadModel.findByIdAndDelete(id).exec();
  }
}

