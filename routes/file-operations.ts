import { Router, Request, Response, NextFunction } from 'express';
import MakeAndUploadFiles from '../modules/tasks/make-upload-files';

const router = Router();

const timeLog = (req: Request, res: Response, next: NextFunction): void => {
  console.log('Time: ', Date.now());
  next();
};

router.use(timeLog);

router.get('/', (req: Request, res: Response) => {
  res.send('Birds home page');
});

// define the about route
router.post('/make-and-upload-files', MakeAndUploadFiles.createJobs);

export default router;
