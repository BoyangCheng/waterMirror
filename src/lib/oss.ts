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
  // ali-oss returns HTTP URLs by default; force HTTPS to avoid
  // mixed-content blocks when the site is served over HTTPS
  return result.url.replace(/^http:\/\//, "https://");
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

/**
 * \u7ed9 call video \u751f\u6210\u5bf9\u8c61 key\uff1acall-videos/{call_id}/{timestamp}.webm
 * call_id \u5df2\u7ecf\u662f nanoid\uff0c\u4e0d\u9700\u8981\u518d sanitize\u3002
 */
export function getCallVideoObjectKey(callId: string): string {
  return `call-videos/${callId}/${Date.now()}.webm`;
}

/**
 * \u7ed9 objectKey \u62fc\u51fa\u516c\u7f51\u64ad\u653e URL\u3002\u5f3a\u5236 https\u3002
 * generateObjectUrl \u62fc\u7684\u662f bucket-domain \u5f62\u5f0f\uff1a
 *   https://{bucket}.{region}.aliyuncs.com/{objectKey}
 */
export function getOSSPublicUrl(objectKey: string): string {
  const client = getOSSClient();
  return client.generateObjectUrl(objectKey).replace(/^http:\/\//, "https://");
}

/**
 * Append \u4e00\u4e2a chunk \u5230 OSS \u5bf9\u8c61\uff08\u8fb9\u5f55\u8fb9\u4f20\u7528\uff09\u3002
 *
 * - \u9996\u6b21\u8c03\u7528 position \u5fc5\u987b\u662f 0\uff1b\u540e\u7eed\u4f20\u5165\u4e0a\u6b21\u8fd4\u56de\u7684 nextAppendPosition\u3002
 * - position \u4e0d\u5339\u914d\u65f6 OSS \u629b PositionNotEqualToLength\uff0c\u8c03\u7528\u65b9\u5e94\u5f53\u4e2d\u6b62\u6d41\u5f0f\u4e0a\u4f20\uff0c
 *   \u964d\u7ea7\u5230\u7ed3\u675f\u540e\u4e00\u6b21\u6027 PUT \u6574\u4e2a Blob\u3002
 *
 * @returns nextAppendPosition\uff1a\u4e0b\u4e00\u4e2a chunk \u5e94\u5f53\u7528\u7684 position
 */
export async function appendToOSS(
  objectKey: string,
  buffer: Buffer,
  position: number,
): Promise<{ nextAppendPosition: number }> {
  const client = getOSSClient();
  // ali-oss \u7684 append \u76f4\u63a5\u63a5 Buffer/stream/file path\uff0cposition \u5fc5\u987b\u7b49\u4e8e\u5f53\u524d\u5bf9\u8c61\u5927\u5c0f\u3002
  // ali-oss \u7684 type d.ts \u628a position \u6807\u6210 string\uff08\u5176\u5b9e\u63a5\u53d7 number/string\uff09\uff0c\u5f3a\u8f6c\u4e00\u4e0b\u7ed5\u8fc7\u3002
  const result = (await client.append(objectKey, buffer, {
    position: String(position),
  } as any)) as { nextAppendPosition?: number | string };
  // ali-oss \u5728\u4e0d\u540c\u7248\u672c\u91cc\u6709\u65f6\u8fd4\u56de\u5b57\u7b26\u4e32\u3001\u6709\u65f6\u8fd4\u56de\u6570\u5b57\uff0c\u7edf\u4e00\u6210 number
  const next = Number(result.nextAppendPosition ?? position + buffer.length);
  return { nextAppendPosition: next };
}

/**
 * \u751f\u6210\u4e00\u4e2a 5 \u5206\u949f\u6709\u6548\u671f\u7684\u9884\u7b7e\u540d PUT URL\uff0c\u8ba9\u6d4f\u89c8\u5668\u76f4\u63a5 PUT \u4e8c\u8fdb\u5236\u89c6\u9891\u5230 OSS\u3002
 * \u8fd9\u6837 ~40MB \u7684\u89c6\u9891\u4e0d\u7ed5 Next.js\uff08\u907f\u514d\u6491\u7206 body limit + \u5360 server \u6d41\u91cf\uff09\uff0c
 * \u540c\u65f6\u4e0d\u9700\u8981\u628a AccessKey \u66b4\u9732\u7ed9\u524d\u7aef\u3002
 *
 * @param objectKey  OSS \u5bf9\u8c61 key\uff08\u7528 getCallVideoObjectKey \u751f\u6210\uff09
 * @param contentType \u4e0a\u4f20\u65f6\u6d4f\u89c8\u5668\u4f1a\u5e26\u7684 Content-Type\uff0c\u5fc5\u987b\u548c\u7b7e\u540d\u65f6\u58f0\u660e\u7684\u4e00\u81f4
 * @returns { uploadUrl, publicUrl }
 *   - uploadUrl\uff1a\u6d4f\u89c8\u5668 PUT \u7528\u7684\u4e34\u65f6 URL\uff08\u5e26\u7b7e\u540d\uff09
 *   - publicUrl\uff1a\u4e0a\u4f20\u6210\u529f\u540e\u7528\u6765\u64ad\u653e\u7684\u56fa\u5b9a URL\uff08\u5199\u5230 response.video_url\uff09
 */
export function getPresignedPutUrl(
  objectKey: string,
  contentType = "video/webm",
): { uploadUrl: string; publicUrl: string } {
  const client = getOSSClient();
  // signatureUrl \u662f\u540c\u6b65\u7b7e\u540d V1\uff0c\u7b7e\u540d\u91cc\u5305\u542b method + content-type\uff0c
  // \u6d4f\u89c8\u5668 PUT \u65f6\u5fc5\u987b\u5e26\u76f8\u540c\u7684 Content-Type \u5934\u624d\u4f1a\u88ab OSS \u63a5\u53d7\u3002
  const uploadUrl = client.signatureUrl(objectKey, {
    method: "PUT",
    expires: 300,
    "Content-Type": contentType,
  });
  // \u5f3a\u5236 https\uff0c\u4e0e uploadToOSS \u4fdd\u6301\u4e00\u81f4\u907f\u514d\u6df7\u5408\u5185\u5bb9
  const httpsUploadUrl = uploadUrl.replace(/^http:\/\//, "https://");
  const publicUrl = client.generateObjectUrl(objectKey).replace(/^http:\/\//, "https://");
  return { uploadUrl: httpsUploadUrl, publicUrl };
}
