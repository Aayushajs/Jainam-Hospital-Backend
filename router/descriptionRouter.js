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
  isDoctorAuthenticated,
  isDoctorOrPatientAuthenticated
} from "../middlewares/auth.js";

const router = express.Router();

// Create description (Doctor only)
router.post(
  "/",
  isDoctorAuthenticated,
  createDescription
);

// Get patient's descriptions (Patient & Doctor only)
router.get(
  "/patient/:patientId",
  isDoctorOrPatientAuthenticated,
  getPatientDescriptions
);

// Get all descriptions (Doctor only)
router.get(
  "/allDescriptions",
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
  generateDescriptionPDF
);

// Update description (Doctor only)
router.put(
  "/:id",
  isDoctorAuthenticated,
  updateDescription
);

export default router;