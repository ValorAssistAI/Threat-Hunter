import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import guarddutyRouter from "./guardduty";
import inspectorRouter from "./inspector";
import securityhubRouter from "./securityhub";
import artifactsRouter from "./artifacts";
import logsRouter from "./logs";
import threatIntelRouter from "./threatintel";
import scansRouter from "./scans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(guarddutyRouter);
router.use(inspectorRouter);
router.use(securityhubRouter);
router.use(artifactsRouter);
router.use(logsRouter);
router.use(threatIntelRouter);
router.use(scansRouter);

export default router;
