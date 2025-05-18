import express from "express";
import {
  deleteAppointment,
  getAllAppointments,
  postAppointment,
  updateAppointmentStatus,
  getFilteredAppointments,
  getPatientAppointments,
  startAppointmentAlert ,
} from "../controller/appointmentController.js";
import {
  isAdminAuthenticated,
  isPatientAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

router.post("/post", isPatientAuthenticated, postAppointment);
router.get("/getall", isAdminAuthenticated, getAllAppointments);
router.get("/getfiltered", isAdminAuthenticated, getFilteredAppointments);
router.put("/update/:id", isAdminAuthenticated, updateAppointmentStatus);
router.post("/appointment/alert", startAppointmentAlert);
router.delete("/delete/:id", isAdminAuthenticated, deleteAppointment);
router.get("/getpatientappointments/:patientId", isPatientAuthenticated,getPatientAppointments
);

export default router;
