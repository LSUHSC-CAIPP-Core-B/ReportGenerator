import express, { type Request, type Response } from 'express';

const server = express();

server.get('/', (req: Request, res: Response) => {
  res.send('Hello world!');
});

export default server;
