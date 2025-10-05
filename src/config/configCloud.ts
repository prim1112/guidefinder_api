import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: "guidefinderapp_cloudinary",
  api_key: "569231426159175",
  api_secret: "sU2uvS4sGg35lisiYPyEC8S2ZTs",
});

export default cloudinary;
