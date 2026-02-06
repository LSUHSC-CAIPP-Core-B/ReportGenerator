import path from 'node:path';
import express, { type Request, type Response, static as staticFiles } from 'express';
import { Liquid } from 'liquidjs'

const app = express();
const liquid = new Liquid({ extname: '.html' });

app.engine('html', liquid.express());
app.set('views', path.resolve('templates'));
app.set('view engine', 'liquid');
app.use('/assets', staticFiles('templates/assets'));

app.get('/', (req: Request, res: Response) => {
  res.render('builtin/base.html', {
    timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    report: {
      title: "test"
    }
  });
});

export default app;
