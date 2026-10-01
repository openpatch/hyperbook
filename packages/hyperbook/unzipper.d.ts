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
