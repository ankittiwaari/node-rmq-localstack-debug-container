import amqplib, { Channel, ChannelModel, Connection } from "amqplib";

export default class TaskQueue{
    static connection:ChannelModel | undefined;
    static channel:Channel;
    static isChannelOpen = false;
    static connectionUri = `amqp://guest:guest@localhost:5672?heartbeat=10`
    static RECONNECT_INTERVAL = 5000;
    static RECONNECT_ATTEMPTS = 10;
    static messageOptions = {
        persistent: true
    };
    static queues = {
        tasks: "q.tasks"
    }   

    static queueOptions = {
        [this.queues.tasks]: {
            durable: true,            
            messageTtl: 172_800_000 // 48 hours
        }
    };

    
    static async getConnection():Promise<ChannelModel|undefined> {
        if (this.connection) {
            return this.connection
        }
        try {
            this.connection = await amqplib.connect(this.connectionUri);
            return this.connection;
        } catch (e) {
            this.connection = await this.reconnect()
            return this.connection
        } finally {
            if (!this.connection){
                return
            }
            // monitor the connection
            this.connection.on('close', () => {
                this.reconnect()
            });

            this.connection.on('error', (err) => {
                this.reconnect()
            });
        }
    }    

    static async getChannel() {
        if (this.channel && this.isChannelOpen) {
            return this.channel
        }
        const connection = await this.getConnection();
        if (!connection){
            return;
        }
        this.channel = await connection.createChannel();

        await this.channel.assertQueue(this.queues.tasks, this.queueOptions);
        this.isChannelOpen = true;
        return this.channel;
    }

    static async reconnect({logger=console, attempts = this.RECONNECT_ATTEMPTS}={}) {
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
        const channel = await this.getChannel()
        if (!channel){
            return
        }
        await Promise.all(
            Array.from({ length: count }).map((_, i) =>
            channel.sendToQueue(this.queues.tasks, Buffer.from(`Message ${i}`))
            )
        );

        console.log(`${count} tasks added!`);
        await this.channel.close();        
    }

}