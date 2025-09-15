import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import { getIO } from "../utils/websocket.js";
import { redis } from "../config/redis.js";

// Post appointment
export const postAppointment = catchAsyncErrors(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    appointment_date,
    department,
    doctor_firstName,
    doctor_lastName,
    hasVisited,
    address,
  } = req.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !nic ||
    !dob ||
    !gender ||
    !appointment_date ||
    !department ||
    !doctor_firstName ||
    !doctor_lastName ||
    !address
  ) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }
  const isConflict = await User.find({
    firstName: doctor_firstName,
    lastName: doctor_lastName,
    role: "Doctor",
    doctorDepartment: department,
  });
  if (isConflict.length === 0) {
    return next(new ErrorHandler("Doctor not found", 404));
  }

  if (isConflict.length > 1) {
    return next(
      new ErrorHandler(
        "Doctors Conflict! Please Contact Through Email Or Phone!",
        400
      )
    );
  }
  const doctorId = isConflict[0]._id;
  const patientId = req.user._id;
  const appointment = await Appointment.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    appointment_date,
    department,
    doctor: {
      firstName: doctor_firstName,
      lastName: doctor_lastName,
    },
    hasVisited,
    address,
    doctorId,
    patientId,
  });
  res.status(200).json({
    success: true,
    appointment,
    message: "Appointment Send!",
  });
});
// Get all appointments
export const getAllAppointments = catchAsyncErrors(async (req, res, next) => {

  const redisKey = `appointments`;
  const cachedData = await redis.get(redisKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      ...JSON.parse(cachedData)
    })
  }
  const appointments = await Appointment.find();

  await redis.setEx(redisKey, 3600, JSON.stringify(appointments));

  res.status(200).json({
    success: true,
    appointments,
  });
});


// export const getAllAppointments = catchAsyncErrors(async (req, res, next) => {
//   const appointments = await Appointment.find();
//   res.status(200).json({
//     success: true,
//     appointments,
//   });
// });


// get appointment by dr. id 



export const getMyAppointments = catchAsyncErrors(async (req, res, next) => {
  const { page = 1, limit = 10, search, status, date } = req.query;


  const filter = { doctorId: req.user._id };


  if (status) {
    filter.status = status;
  }


  if (date) {
    filter.appointment_date = date;
  }


  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } }
    ];
  }

  const redisKey = `appointments:page:${page}:limit:${limit}`;
  const cachedData = await redis.get(redisKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      ...JSON.parse(cachedData)
    });
  }

  const appointments = await Appointment.find(filter)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ appointment_date: 1 });

  const count = await Appointment.countDocuments(filter);

  const responseData = {
    appointments,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    totalAppointments: count
  }

  await redis.setEx(redisKey, 3600, JSON.stringify(responseData));

  res.status(200).json({
    success: true,
    cached: false,
    ...responseData
  });
});

// export const getMyAppointments = catchAsyncErrors(async (req, res, next) => {
//   const { page = 1, limit = 10, search, status, date } = req.query;


//   const filter = { doctorId: req.user._id }; 


//   if (status) {
//     filter.status = status;
//   }


//   if (date) {
//     filter.appointment_date = date; 
//   }


//   if (search) {
//     filter.$or = [
//       { firstName: { $regex: search, $options: 'i' } },
//       { lastName: { $regex: search, $options: 'i' } }
//     ];
//   }

//   const appointments = await Appointment.find(filter)
//     .limit(limit * 1)
//     .skip((page - 1) * limit)
//     .sort({ appointment_date: 1 });

//   const count = await Appointment.countDocuments(filter);

//   res.status(200).json({
//     success: true,
//     appointments,
//     totalPages: Math.ceil(count / limit),
//     currentPage: page,
//     totalAppointments: count
//   });
// });

// Update appointment status


