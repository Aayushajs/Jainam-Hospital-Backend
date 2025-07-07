import express from "express";
import {
  addNewAdmin,
  addNewDoctor,
  getAllDoctors,
  getAllPatients,
  getAllAdmins,
  getUserDetails,
  deleteDoctor,
  logoutDoctor,
  updateAdminProfile,
  updatePatientProfile,
  updateDoctorProfile,
  login,
  logoutAdmin,
  logoutPatient,
  patientRegister,
  getPatientsWithAppointments,
} from "../controller/userController.js";
import {
  isAdminAuthenticated,
  isDoctorAuthenticated,
  isPatientAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

router.post("/patient/register", patientRegister);
router.get("/getAllPatiens",isAdminAuthenticated,getAllPatients)
router.get("/getPatientsWithAppointments", isDoctorAuthenticated, getPatientsWithAppointments); // for admin to get all patients
router.post("/login", login);// for all admin, user and doctor
router.post("/admin/addnew",  addNewAdmin);
router.post("/doctor/addnew", isAdminAuthenticated, addNewDoctor);
router.get("/doctors", getAllDoctors);
router.get("/patient/me", isPatientAuthenticated, getUserDetails);
router.get("/admin/me", isAdminAuthenticated, getUserDetails);
router.get("/doctor/me",isDoctorAuthenticated,getUserDetails);
router.delete("/doctor/delete/:id", isAdminAuthenticated, deleteDoctor);
router.get("/admins", isAdminAuthenticated, getAllAdmins);
router.get("/patient/logout", isPatientAuthenticated, logoutPatient);
router.get("/admin/logout", isAdminAuthenticated, logoutAdmin);
router.get("/doctor/logout", isDoctorAuthenticated, logoutDoctor);
router.put("/admin/update", isAdminAuthenticated, updateAdminProfile);
router.put("/patient/update", isPatientAuthenticated, updatePatientProfile);
router.put("/doctor/update", isDoctorAuthenticated, updateDoctorProfile);


export default router;
