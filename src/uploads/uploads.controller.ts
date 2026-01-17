import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
    @Body('username') username?: string,
    @Body('email') email?: string,
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
      username?.trim(),
      email?.trim(),
      uploadedBy,
      uploadSource,
    );
    return {
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      username: upload.username,
      email: upload.email,
      status: upload.status,
      createdAt: upload.createdAt,
    };
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('displayed') displayed?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const result = await this.uploadsService.findAll(status, displayed, pageNum, limitNum);

    return {
      uploads: result.uploads.map((upload) => ({
        id: upload._id.toString(),
        photoUrl: upload.photoUrl,
        message: upload.message,
        username: upload.username,
        email: upload.email,
        status: upload.status,
        createdAt: upload.createdAt,
        displayed: upload.displayed,
        scheduledFor: upload.scheduledFor,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const upload = await this.uploadsService.findOne(id);
    return {
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      username: upload.username,
      email: upload.email,
      status: upload.status,
      createdAt: upload.createdAt,
      displayed: upload.displayed,
    };
  }

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject' | 'schedule',
    @Body('scheduledFor') scheduledFor?: string,
  ) {
    if (!['approve', 'reject', 'schedule'].includes(action)) {
      throw new BadRequestException('Invalid action. Must be approve, reject, or schedule');
    }

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : undefined;
    const upload = await this.uploadsService.updateStatus(id, action, scheduledDate);
    return {
      id: upload._id.toString(),
      photoUrl: upload.photoUrl,
      message: upload.message,
      username: upload.username,
      email: upload.email,
      status: upload.status,
      createdAt: upload.createdAt,
      displayed: upload.displayed,
      scheduledFor: upload.scheduledFor,
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

  @Patch(':id/displayed')
  async markAsDisplayed(@Param('id') id: string) {
    try {
      const upload = await this.uploadsService.markAsDisplayed(id);
      return {
        id: upload._id.toString(),
        displayed: upload.displayed,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.message || 'Failed to mark upload as displayed',
      );
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.uploadsService.delete(id);
      return { message: 'Upload deleted successfully' };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.message || 'Failed to delete upload',
      );
    }
  }
}

