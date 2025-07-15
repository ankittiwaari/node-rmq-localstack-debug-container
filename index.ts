    import express, { Request, Response } from 'express';
    import bodyParser from 'body-parser'

    import router from './routes/file-operations';

    const app = express();
    const port = 3000;
    
    app.use(bodyParser.json())
    
    app.get('/', (req: Request, res: Response) => {
        res.send('hi there, make a post request to /make-upload-files to get started');
    });

    app.use('/fs', router);

    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });