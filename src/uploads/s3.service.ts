import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error(
        'Missing required AWS configuration. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in your .env file',
      );
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Force path style for better compatibility
      forcePathStyle: false,
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const fileExtension = extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `uploads/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Removed ACL: 'public-read' as modern buckets often have ACLs disabled
      // Use bucket policy instead for public read access
    });

    try {
      await this.s3Client.send(command);

      // Return the public URL
      // Handle different S3 URL formats based on region
      let publicUrl: string;
      if (this.region === 'us-east-1') {
        // us-east-1 uses a different URL format
        publicUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      } else {
        publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      }
      return publicUrl;
    } catch (error: any) {
      // Provide more helpful error messages
      if (error.Code === 'PermanentRedirect') {
        // Try to extract the correct region from the error endpoint
        let suggestedRegion = this.region;
        if (error.Endpoint) {
          // Endpoint format: bucket-name.s3-region.amazonaws.com
          const match = error.Endpoint.match(/s3-([^.]+)\.amazonaws\.com/);
          if (match && match[1]) {
            suggestedRegion = match[1];
          }
        }
        throw new Error(
          `S3 bucket region mismatch. The bucket '${this.bucketName}' appears to be in region '${suggestedRegion}', but your AWS_REGION is set to '${this.region}'. Please update AWS_REGION=${suggestedRegion} in your .env file.`,
        );
      }
      if (error.name === 'NoSuchBucket') {
        throw new Error(
          `S3 bucket '${this.bucketName}' does not exist. Please check your AWS_S3_BUCKET_NAME in .env file.`,
        );
      }
      if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
        throw new Error(
          'Invalid AWS credentials. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file.',
        );
      }
      if (error.name === 'AccessDenied') {
        throw new Error(
          'Access denied. Please check that your AWS credentials have permission to upload to the S3 bucket.',
        );
      }
      // Re-throw with original message if it's a known error type
      if (error.message) {
        throw new Error(`S3 upload failed: ${error.message}`);
      }
      throw error;
    }
  }

  async deleteFile(photoUrl: string): Promise<void> {
    try {
      // Skip if it's not an S3 URL (might be old local path)
      if (!photoUrl.includes('.amazonaws.com/') && !photoUrl.includes('s3://')) {
        return;
      }

      // Extract the key from the URL
      // URL formats:
      // - https://bucket-name.s3.region.amazonaws.com/uploads/filename
      // - https://bucket-name.s3.amazonaws.com/uploads/filename (us-east-1)
      let key: string;
      if (photoUrl.includes('.amazonaws.com/')) {
        const urlParts = photoUrl.split('.amazonaws.com/');
        if (urlParts.length !== 2) {
          return;
        }
        key = urlParts[1];
      } else {
        // Handle s3:// URLs
        const urlParts = photoUrl.replace('s3://', '').split('/');
        if (urlParts.length < 2) {
          return;
        }
        key = urlParts.slice(1).join('/');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      // Log error but don't throw - file might not exist or might be a local path
      console.error('Error deleting file from S3:', error);
    }
  }
}

