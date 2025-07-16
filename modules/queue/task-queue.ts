import amqplib, { Channel, ChannelModel } from "amqplib";
import { Logger, ConsumeMessageOptions, StartConsumerOptions } from "../../shared/types";

export default class TaskQueue{
    static connection:ChannelModel | undefined;
    static channel:Channel;
    static isChannelOpen:boolean = false;
    static connectionUri:string = `amqp://guest:guest@localhost:5672?heartbeat=10`
    static RECONNECT_INTERVAL:number = 5000;
    static RECONNECT_ATTEMPTS:number = 10;
    static prefetchCount:number = 1
    static messageOptions = {
        persistent: true
    };
    static queues = {
        tasks: "q.tasks"
    }   

    static queueOptions = {
        [this.queues.tasks]: {
            durable: true
        }
    };

    
    static async getConnection():Promise<ChannelModel|undefined> {
        if (this.connection) {
            return this.connection
        }
        const reconnectArgs = {
            logger:console
        }
        try {
            this.connection = await amqplib.connect(this.connectionUri);
            return this.connection;
        } catch (e) {
            this.connection = await this.reconnect(reconnectArgs)
            return this.connection
        } finally {
            if (!this.connection){
                return
            }
            // monitor the connection
            this.connection.on('close', () => {
                this.reconnect(reconnectArgs)
            });

            this.connection.on('error', (err) => {
                this.reconnect(reconnectArgs)
            });
        }
    }    

    static async getChannel({logger}: { logger: Logger }) {
        if (this.channel && this.isChannelOpen) {
            return this.channel
        }
        const connection = await this.getConnection();
        if (!connection){
            logger.error("Failed to get connection!")
            return;
        }
        this.channel = await connection.createChannel();
        logger.info("Created channel!")
        await this.channel.assertQueue(this.queues.tasks, this.queueOptions[this.queues.tasks]);
        this.isChannelOpen = true;
        return this.channel;
    }

    static async reconnect({logger, attempts = this.RECONNECT_ATTEMPTS}:{logger:Logger, attempts?:number}) {
        while (attempts > 0) {
            try {
                this.connection = await amqplib.connect(this.connectionUri);
                logger.info(`RMQ connection established`)
                return this.connection;
            } catch (e) {
                attempts--;
                if (attempts === 0) {
                    logger.error('Max RMQ connection attempts reached, exiting.');
                    process.exit(1);
                }
                if (e instanceof Error){
                    logger.error(`RMQ connection failed: ${e.message} Retrying in ${this.RECONNECT_INTERVAL / 1000}s`);                
                }
            }
        }
    }
    
    static async publishMessages(count: number) {
        const channel = await this.getChannel({logger:console})
        if (!channel){
            return
        }
        await Promise.all(
            Array.from({ length: count }).map((_, i) =>
            channel.sendToQueue(this.queues.tasks, Buffer.from(`File_${i}`))
            )
        );

        console.log(`${count} tasks added!`);
    }

    static async consumeMessage({queueName, messageCallback, logger=console}:ConsumeMessageOptions) {
        let channel:Channel | undefined = await this.getChannel({logger});
        if (!channel){
            logger.error("Failed to get channel, exiting!")
            return
        }
        channel.on('close', async () => {
            logger.error('Channel closed, reconnecting...')
            const options: ConsumeMessageOptions = {logger, queueName, messageCallback}
            await this.reconnectChannel(options);
        })
        channel.on('error', async () => {
            logger.error(`Channel error, reconnecting...`)
            await this.reconnectChannel({logger, queueName, messageCallback});
        })
        await channel.assertQueue(queueName, this.queueOptions[queueName]);
        channel.prefetch(this.prefetchCount);
        logger.info(`Worker started for queue:: ${queueName}`)
        await this.startConsumer({channel, queueName, logger, messageCallback})
    }
    
    
    static async startConsumer({channel, queueName, logger=console, messageCallback}:StartConsumerOptions) {
        logger.info(`Starting consumer for queue ${queueName}`)
        channel.consume(queueName, async (msg) => {
            if (msg === null) {
                logger.info('Consumer cancelled by server');
                return;
            }
            await messageCallback(msg.content.toString());
            try {
                channel.ack(msg);
            } catch (e) {
                logger.error(`RMQ error in channel consumer ${e}`)
            }
        }, {
            noAck: false
        });
    }

    static async reconnectChannel({ logger = console, queueName, messageCallback }: ConsumeMessageOptions) {
        this.isChannelOpen = false;
        logger.info('Channel closed, restarting consumer');
        // Create a new connection
        this.connection = await this.reconnect({ logger });
        
        // Always create a **fresh channel**
        const channel = await this.getChannel({ logger });
        if (!channel) {
            logger.error("Could not create a new channel after reconnect");
            return;
        }
  
        // Restart consumer with new channel
        await this.startConsumer({ channel, queueName, logger, messageCallback });
    }
}