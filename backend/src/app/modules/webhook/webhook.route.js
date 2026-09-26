import express from "express";
import {cardPaymentTransferController} from "./card-payment-transfer.controller.js";
import { WebhookController } from "./webhook.controller.js";

const router = express.Router();

// Vapi Webhook Endpoint
router.post("/vapi", WebhookController.handleVapiWebhook);
router.post("/vapi/card-payment-transfer", (req,res,next)=>cardPaymentTransferController(req,res).catch(next));

export const WebhookRouter = router;
