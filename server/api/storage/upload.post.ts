// server/api/storage/upload.post.ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { serverSupabaseUser } from "#supabase/server";

export default defineEventHandler(async (event) => {
  // 1. Route Guard: Ensure the user calling this endpoint has a valid active session
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" });

  // 2. Read the multipart form data sent by the frontend image form
  const files: any = await readMultipartFormData(event);
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, message: "No file uploaded." });
  }

  const targetFile = files[0];
  const fileExtension = targetFile.filename?.split(".").pop() || "jpg";

  //  FIXED: Bulletproof extraction safety check to prevent "undefined" string names
  const userId = user.id || (user as any).value?.id || "organizer";
  const uniqueKey = `events/${userId}-${Date.now()}.${fileExtension}`;

  try {
    const config = useRuntimeConfig();

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: uniqueKey,
        Body: targetFile.data,
        ContentType: targetFile.type,
      }),
    );

    return {
      success: true,
      fileUrl: `https://pub-88f41a84d6194ca59281b21ca9ef444b.r2.dev/${uniqueKey}`,
      storagePath: uniqueKey,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || "R2 Storage Engine failure.",
    });
  }
});
