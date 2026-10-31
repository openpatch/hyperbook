// The preview bundles the CLI's build.ts, which imports unzipper for archive
// directives. The CLI ships the same declaration at its package root; the
// extension's tsconfig does not see that file, so it is mirrored here.
declare module "unzipper" {
  type ZipEntry = {
    path: string;
    type: "File" | "Directory";
    buffer(): Promise<Buffer>;
  };

  type ZipDirectory = {
    files: ZipEntry[];
    extract(options: { path: string }): Promise<void>;
  };

  const unzipper: {
    Open: {
      file(path: string): Promise<ZipDirectory>;
    };
  };

  export default unzipper;
}
