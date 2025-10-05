"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: "guidefinderapp_cloudinary",
    api_key: "569231426159175",
    api_secret: "sU2uvS4sGg35lisiYPyEC8S2ZTs",
});
exports.default = cloudinary_1.v2;
//# sourceMappingURL=configCloud.js.map