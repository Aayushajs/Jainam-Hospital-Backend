import express from "express";
import {
  deleteAppointment,
  getAllAppointments,
  postAppointment,
  updateAppointmentStatus,
  getFilteredAppointments,
  getPatientAppointments,
  startAppointmentAlert, 
  getMyAppointments,
  getAppointmentById,
} from "../controller/appointmentController.js";

import {
  isAdminAuthenticated,
  isDoctorAuthenticated,
  isPatientAuthenticated,
  isAdminOrDoctorAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

router.post("/post", isPatientAuthenticated, postAppointment);
router.get("/getall", isAdminAuthenticated, getAllAppointments);              // --> redis used
router.get("/getMyAppointments", isDoctorAuthenticated, getMyAppointments);   // --> redis used
router.get("/getfiltered", isAdminAuthenticated, getFilteredAppointments);    // --> redis can be used here 
router.put("/update/:id", isAdminOrDoctorAuthenticated, updateAppointmentStatus);
router.get("/:id", isAdminOrDoctorAuthenticated, getAppointmentById);         // --> redis used
router.post("/appointment/alert", startAppointmentAlert);
router.delete("/delete/:id", isAdminAuthenticated, deleteAppointment);
router.get("/getpatientappointments/:patientId", isPatientAuthenticated,getPatientAppointments);  // --> redis used

export default router;