export const updateAppointmentStatus = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { status, fees } = req.body;


  if (!status || !fees) {
    return next(new ErrorHandler("Please provide status or fees to update!", 400));
  }


  let appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new ErrorHandler("Appointment not found!", 404));
  }


  const updateData = {};

  if (status) {

    const validStatuses = ["Pending", "Accepted", "Rejected", "Completed"];
    if (!validStatuses.includes(status)) {
      return next(new ErrorHandler("Invalid appointment status!", 400));
    }


    // Special handling for Accepted status
    if (status === "Accepted" && !appointment.doctorId) {
      return next(new ErrorHandler("Cannot accept appointment without assigned doctor!", 400));
    }

    updateData.status = status;

    // Auto-set fees when accepting if not already set
    if (status === "Accepted" && !appointment.fees && !fees) {
      const doctor = await User.findById(appointment.doctorId);
      if (doctor && doctor.consultationFee) {
        updateData.fees = doctor.consultationFee;
      }
    }
  }

  if (fees !== undefined) {
    // Only allow fee updates for Accepted appointments
    if (appointment.status !== "Accepted" && status !== "Accepted") {
      return next(new ErrorHandler("Fees can only be set for Accepted appointments!", 400));
    }


    updateData.fees = fees;
  }

  // Update the appointment
  appointment = await Appointment.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true,
      useFindAndModify: false
    }
  ).populate({
    path: 'doctorId',
    select: 'firstName lastName email doctorDepartment consultationFee'
  });

  res.status(200).json({
    success: true,
    message: "Appointment updated successfully!",
    appointment: {
      _id: appointment._id,
      status: appointment.status,
      fees: appointment.fees,
      doctor: appointment.doctorId ? {
        name: `${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`,
        department: appointment.doctorId.doctorDepartment,
        consultationFee: appointment.doctorId.consultationFee
      } : null,
      appointment_date: appointment.appointment_date
    }
  });
});
// Delete appointment
export const deleteAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new ErrorHandler("Appointment Not Found!", 404));
  }
  await appointment.deleteOne();
  res.status(200).json({
    success: true,
    message: "Appointment Deleted!",
  });
});
export const getFilteredAppointments = catchAsyncErrors(async (req, res, next) => {
  const { date, status } = req.query;
  let appointments;

  if (req.user.role === "Admin") {
    // Admin can see all appointments with optional filters
    const filter = {};

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.appointment_date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    if (status) {
      filter.status = status;
    }

    appointments = await Appointment.find(filter).sort({ appointment_date: 1 });
  } else if (req.user.role === "Doctor") {
    // Doctor can only see their own appointments with optional filters
    const filter = { doctorId: req.user._id };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.appointment_date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    if (status) {
      filter.status = status;
    }

    appointments = await Appointment.find(filter).sort({ appointment_date: 1 });
  } else {
    // Patients can see their own appointments
    const filter = { patientId: req.user._id };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.appointment_date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    if (status) {
      filter.status = status;
    }

    appointments = await Appointment.find(filter).sort({ appointment_date: 1 });
  }

  res.status(200).json({
    success: true,
    appointments,
  });
});

export const getPatientAppointments = catchAsyncErrors(async (req, res, next) => {
  const { status } = req.query;
  const patientId = req.user._id;

  const residKey = `patientAppointments:${patientId}`;
  const cachedData = await redis.get(residKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      ...JSON.parse(cachedData)
    });
  }


  // Find all appointments for the patient
  const appointments = await Appointment.find({ patientId })
    .sort({ appointment_date: 1 });

  if (appointments.length === 0) {
    return next(new ErrorHandler("No appointments found!", 404));
  }


  const enhancedAppointments = await Promise.all(
    appointments.map(async (appointment) => {

      if (status && appointment.status !== status) { return null };

      const appointmentObj = appointment.toObject();


      if (appointment.status === "Accepted" && appointment.doctorId) {
        const doctor = await User.findById(appointment.doctorId)
          .select("-password -__v");

        appointmentObj.doctorDetails = doctor || null;
      }

      return appointmentObj;
    })
  );

  const filteredAppointments = enhancedAppointments.filter(app => app !== null);

  if (filteredAppointments.length === 0) {
    return next(new ErrorHandler("No appointments found with the specified status!", 404));
  }

  await redis.setEx(residKey, 3600, JSON.stringify(filteredAppointments));


  res.status(200).json({
    success: true,
    cached: false,
    appointments: filteredAppointments,
  });
});

