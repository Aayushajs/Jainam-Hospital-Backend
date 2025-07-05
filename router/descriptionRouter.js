import express from "express";
import {
  createDescription,
  getPatientDescriptions,
  getDescription,
  getDescriptionsByFilters,
  generateDescriptionPDF,
  updateDescription
} from "../controller/DescriptionController.js";
import {
  isAdminAuthenticated,
  isPatientAuthenticated,
  isDoctorAuthenticated
} from "../middlewares/auth.js";

const router = express.Router();

// Create description (Doctor only)
router.post(
  "/",
  isDoctorAuthenticated,
  createDescription
);

// Get patient's descriptions (Patient or Doctor)
router.get(
  "/patient/:patientId",
  isPatientAuthenticated || isDoctorAuthenticated,
  getPatientDescriptions
);

// Get single description (Doctor only)
router.get(
  "/:id",
  isDoctorAuthenticated,
  getDescription
);

// Get filtered descriptions (Admin only)
router.get(
  "/admin/filter",
  isAdminAuthenticated,
  getDescriptionsByFilters
);

// Generate PDF (Patient, Doctor or Admin)
router.get(
  "/:id/pdf",
 // isPatientAuthenticated || isDoctorAuthenticated || isAdminAuthenticated,
  generateDescriptionPDF
);

// Update description (Doctor only)
router.put(
  "/:id",
  isDoctorAuthenticated,
  updateDescription
);

export default router;