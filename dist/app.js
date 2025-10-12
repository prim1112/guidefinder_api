"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_1 = require("./controller/index");
const customer_1 = require("./controller/customer");
const guide_1 = require("./controller/guide");
const login_1 = require("./controller/login");
const package_1 = require("./controller/package");
const location_1 = require("./controller/location");
exports.app = (0, express_1.default)();
// ✅ CORS
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "https://guidefinder-api.onrender.com",
];
exports.app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin))
            cb(null, true);
        else
            cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
exports.app.use(express_1.default.json());
exports.app.use("/", index_1.router);
exports.app.use("/customer", customer_1.router);
exports.app.use("/guide", guide_1.router);
exports.app.use("/auth", login_1.router);
exports.app.use("/package", package_1.router);
exports.app.use("/location", location_1.router);
// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });
exports.default = exports.app;
//# sourceMappingURL=app.js.map