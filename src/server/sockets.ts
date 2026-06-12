import { Types } from 'mongoose';
import { Server } from 'socket.io';
import { server } from './app.ts';
import { ProjectModel } from './database/schemas.ts';
import projects from './projects/index.ts';

const io = new Server(server);

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('db.files', async (projectIdStr: string, callback: Function) => {
    if (!projectIdStr?.match(/^[a-f\d]{24}$/gi)) return callback({ message: 'invalid project id' });

    const projectId = Types.ObjectId.createFromHexString(projectIdStr);

    const lookup = await ProjectModel.aggregate([
      { $match: { _id: projectId } },
      { $unwind: '$files' },
      {
        $lookup: {
          as: 'file',
          foreignField: '_id',
          from: 'files',
          localField: 'files',
        },
      },
      { $unwind: '$file' },
      {
        $replaceRoot: {
          newRoot: {
            id: '$file._id',
            path: '$file.path',
            type: '$file.type',
          },
        },
      },
    ]);

    callback(lookup);

    // console.log(lookup)
  });

  socket.on('local.project', async (projectId, action) => {
    try {
      const updated = await projects.applyAction(projectId, action);

      socket.to(projectId).emit('local.project.updated', {
        action,
        updated,
      });
    } catch (err) {
      console.log(err);

      socket.emit('local.project.error', {
        action,
        error: String(err),
      });
    }
  });

  socket.on('local.projects', async (callback: Function) => {
    const allProjects = await projects.getAllProjects();
    callback(allProjects);
  });

  socket.on('db.projects', async (callback: Function) => {
    const lookup = await ProjectModel.aggregate([
      {
        $replaceRoot: {
          newRoot: {
            id: '$_id',
            path: '$path',
          },
        },
      },
    ]);

    callback(lookup);

    // console.log(lookup)
  });
});
