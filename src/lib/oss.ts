import OSS from "ali-oss";

let ossClient: OSS | null = null;

function getOSSClient(): OSS {
  if (!ossClient) {
    ossClient = new OSS({
      region: process.env.ALIBABA_OSS_REGION!,
      accessKeyId: process.env.ALIBABA_OSS_ACCESS_KEY_ID!,
      accessKeySecret: process.env.ALIBABA_OSS_ACCESS_KEY_SECRET!,
      bucket: process.env.ALIBABA_OSS_BUCKET!,
    });
  }
  return ossClient;
}

/**
 * Upload a file buffer to Alibaba Cloud OSS.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToOSS(
  buffer: Buffer,
  objectKey: string,
): Promise<string> {
  const client = getOSSClient();
  const result = await client.put(objectKey, buffer);
  return result.url;
}

/**
 * Generate a unique OSS object key for a resume file.
 */
export function getResumeObjectKey(
  jobId: string,
  originalFilename: string,
): string {
  const timestamp = Date.now();
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, "_");
  return `resumes/${jobId}/${timestamp}_${safeName}`;
}
