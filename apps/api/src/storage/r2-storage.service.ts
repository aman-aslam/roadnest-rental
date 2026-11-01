import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

@Injectable()
export class R2StorageService {
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    const bucket = this.config.get<string>('R2_BUCKET_NAME')?.trim();

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new ServiceUnavailableException(
        'Private file storage is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME to the API environment.',
      );
    }

    return {
      host: `${accountId}.r2.cloudflarestorage.com`,
      accessKeyId,
      secretAccessKey,
      bucket,
    };
  }

  private hmac(key: Buffer | string, value: string): Buffer {
    return createHmac('sha256', key).update(value, 'utf8').digest();
  }

  private sha256(value: Buffer | string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private encodeKey(key: string): string {
    return key.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, char =>
      '%' + char.charCodeAt(0).toString(16).toUpperCase(),
    )).join('/');
  }

  private signedRequest(method: 'PUT' | 'GET', key: string, body?: Buffer, contentType?: string) {
    const settings = this.settings();
    const host = settings.host;
    const uri = `/${settings.bucket}/${this.encodeKey(key)}`;
    const url = `https://${host}${uri}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = this.sha256(body ?? Buffer.alloc(0));

    const canonicalHeadersMap: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (method === 'PUT' && contentType) canonicalHeadersMap['content-type'] = contentType;

    const signedHeaderNames = Object.keys(canonicalHeadersMap).sort();
    const canonicalHeaders = signedHeaderNames
      .map(name => `${name}:${canonicalHeadersMap[name].trim()}`)
      .join('\n');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [
      method,
      uri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const region = 'auto';
    const service = 's3';
    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      this.sha256(canonicalRequest),
    ].join('\n');

    const dateKey = this.hmac('AWS4' + settings.secretAccessKey, dateStamp);
    const regionKey = this.hmac(dateKey, region);
    const serviceKey = this.hmac(regionKey, service);
    const signingKey = this.hmac(serviceKey, 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${settings.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    };
    if (method === 'PUT' && contentType) headers['Content-Type'] = contentType;

    return { url, headers, body };
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const request = this.signedRequest('PUT', key, body, contentType);
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: 'PUT',
        headers: request.headers,
        // Node's fetch BodyInit typings accept Uint8Array (not Buffer on all TS/Node versions).
        body: request.body ? new Uint8Array(request.body) : undefined,
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw new BadGatewayException('Could not reach private file storage. Please retry the upload.');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[R2] Upload failed:', response.status, detail.slice(0, 300));
      throw new BadGatewayException('Private file storage rejected the upload. Check the R2 bucket and API token permissions.');
    }
  }

  async download(key: string): Promise<Buffer> {
    const request = this.signedRequest('GET', key);
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: 'GET',
        headers: request.headers,
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw new BadGatewayException('Could not reach private file storage. Please retry.');
    }

    if (response.status === 404) {
      throw new BadGatewayException('The stored file could not be found. It may need to be uploaded again.');
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[R2] Download failed:', response.status, detail.slice(0, 300));
      throw new BadGatewayException('Private file storage could not return this file.');
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
