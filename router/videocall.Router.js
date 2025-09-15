import express from 'express';
import {
  scheduleCall,
  getCallDetails,
  joinCall,
  endCall,
  getUpcomingCalls
} from '../controller/videocall.controller.js';
import {  isPatientAuthenticated,isDoctorAuthenticated, isAdminAuthenticated} from '../middlewares/auth.js';

const router = express.Router();

// Schedule a new video call (Doctor only)
router.post('/schedule', 
 isDoctorAuthenticated, 
  scheduleCall
);

// Get call details                 --> redis used
router.get('/:roomId',  
   // isPatientAuthenticated || isDoctorAuthenticated || isAdminAuthenticated,
  getCallDetails
);

// Join a call
router.post('/join',
 // isPatientAuthenticated|| isDoctorAuthenticated, 
  joinCall
);

// End a call (Doctor only)
router.post('/end', 
  isDoctorAuthenticated || isPatientAuthenticated,
  endCall
);

// Get user's upcoming calls         --> redis used
router.get('/upcoming/:userId', 
    isPatientAuthenticated|| isDoctorAuthenticated,
  getUpcomingCalls
);

export default router;