import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { S3Service } from './s3.service';

@Controller('api/uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        // Only validate if file is provided
        if (file && !file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async create(
    @UploadedFile() file?: Express.Multer.File,
    @Body('message') message?: string,
    @Body('uploadedBy') uploadedBy?: string,
    @Body('uploadSource') uploadSource?: string,
  ) {
    let photoUrl: string | undefined;

    if (file) {
      try {
        // Upload to S3
        photoUrl = await this.s3Service.uploadFile(file);
      } catch (error: any) {
        throw new InternalServerErrorException(
          error.message || 'Failed to upload file to S3',
        );
      }
    }

    if (!photoUrl && !message?.trim()) {
      throw new BadRequestException(
        'Either a photo or message (or both) must be provided',
      );
    }

    const upload = await this.uploadsService.create(
      photoUrl,
      message?.trim(),
      uploadedBy,
      uploadSource,
    );
    return {
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      status: upload.status,
      createdAt: upload.createdAt,
    };
  }

  @Get()
  async findAll(@Query('status') status?: string) {
    const uploads = await this.uploadsService.findAll(status);
    return uploads.map((upload) => ({
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      status: upload.status,
      createdAt: upload.createdAt,
      displayed: upload.displayed,
    }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const upload = await this.uploadsService.findOne(id);
    return {
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      status: upload.status,
      createdAt: upload.createdAt,
      displayed: upload.displayed,
    };
  }

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject' | 'schedule',
  ) {
    if (!['approve', 'reject', 'schedule'].includes(action)) {
      throw new BadRequestException('Invalid action. Must be approve, reject, or schedule');
    }

    const upload = await this.uploadsService.updateStatus(id, action);
    return {
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      status: upload.status,
      createdAt: upload.createdAt,
      displayed: upload.displayed,
    };
  }

  @Patch('bulk')
  async bulkUpdateStatus(
    @Body('ids') ids: string[],
    @Body('action') action: 'approve' | 'reject' | 'schedule',
  ) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array');
    }

    if (!['approve', 'reject', 'schedule'].includes(action)) {
      throw new BadRequestException('Invalid action. Must be approve, reject, or schedule');
    }

    const result = await this.uploadsService.bulkUpdateStatus(ids, action);
    return result;
  }

  @Post('batch')
  @UseInterceptors(
    FilesInterceptor('photos', 20, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (file && !file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async batchCreate(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('message') message?: string,
    @Body('uploadedBy') uploadedBy?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    try {
      const uploads = await this.uploadsService.createBatch(
        files,
        message?.trim(),
        uploadedBy,
      );
      return uploads.map((upload) => ({
        id: upload._id.toString(),
        photoUrl: upload.photoUrl,
        message: upload.message,
        status: upload.status,
        createdAt: upload.createdAt,
      }));
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.message || 'Failed to upload files',
      );
    }
  }
}

