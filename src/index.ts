import * as tmp from 'tmp';
import {default as Project} from 'ts-morph';
import {StaticConf} from './inc/StaticConf';
import {trimMapper} from './inc/trimMapper';
import {SrcFile} from './SrcFile';

tmp.setGracefulCleanup();

function mkTmpFile(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    tmp.file((err, path) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

export function formatAsync(contents: string, indentSize: number = StaticConf.INDENT): Promise<string> {
  return mkTmpFile()
    .then(tmpPath => doFormat(contents, tmpPath, indentSize));
}

export function formatSync(contents: string, indentSize: number = StaticConf.INDENT): string {
  return doFormat(contents, tmp.fileSync().name, indentSize);
}

function doFormat(contents: string, tmpPath: string, indentSize: number): string {
  const project = new Project();
  const srcFile = project.createSourceFile(tmpPath, contents, {overwrite: true});
  const file = new SrcFile(srcFile);
  file.processClasses();

  let txt = srcFile.getFullText();
  if (txt !== contents) {
    srcFile.formatText({indentSize, ensureNewLineAtEndOfFile: true});

    txt = srcFile.getFullText().trim()
      .split(/\n/g)
      .map(trimMapper)
      .join('\n') + '\n';
  }

  return txt;
}
