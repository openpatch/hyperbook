declare module "unzipper" {
  type ZipDirectory = {
    extract(options: { path: string }): Promise<void>;
  };

  const unzipper: {
    Open: {
      file(path: string): Promise<ZipDirectory>;
    };
  };

  export default unzipper;
}
