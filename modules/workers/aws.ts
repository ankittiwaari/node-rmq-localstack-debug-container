import fs from "fs";
import path from "path";
import { S3Client, 
    CreateBucketCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { S3UploadOptions } from "../../shared/types";

export default class AWS {
  static getClient() {
    return new S3Client({
      region: "us-east-1",
      endpoint: "http://localhost:4566", // localstack endpoint if testing
      forcePathStyle: true,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
  }

  static async upload({ bucketName, filePath }: S3UploadOptions) {
    const client = this.getClient();
    try {
      await client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        })
      );
      console.log(`Bucket created: ${bucketName}`);
    } catch (err: any) {
      if (err.name === "BucketAlreadyOwnedByYou") {
        console.log(`Bucket already exists: ${bucketName}`);
      } else {
        throw err;
      }
    }

    const fileStream = fs.createReadStream(filePath);
    const fileKey = path.basename(filePath);

    const parallelUpload = new Upload({
      client,
      params: {
        Bucket: bucketName,
        Key: fileKey,
        Body: fileStream,
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false, 
    });

    parallelUpload.on("httpUploadProgress", (progress) => {
      console.log(
        `Upload progress: ${progress.loaded}/${progress.total} bytes`
      );
    });

    try {
      const result = await parallelUpload.done();
      console.log(`Upload completed!`, result);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  }

static async uploadMultipart({ bucketName, filePath }: S3UploadOptions) {
    const client = this.getClient();
    const fileKey = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const fileStream = fs.createReadStream(filePath, { highWaterMark: 5 * 1024 * 1024 }); // 5MB chunks

    // Ensure bucket exists
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket created: ${bucketName}`);
    } catch (err: any) {
      if (err.name !== "BucketAlreadyOwnedByYou") throw err;
    }

    // Initiate multipart upload
    const createResp = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: fileKey,
      })
    );

    const uploadId = createResp.UploadId!;
    console.log(`Initiated multipart upload, UploadId: ${uploadId}`);

    const partSize = 5 * 1024 * 1024; // AWS minimum 5MB
    let partNumber = 1;
    const uploadedParts: { ETag?: string; PartNumber: number }[] = [];

    try {
      // Read file in chunks and upload each part
      let buffer = Buffer.alloc(0);

      for await (const chunk of fileStream) {
        buffer = Buffer.concat([buffer, chunk]);

        // When buffer reaches part size, upload it
        if (buffer.length >= partSize) {
          await this.uploadPart({
            client,
            bucketName,
            fileKey,
            uploadId,
            buffer,
            partNumber,
            uploadedParts,
          });
          buffer = Buffer.alloc(0); // reset buffer
          partNumber++;
        }
      }

      // Upload remaining buffer if file < partSize
      if (buffer.length > 0) {
        await this.uploadPart({
          client,
          bucketName,
          fileKey,
          uploadId,
          buffer,
          partNumber,
          uploadedParts,
        });
      }

      //Complete multipart upload
      const completeResp = await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: fileKey,
          UploadId: uploadId,
          MultipartUpload: { Parts: uploadedParts },
        })
      );

      console.log(`Upload complete! Location: ${completeResp.Location}`);
    } catch (err) {
      console.error("Upload failed, aborting...", err);

      // Abort multipart upload on error
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: fileKey,
          UploadId: uploadId,
        })
      );
    }
  }

  private static async uploadPart({
    client,
    bucketName,
    fileKey,
    uploadId,
    buffer,
    partNumber,
    uploadedParts,
  }: {
    client: S3Client;
    bucketName: string;
    fileKey: string;
    uploadId: string;
    buffer: Buffer;
    partNumber: number;
    uploadedParts: { ETag?: string; PartNumber: number }[];
  }) {
    console.log(`Uploading part #${partNumber} (${buffer.length} bytes)...`);

    const partResp = await client.send(
      new UploadPartCommand({
        Bucket: bucketName,
        Key: fileKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      })
    );

    console.log(`Uploaded part #${partNumber}, ETag: ${partResp.ETag}`);

    uploadedParts.push({
      ETag: partResp.ETag,
      PartNumber: partNumber,
    });
  }

}
