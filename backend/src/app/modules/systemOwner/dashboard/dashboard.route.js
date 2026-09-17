import express from "express";
import { DashboardController } from "./dashboard.controller.js";
import { checkAuthMiddleware } from "../../../middleware/checkAuthMiddleware.js";
import { Role } from "../../../utils/role.js";

const router = express.Router();

router.get(
  "/",
  checkAuthMiddleware(Role.SYSTEM_OWNER),
  DashboardController.getDashboardStats,
);

router.get(
  "/operations",
  checkAuthMiddleware(Role.SYSTEM_OWNER),
  DashboardController.getOperationsReport,
);

router.get(
  "/operations/live",
  checkAuthMiddleware(Role.SYSTEM_OWNER),
  DashboardController.getLiveOperations,
);

export const DashboardRouter = router;