// export const getPatientAppointments = catchAsyncErrors(async (req, res, next) => {
//   const { status } = req.query;
//   const patientId = req.user._id;

//   // Find all appointments for the patient
//   const appointments = await Appointment.find({ patientId })
//     .sort({ appointment_date: 1 });

//   if (appointments.length === 0) {
//     return next(new ErrorHandler("No appointments found!", 404));
//   }


//   const enhancedAppointments = await Promise.all(
//     appointments.map(async (appointment) => {

//       if (status && appointment.status !== status) 
//         {return null};

//       const appointmentObj = appointment.toObject();


//       if (appointment.status === "Accepted" && appointment.doctorId) {
//         const doctor = await User.findById(appointment.doctorId)
//           .select("-password -__v");  

//         appointmentObj.doctorDetails = doctor || null;
//       }

//       return appointmentObj;
//     })
//   );

//   const filteredAppointments = enhancedAppointments.filter(app => app !== null);

//   if (filteredAppointments.length === 0) {
//     return next(new ErrorHandler("No appointments found with the specified status!", 404));
//   }

//   res.status(200).json({
//     success: true,
//     appointments: filteredAppointments,
//   });
// });

// start appointment alert



export const startAppointmentAlert = catchAsyncErrors(async (req, res, next) => {
  const { appointmentId } = req.body;

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return next(new ErrorHandler("Appointment not found", 404));
  }

  // Set 1 day timer
  setTimeout(() => {
    getIO().emit("appointment_alert", {
      appointmentId,
      message: "1 day has passed since appointment creation"
    });
  }, 24 * 60 * 60 * 1000); // 1 day in milliseconds

  res.status(200).json({
    success: true,
    message: "Alert timer started"
  });
});


// Get appointment by ID (admin or doctor)
export const getAppointmentById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const redisKey = `appointment:${id}`
  const cachedData = await redis.get(redisKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      ...JSON.parse(cachedData)
    });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new ErrorHandler("Appointment not found!", 404));
  }

  // Admin can access any appointment
  if (req.user.role === "Admin") {
    await redis.setEx(redisKey, 3600, JSON.stringify(appointment));
    return res.status(200).json({
      success: true,
      cached: false,
      appointment
    });
  }

  // Doctor can only access appointments assigned to them
  if (req.user.role === "Doctor") {
    if (appointment.doctorId && appointment.doctorId.toString() === req.user._id.toString()) {
      return res.status(200).json({
        success: true,
        cached: false, 
        appointment
      });
    } else {
      return next(new ErrorHandler("Unauthorized: You can only access your own appointments!", 403));
    }
  }

  // Other roles not allowed
  return next(new ErrorHandler("Unauthorized", 403));
});


// export const getAppointmentById = catchAsyncErrors(async (req, res, next) => {
//   const { id } = req.params;
//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return next(new ErrorHandler("Appointment not found!", 404));
//   }

//   // Admin can access any appointment
//   if (req.user.role === "Admin") {
//     return res.status(200).json({ success: true, appointment });
//   }

//   // Doctor can only access appointments assigned to them
//   if (req.user.role === "Doctor") {
//     if (appointment.doctorId && appointment.doctorId.toString() === req.user._id.toString()) {
//       return res.status(200).json({ success: true, appointment });
//     } else {
//       return next(new ErrorHandler("Unauthorized: You can only access your own appointments!", 403));
//     }
//   }

//   // Other roles not allowed
//   return next(new ErrorHandler("Unauthorized", 403));
// });