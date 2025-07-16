import { Channel } from "amqplib";

export interface TaskRequestBody{
    fileCount:number,
    fileSize:number,
    s3Destination:string
}

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export interface ConsumeMessageOptions{
    messageCallback(msg:string):void,
    logger: Logger,
    queueName: string
}

export interface StartConsumerOptions extends ConsumeMessageOptions{
    channel:Channel
}

export interface S3UploadOptions{
    bucketName: string,
    filePath: string
}