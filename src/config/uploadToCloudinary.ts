import cloudinary from "../config/configCloud";

export const uploadToCloudinary = (fileBuffer: Buffer, folder: string) => {
  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

export default uploadToCloudinary;
