import VideoCall from '../models/videocall.schema.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../utils/websocket.js';

// Schedule a new video consultation
export const scheduleCall = async (req, res) => {
  try {
    const { doctorId, patientId, scheduledAt, duration } = req.body;

    // Validate input
    if (!doctorId || !patientId || !scheduledAt || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const roomId = `vc-${uuidv4()}`;
    const call = new VideoCall({
      roomId,
      doctorId,
      patientId,
      scheduledAt: new Date(scheduledAt),
      duration
    });

    await call.save();

    res.status(201).json({
      success: true,
      message: 'Video call scheduled successfully',
      callDetails: {
        roomId,
        scheduledAt: call.scheduledAt,
        duration,
        status: call.status
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get call details
export const getCallDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Fetch call details with doctor information
    const call = await VideoCall.findOne({ roomId })
      .populate('doctorId', 'firstName lastName doctorDepartment email phone docAvatar')
      .populate('patientId', 'firstName lastName email phone');

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // Format response
    const response = {
      roomId: call.roomId,
      scheduledAt: call.scheduledAt,
      duration: call.duration,
      status: call.status,
      doctor: {
        id: call.doctorId._id,
         firstname: call.doctorId.firstName,
         lastName: call.doctorId.lastName,
        specialization: call.doctorId.doctorDepartment,
        contact: {
          email: call.doctorId.email,
          phone: call.doctorId.phone
        },
        profilePicture: call.doctorId.docAvatar
      },
      patient: {
        id: call.patientId._id,
        firstname: call.patientId.firstName,
         lastName: call.patientId.lastName,
        contact: {
          email: call.patientId.email,
          phone: call.patientId.phone
        }
      },
      createdAt: call.createdAt,
      endedAt: call.endedAt
    };

    res.status(200).json({
      success: true,
      call: response
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Join a video call
export const  joinCall = async (req, res) => {
  try {
    const { roomId, userId } = req.body;
    const call = await VideoCall.findOne({ roomId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // Verify participant
    if (userId !== call.doctorId && userId !== call.patientId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to join this call'
      });
    }

    // Update status if first participant
    if (call.status === 'scheduled') {
      call.status = 'ongoing';
      await call.save();
    }

    // Generate token (for production, use JWT or similar)
    const token = uuidv4();

    res.status(200).json({
      success: true,
      token,
      callDetails: {
        roomId,
        status: call.status,
        scheduledAt: call.scheduledAt,
        duration: call.duration
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// End a call manually
export const endCall = async (req, res) => {
  try {
    const { roomId } = req.body;
    const call = await VideoCall.findOneAndUpdate(
      { roomId },
      { 
        status: 'completed',
        endedAt: new Date()
      },
      { new: true }
    );

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // Notify participants via WebSocket
    getIO().to(roomId).emit('call_ended', {
      roomId,
      endedAt: new Date(),
      reason: 'manual_termination'
    });

    res.status(200).json({
      success: true,
      message: 'Call ended successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user's upcoming calls
export const getUpcomingCalls = async (req, res) => {
  try {
    const { userId } = req.params;
    const calls = await VideoCall.find({
      $or: [{ doctorId: userId }, { patientId: userId }],
      status: { $in: ['scheduled', 'ongoing'] },
      scheduledAt: { $gte: new Date() }
    }).sort({ scheduledAt: 1 });

    res.status(200).json({
      success: true,
      calls
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};