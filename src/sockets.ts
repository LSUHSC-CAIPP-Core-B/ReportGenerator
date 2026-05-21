import { Server } from 'socket.io';
import { server } from './app';
import { ProjectModel } from './database/schemas';
import { Types } from 'mongoose';

const io = new Server(server);

io.on('connection', (socket) => {
    console.log('New connection: ' + socket.id);

    socket.on("db.files", async (projectIdStr: string, callback: Function) => {
        if (!projectIdStr?.match(/^[a-f\d]{24}$/gi))
            return callback({ message: 'invalid project id' });


        const projectId = Types.ObjectId.createFromHexString(projectIdStr);

        const lookup = await ProjectModel.aggregate([
            { $match: { _id: projectId } },
            { $unwind: '$files' },
            { $lookup: {
                from: 'files',
                as: 'file',
                foreignField: '_id',
                localField: 'files'
            } },
            { $unwind: '$file' },
            { $replaceRoot: {
                newRoot: {
                    id: '$file._id',
                    path: '$file.path',
                    type: '$file.type'
                }
            }},
        ]);

        callback(lookup);

        // console.log(lookup)
    });
});


