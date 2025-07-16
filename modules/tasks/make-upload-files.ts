import { Request, Response } from 'express';
import {TaskRequestBody} from '../../shared/types';
import TaskQueue from '../queue/task-queue';

export default class MakeAndUploadFiles{
    static  createJobs = async(req:Request<unknown, unknown, TaskRequestBody>, res:Response): Promise<Response> => {
        const requestBody:TaskRequestBody = req.body
        const taskData: TaskRequestBody = {
            fileCount: req.body.fileCount,
            fileSize: req.body.fileSize,
            s3Destination: req.body.s3Destination
        };

        const tasks = this.createTasks(taskData)
        return res.sendStatus(200)
    }

    static async createTasks(taskData:TaskRequestBody){
        return TaskQueue.publishMessages(taskData.fileCount)
    }        
}