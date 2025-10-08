"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = void 0;
const configCloud_1 = __importDefault(require("../config/configCloud"));
const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = configCloud_1.default.uploader.upload_stream({ folder }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        stream.end(fileBuffer);
    });
};
exports.uploadToCloudinary = uploadToCloudinary;
exports.default = exports.uploadToCloudinary;
//# sourceMappingURL=uploadToCloudinary.js.map