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
  getLoginHistory,
  getLoginHistoryByUserId,
  getMyLoginHistory,
  forgotPassword,
  resetPassword,
} from "../controller/userController.js";
import {
  isAdminAuthenticated,
  isDoctorAuthenticated,
  isAdminOrDoctorAuthenticated,
  isPatientAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

// 🔹 Auth & Password
router.post("/login", login); // common login for all
router.get("/login-history", isAdminAuthenticated, getLoginHistory);
router.get("/login-history/:id", isAdminOrDoctorAuthenticated, getLoginHistoryByUserId);
router.post("/forgot/password", forgotPassword);                                                           //            ->redis req                  
router.post("/reset/password", isPatientAuthenticated, resetPassword);                                     //            ->redis req
router.get("/my/login-history", isPatientAuthenticated, getMyLoginHistory);

// 🔹 Patient APIs
router.post("/patient/register", patientRegister);
router.get("/patient/me", isPatientAuthenticated, getUserDetails);
router.put("/patient/update", isPatientAuthenticated, updatePatientProfile);
router.get("/patient/logout", isPatientAuthenticated, logoutPatient);
router.get("/getAllPatiens", isAdminAuthenticated, getAllPatients); // (admin-only)                                      ->redis req  
router.get("/getPatientsWithAppointments", isDoctorAuthenticated, getPatientsWithAppointments);             //           ->redis req    

// 🔹 Doctor APIs
router.post("/doctor/addnew", isAdminAuthenticated, addNewDoctor);
router.get("/doctors", getAllDoctors);                                                                      //            ->redis req  
router.get("/doctor/me", isDoctorAuthenticated, getUserDetails);                                            
router.put("/doctor/update", isDoctorAuthenticated, updateDoctorProfile);
router.delete("/doctor/delete/:id", isAdminAuthenticated, deleteDoctor);
router.get("/doctor/logout", isDoctorAuthenticated, logoutDoctor);

// 🔹 Admin APIs
router.post("/admin/addnew", addNewAdmin);
router.get("/admins", isAdminAuthenticated, getAllAdmins);                                                   //            ->redis req
router.get("/admin/me", isAdminAuthenticated, getUserDetails);
router.put("/admin/update", isAdminAuthenticated, updateAdminProfile);
router.get("/admin/logout", isAdminAuthenticated, logoutAdmin);



export default router;
