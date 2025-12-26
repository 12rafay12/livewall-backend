import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { S3Service } from './s3.service';
import { Upload, UploadSchema } from '../schemas/upload.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Upload.name, schema: UploadSchema }]),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, S3Service],
})
export class UploadsModule {}

