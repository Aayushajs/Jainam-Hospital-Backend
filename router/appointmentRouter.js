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
router.get("/getall", isAdminAuthenticated, getAllAppointments);
router.get("/getMyAppointments", isDoctorAuthenticated, getMyAppointments);
router.get("/getfiltered", isAdminAuthenticated, getFilteredAppointments);
router.put("/update/:id", isAdminOrDoctorAuthenticated, updateAppointmentStatus);
router.get("/:id", isAdminOrDoctorAuthenticated, getAppointmentById);
router.post("/appointment/alert", startAppointmentAlert);
router.delete("/delete/:id", isAdminAuthenticated, deleteAppointment);
router.get("/getpatientappointments/:patientId", isPatientAuthenticated,getPatientAppointments
);

export default router;
