import path from 'node:path';
import express, { type Request, type Response, static as staticFiles } from 'express';
import { Liquid } from 'liquidjs'

const server = express();
const liquid = new Liquid({ extname: '.html' });

server.engine('html', liquid.express());
server.set('views', path.resolve('templates'));
server.set('view engine', 'liquid');
server.use('/assets', staticFiles('templates/assets'));

server.get('/', (req: Request, res: Response) => {
  res.render('builtin/base.html', {
    timestamp: (new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    report: {
      title: "test"
    }
  });
});

export default server;
