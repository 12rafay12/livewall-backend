import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import * as selfsigned from 'selfsigned';

// Generate self-signed certificate for development
async function ensureDevCertificate() {
  const certDir = join(process.cwd(), 'dev-cert');
  const keyPath = join(certDir, 'key.pem');
  const certPath = join(certDir, 'cert.pem');

  // Check if certificates already exist
  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: readFileSync(keyPath, 'utf8'),
      cert: readFileSync(certPath, 'utf8'),
    };
  }

  // Create directory if it doesn't exist
  if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
  }

  // Generate self-signed certificate
  console.log('Generating self-signed SSL certificate for development...');
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = await selfsigned.generate(attrs, { keySize: 2048 });

  // Save certificates to disk
  writeFileSync(keyPath, pems.private, 'utf8');
  writeFileSync(certPath, pems.cert, 'utf8');
  console.log('SSL certificate generated successfully!');

  return {
    key: pems.private,
    cert: pems.cert,
  };
}

async function bootstrap() {
  const useHttps = process.env.USE_HTTPS !== 'false'; // Default to HTTPS

  let httpsOptions;
  if (useHttps) {
    try {
      httpsOptions = await ensureDevCertificate();
    } catch (error) {
      console.log('Falling back to HTTP mode...');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  // Enable CORS - Allow all origins
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // Must be false when origin is '*'
  });

  // Serve static files from public directory
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  const protocol = httpsOptions ? 'https' : 'http';
  console.log(`Application is running on: ${protocol}://localhost:${port}`);
}
void bootstrap();
