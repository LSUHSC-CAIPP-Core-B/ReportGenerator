import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { ZipArchive } from 'archiver';

export async function createZip(sourceDir: string, outputFile: string): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputFile);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });

  const info = await stat(outputFile);
  console.log(`ZIP created: ${outputFile} (${info.size} bytes)`);
  return outputFile;
}
