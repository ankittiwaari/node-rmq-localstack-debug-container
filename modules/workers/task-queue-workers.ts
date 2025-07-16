import TaskQueue from '../queue/task-queue'
import AWS from './aws'
export default class TaskWorkers{
    static async consumeTasks(){
        await TaskQueue.consumeMessage({
            queueName: 'q.tasks',
            messageCallback: this.processUploads,
            logger: console
        })
    }

    static async processUploads(msg:string){
        await AWS.upload({bucketName:'my-bucket', filePath:'/Users/ankitt/Downloads/dice_images/Gemini_Generated_Image_31jnli31jnli31jn.png'})
        await AWS.uploadMultipart({
        bucketName: "my-big-files",
        filePath: "/Users/ankitt/Downloads/dice_images/Gemini_Generated_Image_31jnli31jnli31jn.png",
        });
        console.log("Done")
    }
}