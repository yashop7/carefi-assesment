import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_LINK_SECONDS = 300;

let client: S3Client | undefined;

// Created on first use, so `next build` works with no variables set.
function getClient() {
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export async function putObject(
  key: string,
  body: Uint8Array | string,
  contentType: string,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string) {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  return response.Body!.transformToByteArray();
}

export async function deleteObject(key: string) {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}

export async function createExpiringLink(
  key: string,
  expiresIn = MAX_LINK_SECONDS,
  fileName?: string,
) {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: fileName
        ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : undefined,
    }),
    { expiresIn: Math.min(expiresIn, MAX_LINK_SECONDS) },
  );
}
